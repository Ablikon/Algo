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

OUR_COMPANY = os.getenv("OUR_COMPANY_AGGREGATOR", "Glovo")


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
                        "cond": {"$eq": ["$$p.aggregator", OUR_COMPANY]}
                    }
                },
                "competitor_prices": {
                    "$filter": {
                        "input": {"$ifNull": ["$prices", []]},
                        "as": "p",
                        "cond": {"$ne": ["$$p.aggregator", OUR_COMPANY]}
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
                                    {"$lte": ["$our_price", "$min_competitor_price"]}
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
        {"$match": {"prices.aggregator": {"$ne": OUR_COMPANY}}},
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
