from fastapi import APIRouter
from database import get_db

router = APIRouter()

@router.get("/cities/")
async def get_cities():
    """Get list of unique cities from product prices"""
    db = get_db()
    cities = await db.products.distinct("prices.city")
    # Filter out None values and sort
    # Frontend expects objects with id/slug/name
    valid_cities = sorted([c for c in cities if c])
    
    return [
        {"id": c, "slug": c, "name": c.capitalize()} 
        for c in valid_cities
    ]
