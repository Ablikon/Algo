"""
Aggregators Router

Handles aggregator listing.
"""

from fastapi import APIRouter
import os

from database import get_db

router = APIRouter()

OUR_COMPANY = os.getenv("OUR_COMPANY_AGGREGATOR", "Glovo")


@router.get("/aggregators/")
async def get_aggregators():
    """Get all aggregators"""
    db = get_db()
    
    aggregators = await db.aggregators.find().to_list(length=20)
    
    result = []
    for a in aggregators:
        result.append({
            "id": str(a["_id"]),
            "name": a["name"],
            "color": a.get("color", "#666666"),
            "logo_url": a.get("logo_url"),
            "is_our_company": a["name"] == OUR_COMPANY,
            "product_count": a.get("product_count", 0)
        })
    
    return result
