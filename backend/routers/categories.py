"""
Categories Router

Handles category listing and tree structure.
"""

from fastapi import APIRouter, HTTPException
from typing import List
from bson import ObjectId

from database import get_db
from models import CategoryBase, CategoryTreeResponse

router = APIRouter()


@router.get("/categories/")
async def get_categories():
    """Get all categories with product counts"""
    db = get_db()
    
    categories = await db.categories.find().sort("sort_order", 1).to_list(length=1000)
    
    return [{**c, "_id": str(c["_id"]), "id": str(c["_id"])} for c in categories]


@router.get("/categories/tree/")
async def get_categories_tree():
    """Get categories as hierarchical tree"""
    db = get_db()
    
    categories = await db.categories.find().sort("sort_order", 1).to_list(length=1000)
    
    # Build tree structure
    cat_map = {}
    root_categories = []
    
    for cat in categories:
        cat_id = str(cat["_id"])
        cat_map[cat_id] = {
            "id": cat_id,
            "name": cat["name"],
            "icon": cat.get("icon"),
            "product_count": cat.get("product_count", 0),
            "children": []
        }
    
    for cat in categories:
        cat_id = str(cat["_id"])
        parent_id = cat.get("parent_id")
        
        if parent_id and parent_id in cat_map:
            cat_map[parent_id]["children"].append(cat_map[cat_id])
        else:
            root_categories.append(cat_map[cat_id])
    
    return root_categories


@router.post("/categories/")
async def create_category(category: CategoryBase):
    """Create a new category"""
    db = get_db()
    
    doc = category.model_dump()
    result = await db.categories.insert_one(doc)
    doc["_id"] = str(result.inserted_id)
    doc["id"] = doc["_id"]
    
    return doc


@router.patch("/categories/{category_id}")
async def update_category(category_id: str, category: CategoryBase):
    """Update a category"""
    db = get_db()
    
    if not ObjectId.is_valid(category_id):
        raise HTTPException(status_code=400, detail="Invalid category ID")
    
    result = await db.categories.update_one(
        {"_id": ObjectId(category_id)},
        {"$set": category.model_dump(exclude_unset=True)}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Category not found")
    
    return {"status": "updated"}


@router.delete("/categories/{category_id}")
async def delete_category(category_id: str):
    """Delete a category"""
    db = get_db()
    
    if not ObjectId.is_valid(category_id):
        raise HTTPException(status_code=400, detail="Invalid category ID")
    
    result = await db.categories.delete_one({"_id": ObjectId(category_id)})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Category not found")
    
    return {"status": "deleted"}


@router.post("/reset-categories/")
async def reset_categories():
    """Reset all categories and recreate from scratch"""
    db = get_db()
    
    # Delete all categories
    await db.categories.delete_many({})
    
    # Get unique categories from products
    pipeline = [
        {"$group": {
            "_id": {"category": "$category", "subcategory": "$subcategory"},
            "count": {"$sum": 1}
        }}
    ]
    
    results = await db.products.aggregate(pipeline).to_list(length=1000)
    
    # Create parent categories
    parent_cats = {}
    for r in results:
        cat_name = r["_id"].get("category")
        if cat_name and cat_name not in parent_cats:
            doc = {"name": cat_name, "parent_id": None, "sort_order": len(parent_cats), "product_count": 0}
            result = await db.categories.insert_one(doc)
            parent_cats[cat_name] = str(result.inserted_id)
    
    # Create subcategories
    created = len(parent_cats)
    for r in results:
        subcat_name = r["_id"].get("subcategory")
        parent_name = r["_id"].get("category")
        
        if subcat_name and subcat_name != parent_name:
            parent_id = parent_cats.get(parent_name)
            doc = {
                "name": subcat_name,
                "parent_id": parent_id,
                "sort_order": 0,
                "product_count": r["count"]
            }
            await db.categories.insert_one(doc)
            created += 1
    
    return {"status": "success", "categories_created": created}
