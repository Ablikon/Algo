"""
Products Router

Handles product comparison, listing, and search.
Optimized for 40k+ products with pagination and efficient queries.
"""

import os
from fastapi import APIRouter, Query, HTTPException
from typing import List, Optional
from bson import ObjectId
from database import get_db
from models import ProductComparisonResponse, PriceEntryResponse

router = APIRouter()

OUR_COMPANY = os.getenv("OUR_COMPANY_AGGREGATOR", "Glovo")

AGGREGATOR_COLORS = {
    "Glovo": "#00A082",
    "Arbuz.kz": "#FF7F00",
    "Wolt": "#00C2E8",
    "Yandex Lavka": "#FFCC00",
    "Magnum": "#EE1C25",
    "Airba Fresh": "#78B833",
}

# ================= LIST PRODUCTS =================

@router.get("/products/")
async def get_products(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    search: Optional[str] = None,
    category: Optional[str] = None,
):
    db = get_db()

    query = {}
    if search:
        query["$text"] = {"$search": search}
    if category:
        query["$or"] = [{"category": category}, {"subcategory": category}]

    total = await db.products.count_documents(query)
    skip = (page - 1) * page_size

    # 🔥 ФИКС: обязательная сортировка
    cursor = (
        db.products
        .find(query)
        .sort("updated_at", -1)
        .skip(skip)
        .limit(page_size)
    )

    products = await cursor.to_list(length=page_size)

    return {
        "count": total,
        "page": page,
        "page_size": page_size,
        "total_pages": (total + page_size - 1) // page_size,
        "results": [{**p, "_id": str(p["_id"])} for p in products]
    }

# ================= COMPARISON =================

@router.get("/products/comparison/")
async def get_products_comparison(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    search: Optional[str] = None,
    city: Optional[str] = None,
    category_ids: Optional[List[str]] = Query(None, alias="category_ids[]"),
):
    db = get_db()

    and_conditions = [
        {"prices.aggregator": OUR_COMPANY},
        {"prices": {"$elemMatch": {"aggregator": {"$ne": OUR_COMPANY}}}}
    ]

    if search:
        and_conditions.append({"$text": {"$search": search}})

    if city:
        and_conditions.append({"prices.city": city})

    query = {"$and": and_conditions}
    total = await db.products.count_documents(query)

    pipeline = [
        {"$match": query},
        {"$addFields": {"price_count": {"$size": {"$ifNull": ["$prices", []]}}}},
        {"$sort": {"price_count": -1, "name": 1}},
        {"$skip": (page - 1) * page_size},
        {"$limit": page_size}
    ]

    products = await db.products.aggregate(pipeline).to_list(length=page_size)

    results = []

    for p in products:
        prices_dict = {}
        our_price = None
        competitor_prices = []

        for price in p.get("prices", []):
            if city and price.get("city") != city:
                continue

            agg = price.get("aggregator")
            is_ours = agg == OUR_COMPANY

            prices_dict[agg] = PriceEntryResponse(
                aggregator=agg,
                aggregator_color=AGGREGATOR_COLORS.get(agg, "#666"),
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

        min_price = min(competitor_prices) if competitor_prices else None

        if our_price is None:
            position = "missing"
        elif competitor_prices and our_price <= min_price:
            position = "leader"
        else:
            position = "higher"

        results.append(ProductComparisonResponse(
            id=str(p["_id"]),
            name=p.get("name"),
            category=p.get("category"),
            subcategory=p.get("subcategory"),
            brand=p.get("brand"),
            image_url=p.get("image_url"),
            prices=prices_dict,
            min_price=min_price,
            our_price=our_price,
            price_position=position
        ))

    return {
        "count": total,
        "page": page,
        "page_size": page_size,
        "total_pages": (total + page_size - 1) // page_size,
        "results": [r.model_dump() for r in results],
    }

# ================= SINGLE PRODUCT =================

@router.get("/products/{product_id}")
async def get_product(product_id: str):
    db = get_db()

    if not ObjectId.is_valid(product_id):
        raise HTTPException(status_code=400, detail="Invalid product ID")

    product = await db.products.find_one({"_id": ObjectId(product_id)})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    product["_id"] = str(product["_id"])
    return product
