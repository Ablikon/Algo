"""
Dashboard Router

Provides statistics for the dashboard.
Optimized with MongoDB aggregation for 40k+ products.
"""

from fastapi import APIRouter, Query
from typing import Optional
import os

from database import get_db
from models import DashboardStats

router = APIRouter()

OUR_COMPANY = os.getenv("OUR_COMPANY_AGGREGATOR", "Рядом")


@router.get("/dashboard/", response_model=DashboardStats)
async def get_dashboard_stats(city: Optional[str] = Query(None)):
    """
    Get dashboard statistics with efficient aggregation.

    Stats calculated:
    - total_products: Total products in database
    - products_at_top: Products where our price is lowest
    - products_need_action: Products where our price is higher than competitors
    - missing_products: Products competitors have but we don't
    - aggregator_stats: Price coverage per aggregator
    """
    db = get_db()

    # Use aggregation pipeline for efficiency
    pipeline = []

    # Match by city if specified
    if city:
        pipeline.append({
            "$match": {"prices.city": city}
        })

    # Calculate stats for each product
    pipeline.extend([
        {
            "$addFields": {
                "our_prices": {
                    "$filter": {
                        "input": {"$ifNull": ["$prices", []]},
                        "as": "p",
                        "cond": {"$and": [
                            {"$eq": ["$$p.aggregator", OUR_COMPANY]},
                            {"$eq": ["$$p.is_available", True]}
                        ]}
                    }
                },
                "competitor_prices": {
                    "$filter": {
                        "input": {"$ifNull": ["$prices", []]},
                        "as": "p",
                        "cond": {"$and": [
                            {"$ne": ["$$p.aggregator", OUR_COMPANY]},
                            {"$eq": ["$$p.is_available", True]},
                            {"$gt": ["$$p.price", 0]}
                        ]}
                    }
                }
            }
        },
        {
            "$addFields": {
                "our_price": {"$arrayElemAt": ["$our_prices.price", 0]},
                "min_competitor_price": {"$min": "$competitor_prices.price"},
                "has_our_price": {"$gt": [{"$size": "$our_prices"}, 0]},
                "has_competitor_prices": {"$gt": [{"$size": "$competitor_prices"}, 0]}
            }
        },
        {
            "$group": {
                "_id": None,
                "total_products": {"$sum": 1},
                "products_at_top": {
                    "$sum": {
                        "$cond": [
                            {"$and": [
                                "$has_our_price",
                                {"$or": [
                                    {"$not": "$has_competitor_prices"},
                                    {"$and": [
                                        {"$ne": ["$our_price", None]},
                                        {"$lte": ["$our_price", "$min_competitor_price"]}
                                    ]}
                                ]}
                            ]},
                            1, 0
                        ]
                    }
                },
                "products_need_action": {
                    "$sum": {
                        "$cond": [
                            {"$and": [
                                "$has_our_price",
                                "$has_competitor_prices",
                                {"$ne": ["$our_price", None]},
                                {"$gt": ["$our_price", "$min_competitor_price"]}
                            ]},
                            1, 0
                        ]
                    }
                },
                "missing_products": {
                    "$sum": {
                        "$cond": [
                            {"$and": [
                                {"$not": "$has_our_price"},
                                "$has_competitor_prices"
                            ]},
                            1, 0
                        ]
                    }
                }
            }
        }
    ])

    result = await db.products.aggregate(pipeline).to_list(length=1)

    if result:
        stats = result[0]
        total = stats.get("total_products", 0)
        at_top = stats.get("products_at_top", 0)
        need_action = stats.get("products_need_action", 0)
        missing = stats.get("missing_products", 0)
    else:
        total = at_top = need_action = missing = 0

    # Calculate percentages
    total_with_our = at_top + need_action
    market_coverage = (total_with_our / total * 100) if total > 0 else 0
    price_competitiveness = (at_top / total_with_our * 100) if total_with_our > 0 else 0

    # Get aggregator stats with overlap and price info
    # We need a more complex pipeline to check overlaps
    agg_pipeline = [
        {"$unwind": "$prices"},
        {"$match": {
            "prices.aggregator": {"$ne": OUR_COMPANY},
            "prices.is_available": True,
            "prices.price": {"$gt": 0}
        }},
    ]
    if city:
        agg_pipeline.append({"$match": {"prices.city": city}})

    agg_pipeline.extend([
        {
            "$lookup": {
                "from": "products",
                "localField": "_id",
                "foreignField": "_id",
                "as": "product_info"
            }
        },
        {
            "$project": {
                "aggregator": "$prices.aggregator",
                "price": "$prices.price",
                "our_prices": {
                    "$filter": {
                        "input": {"$arrayElemAt": ["$product_info.prices", 0]},
                        "as": "p",
                        "cond": {"$eq": ["$$p.aggregator", OUR_COMPANY]}
                    }
                }
            }
        },
        {
            "$addFields": {
                "our_price": {"$arrayElemAt": ["$our_prices.price", 0]},
                "has_overlap": {"$gt": [{"$size": "$our_prices"}, 0]}
            }
        },
        {
            "$group": {
                "_id": "$aggregator",
                "count": {"$sum": 1},
                "overlap_count": {
                    "$sum": {"$cond": ["$has_overlap", 1, 0]}
                },
                "price_ratios": {
                    "$push": {
                        "$cond": [
                            {"$and": ["$has_overlap", {"$gt": ["$our_price", 0]}, {"$gt": ["$price", 0]}]},
                            {"$divide": ["$price", "$our_price"]},
                            None
                        ]
                    }
                }
            }
        }
    ])

    agg_results = await db.products.aggregate(agg_pipeline).to_list(length=20)

    aggregator_stats = {}
    for agg in agg_results:
        name = agg["_id"]
        count = agg["count"]
        overlap = agg["overlap_count"]
        percent = round((count / total * 100), 1) if total > 0 else 0

        # Calculate price index
        ratios = [r for r in agg.get("price_ratios", []) if r is not None]
        price_index = 0
        if ratios:
            avg_ratio = sum(ratios) / len(ratios)
            price_index = round((avg_ratio - 1) * 100, 1)

        aggregator_stats[name] = {
            "count": count,
            "percent": percent,
            "overlap_count": overlap,
            "price_index": price_index
        }

    # Add stats for our company aggregator (e.g., Рядом)
    our_pipeline = [
        {"$unwind": "$prices"},
        {"$match": {
            "prices.aggregator": OUR_COMPANY,
            "prices.is_available": True
        }},
        {"$group": {"_id": "$prices.aggregator", "count": {"$sum": 1}}}
    ]
    if city:
        our_pipeline.insert(2, {"$match": {"prices.city": city}})

    our_result = await db.products.aggregate(our_pipeline).to_list(length=1)
    if our_result:
        our_count = our_result[0].get("count", 0)
        aggregator_stats[OUR_COMPANY] = {
            "count": our_count,
            "percent": round((our_count / total * 100), 1) if total > 0 else 0,
            "overlap_count": our_count,
            "price_index": 0
        }

    # Get pending recommendations count
    pending_recs = await db.recommendations.count_documents({"status": "PENDING"})

    # Calculate potential savings (sum of potential_savings from pending recommendations)
    savings_result = await db.recommendations.aggregate([
        {"$match": {"status": "PENDING", "potential_savings": {"$ne": None}}},
        {"$group": {"_id": None, "total": {"$sum": "$potential_savings"}}}
    ]).to_list(length=1)
    potential_savings = savings_result[0]["total"] if savings_result else 0

    return DashboardStats(
        total_products=total,
        products_at_top=at_top,
        products_need_action=need_action,
        missing_products=missing,
        pending_recommendations=pending_recs,
        potential_savings=potential_savings,
        market_coverage=round(market_coverage, 1),
        price_competitiveness=round(price_competitiveness, 1),
        aggregator_stats=aggregator_stats
    )

@router.get("/dashboard/gaps/")
async def get_market_gaps(
    city: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100)
):
    """
    Get products that competitors have but we don't (Market Gaps).
    """
    db = get_db()

    # Query for products where we have no price but competitors do
    query = {
        "prices": {
            "$elemMatch": {"aggregator": {"$ne": OUR_COMPANY}}
        },
        "prices.aggregator": {"$ne": OUR_COMPANY}
    }

    if city:
        query["prices.city"] = city

    total = await db.products.count_documents(query)
    skip = (page - 1) * page_size

    # Find products and sort by number of competitor prices
    pipeline = [
        {"$match": query},
        {"$addFields": {
            "comp_count": {"$size": "$prices"},
            "min_comp_price": {"$min": "$prices.price"}
        }},
        {"$sort": {"comp_count": -1, "min_comp_price": 1}},
        {"$skip": skip},
        {"$limit": page_size}
    ]

    gaps = await db.products.aggregate(pipeline).to_list(length=page_size)

    results = []
    for g in gaps:
        min_price = g.get("min_comp_price", 0)
        # Suggested price is usually 1-5% lower if we were to add it,
        # but for now let's just use min competitor price - 1
        suggested = min_price - 1 if min_price > 0 else 0

        results.append({
            "product_id": str(g["_id"]),
            "product_name": g.get("name"),
            "category": g.get("category"),
            "subcategory": g.get("subcategory"),
            "min_competitor_price": min_price,
            "suggested_price": suggested,
            "competitor_count": g.get("comp_count", 0)
        })

    return {
        "count": total,
        "results": results
    }
