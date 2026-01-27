"""
Recommendations Router

Handles price optimization recommendations.
"""

from fastapi import APIRouter, HTTPException, Query
from typing import Optional
from bson import ObjectId
from datetime import datetime

from database import get_db

router = APIRouter()


@router.get("/recommendations/")
async def get_recommendations(status: Optional[str] = Query(None)):
    """Get recommendations, optionally filtered by status"""
    db = get_db()

    query = {}
    if status:
        query["status"] = status

    recommendations = await db.recommendations.find(query).sort("created_at", -1).limit(200).to_list(length=200)

    return [{**r, "_id": str(r["_id"]), "id": str(r["_id"])} for r in recommendations]


@router.post("/recommendations/{rec_id}/apply/")
async def apply_recommendation(rec_id: str):
    """Apply a recommendation"""
    db = get_db()

    if not ObjectId.is_valid(rec_id):
        raise HTTPException(status_code=400, detail="Invalid recommendation ID")

    rec = await db.recommendations.find_one({"_id": ObjectId(rec_id)})
    if not rec:
        raise HTTPException(status_code=404, detail="Recommendation not found")

    if rec["status"] == "APPLIED":
        raise HTTPException(status_code=400, detail="Recommendation already applied")

    # Update recommendation status
    await db.recommendations.update_one(
        {"_id": ObjectId(rec_id)},
        {"$set": {"status": "APPLIED", "applied_at": datetime.utcnow()}}
    )

    # If it's a price update, update the product's price
    if rec.get("action_type") == "LOWER_PRICE" and rec.get("product_id"):
        product_id = rec["product_id"]
        new_price = rec.get("recommended_price")

        if ObjectId.is_valid(product_id) and new_price:
            # Update our price in the product
            await db.products.update_one(
                {
                    "_id": ObjectId(product_id),
                    "prices.aggregator": OUR_COMPANY
                },
                {"$set": {"prices.$.price": new_price}}
            )

    return {"status": "success", "message": "Recommendation applied"}


@router.post("/recommendations/{rec_id}/reject/")
async def reject_recommendation(rec_id: str):
    """Reject a recommendation"""
    db = get_db()

    if not ObjectId.is_valid(rec_id):
        raise HTTPException(status_code=400, detail="Invalid recommendation ID")

    result = await db.recommendations.update_one(
        {"_id": ObjectId(rec_id)},
        {"$set": {"status": "REJECTED"}}
    )

    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Recommendation not found")

    return {"status": "success", "message": "Recommendation rejected"}


@router.post("/algorithm/run/")
async def run_algorithm():
    """Run pricing optimization algorithm to generate recommendations"""
    db = get_db()

    import os
    OUR_COMPANY = os.getenv("OUR_COMPANY_AGGREGATOR", "Рядом")

    new_recommendations = []

    # Get all products with prices
    products = await db.products.find({"prices": {"$exists": True, "$ne": []}}).to_list(length=10000)

    for product in products:
        prices = product.get("prices", [])

        our_price = None
        competitor_prices = []

        for p in prices:
            if p.get("aggregator") == OUR_COMPANY:
                our_price = p.get("price")
            elif p.get("price"):
                competitor_prices.append(p["price"])

        if not competitor_prices:
            continue

        min_competitor = min(competitor_prices)

        # Case 1: We have the product but price is higher
        if our_price and our_price > min_competitor:
            rec = {
                "product_id": str(product["_id"]),
                "product_name": product.get("name", ""),
                "action_type": "LOWER_PRICE",
                "current_price": our_price,
                "recommended_price": round(min_competitor - 1, 2),
                "competitor_price": min_competitor,
                "potential_savings": round(our_price - min_competitor, 2),
                "priority": "HIGH" if (our_price - min_competitor) > 100 else "MEDIUM",
                "status": "PENDING",
                "reason": f"Наша цена выше минимума конкурентов на {round(our_price - min_competitor, 2)} тг",
                "created_at": datetime.utcnow()
            }

            # Check if similar recommendation already exists
            existing = await db.recommendations.find_one({
                "product_id": str(product["_id"]),
                "status": "PENDING"
            })

            if not existing:
                await db.recommendations.insert_one(rec)
                new_recommendations.append(rec)

        # Case 2: We don't have the product
        elif our_price is None:
            rec = {
                "product_id": str(product["_id"]),
                "product_name": product.get("name", ""),
                "action_type": "ADD_PRODUCT",
                "current_price": None,
                "recommended_price": round(min_competitor - 1, 2),
                "competitor_price": min_competitor,
                "potential_savings": None,
                "priority": "LOW",
                "status": "PENDING",
                "reason": f"Товар есть у конкурентов по цене от {min_competitor} тг",
                "created_at": datetime.utcnow()
            }

            existing = await db.recommendations.find_one({
                "product_id": str(product["_id"]),
                "status": "PENDING"
            })

            if not existing:
                await db.recommendations.insert_one(rec)
                new_recommendations.append(rec)

    return {
        "status": "success",
        "new_recommendations": len(new_recommendations),
        "recommendations": new_recommendations[:50]
    }
