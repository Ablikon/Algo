"""
Products Router

Handles product comparison, listing, and search.
Optimized for 40k+ products with pagination and efficient queries.
"""

from fastapi import APIRouter, Query, HTTPException
from typing import List, Optional
import os
from bson import ObjectId

from database import get_db
from models import ProductComparisonResponse, PaginatedResponse, PriceEntryResponse

router = APIRouter()

# Our company aggregator
OUR_COMPANY = os.getenv("OUR_COMPANY_AGGREGATOR", "Glovo")

# Aggregator colors for UI
AGGREGATOR_COLORS = {
    "Glovo": "#00A082",
    "Arbuz.kz": "#FF7F00",
    "Wolt": "#00C2E8",
    "Yandex Lavka": "#FFCC00",
    "Magnum": "#EE1C25",
    "Airba Fresh": "#78B833",
}


@router.get("/products/")
async def get_products(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    search: Optional[str] = None,
    category: Optional[str] = None,
):
    """Get paginated list of products"""
    db = get_db()
    
    query = {}
    if search:
        query["$text"] = {"$search": search}
    if category:
        query["$or"] = [
            {"category": category},
            {"subcategory": category}
        ]
    
    total = await db.products.count_documents(query)
    skip = (page - 1) * page_size
    
    cursor = db.products.find(query).skip(skip).limit(page_size)
    products = await cursor.to_list(length=page_size)
    
    return {
        "count": total,
        "page": page,
        "page_size": page_size,
        "total_pages": (total + page_size - 1) // page_size,
        "results": [{**p, "_id": str(p["_id"])} for p in products]
    }


@router.get("/products/comparison/")
async def get_products_comparison(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    search: Optional[str] = None,
    city: Optional[str] = None,
    category_ids: Optional[List[str]] = Query(None, alias="category_ids[]"),
):
    """
    Get products with prices for comparison table.
    Sorted by number of prices (matching density) descending.
    """
    db = get_db()
    
    # Build query
    query = {}
    if search:
        query["$text"] = {"$search": search}
    
    # Category filter - get category names from IDs
    if category_ids:
        category_docs = await db.categories.find(
            {"_id": {"$in": [ObjectId(cid) for cid in category_ids if ObjectId.is_valid(cid)]}}
        ).to_list(length=100)
        category_names = [c["name"] for c in category_docs]
        
        if category_names:
            query["$or"] = [
                {"category": {"$in": category_names}},
                {"subcategory": {"$in": category_names}}
            ]
    
    # City filter on prices
    if city:
        query["prices.city"] = city
    
    # Total count
    total = await db.products.count_documents(query)
    
    # Get products sorted by price count (most matches first)
    pipeline = [
        {"$match": query},
        {"$addFields": {
            "price_count": {"$size": {"$ifNull": ["$prices", []]}}
        }},
        {"$sort": {"price_count": -1, "name": 1}},
        {"$skip": (page - 1) * page_size},
        {"$limit": page_size}
    ]
    
    products = await db.products.aggregate(pipeline).to_list(length=page_size)
    
    # Get all aggregators for response
    aggregators = await db.aggregators.find().to_list(length=20)
    aggregator_map = {a["name"]: a for a in aggregators}
    
    # Transform to comparison response format
    results = []
    for p in products:
        # Build prices dict by aggregator
        prices_dict = {}
        our_price = None
        min_price = None
        competitor_prices = []
        
        for price in p.get("prices", []):
            agg_name = price.get("aggregator", "Unknown")
            is_ours = agg_name == OUR_COMPANY
            
            agg_info = aggregator_map.get(agg_name, {})
            
            prices_dict[agg_name] = PriceEntryResponse(
                aggregator=agg_name,
                aggregator_color=agg_info.get("color") or AGGREGATOR_COLORS.get(agg_name, "#666"),
                aggregator_logo=agg_info.get("logo_url"),
                price=price.get("price"),
                original_price=price.get("original_price"),
                is_available=price.get("is_available", True),
                external_url=price.get("external_url"),
                is_our_company=is_ours
            )
            
            if price.get("price"):
                if is_ours:
                    our_price = price["price"]
                else:
                    competitor_prices.append(price["price"])
        
        # Calculate price position
        if competitor_prices:
            min_price = min(competitor_prices)
            max_price = max(competitor_prices)
        else:
            min_price = None
            max_price = None
        
        if our_price is None:
            if competitor_prices:
                position = "missing"
            else:
                position = "unknown"
        elif competitor_prices:
            if our_price <= min_price:
                position = "leader"
            else:
                position = "higher"
        else:
            position = "leader"

        # Weight string
        weight = None
        if p.get("weight_value") and p.get("weight_unit"):
            weight = f"{p['weight_value']} {p['weight_unit']}"
            
        # Calculate normalized prices
        normalized_prices = {}
        weight_val = p.get('weight_value')
        weight_unit = p.get('weight_unit')
        
        if weight_val and weight_val > 0:
            for agg, price_entry in prices_dict.items():
                price = price_entry.price
                if price:
                    # Normalize to 1kg or 1l or 1pcs
                    norm_price = price / weight_val
                    norm_unit = weight_unit
                    
                    # If unit is g/ml, normalize to kg/l (multiply by 1000)
                    if weight_unit in ['g', 'ml']:
                        norm_price *= 1000
                        norm_unit = 'kg' if weight_unit == 'g' else 'l'
                    elif weight_unit == 'kg':
                        norm_unit = 'kg'
                    elif weight_unit == 'l':
                        norm_unit = 'l'
                    
                    normalized_prices[agg] = {
                        "price_per_unit": round(norm_price, 2),
                        "unit": norm_unit
                    }

        results.append(ProductComparisonResponse(
            id=str(p["_id"]),
            name=p.get("name", ""),
            category=p.get("category"),
            subcategory=p.get("subcategory"),
            brand=p.get("brand"),
            weight=weight,
            image_url=p.get("image_url"),
            prices=prices_dict,
            normalized_prices=normalized_prices,
            min_price=min_price,
            max_price=max_price,
            our_price=our_price,
            country=p.get("country"),
            price_position=position
        ))
    
    # Aggregators metadata for frontend
    aggregators_meta = [
        {
            "id": str(a["_id"]),
            "name": a["name"],
            "color": a.get("color") or AGGREGATOR_COLORS.get(a["name"], "#666"),
            "is_our_company": a["name"] == OUR_COMPANY
        }
        for a in aggregators
    ]
    
    return {
        "count": total,
        "page": page,
        "page_size": page_size,
        "total_pages": (total + page_size - 1) // page_size,
        "results": [r.model_dump() for r in results],
        "meta": {"aggregators": aggregators_meta}
    }


@router.get("/products/{product_id}")
async def get_product(product_id: str):
    """Get single product by ID"""
    db = get_db()
    
    if not ObjectId.is_valid(product_id):
        raise HTTPException(status_code=400, detail="Invalid product ID")
    
    product = await db.products.find_one({"_id": ObjectId(product_id)})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    product["_id"] = str(product["_id"])
    return product
