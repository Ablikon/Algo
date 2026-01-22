"""
Data Import Router

Handles importing products from JSON files.
Supports all 6 aggregator formats: Arbuz, Glovo, Wolt, Yandex Lavka, Magnum, Airba.
"""

from fastapi import APIRouter, HTTPException, BackgroundTasks, UploadFile, File, Form
from pathlib import Path
import os
import logging
import json
import tempfile

from database import get_db
from models import ImportRequest, ImportResult
from services.data_importer import DataImporter
from services.product_mapper import MATCHING_STATUS

router = APIRouter()
logger = logging.getLogger(__name__)

# Path to data folder
DATA_PATH = Path(__file__).parent.parent.parent / "Data"


@router.get("/import/json/info/")
async def get_json_import_info():
    """Get information about available JSON files"""
    
    aggregator_files = {
        'glovo': 'glovo.glovo_products.json',
        'arbuz': 'arbuz_kz.arbuz_products.json',
        'wolt': 'wolt.wolt_products.json',
        'yandex': 'yandex_lavka.products.json',
        'magnum_almaty': 'magnum_almaty.json',
        'magnum_astana': 'magnum_astana.json',
        'airba': 'airba_fresh.airba_products.json',
    }
    
    files = []
    for agg, filename in aggregator_files.items():
        filepath = DATA_PATH / filename
        if filepath.exists():
            size_mb = filepath.stat().st_size / (1024 * 1024)
            files.append({
                'aggregator': agg,
                'filename': filename,
                'size_mb': round(size_mb, 2),
                'exists': True
            })
        else:
            files.append({
                'aggregator': agg,
                'filename': filename,
                'exists': False
            })
    
    return {
        'files': files,
        'data_path': str(DATA_PATH)
    }


@router.post("/import/json/", response_model=ImportResult)
async def import_from_json(request: ImportRequest, background_tasks: BackgroundTasks):
    """
    Import products from JSON files.

    Imports all products from all aggregators' JSON files into MongoDB.
    Products are parsed, normalized, and stored with embedded prices.
    """
    db = get_db()
    importer = DataImporter(db, DATA_PATH)

    try:
        result = await importer.import_all(
            aggregators=request.aggregators,
            limit_per_aggregator=request.limit_per_aggregator,
            dry_run=request.dry_run
        )

        # Update category counts in background
        if not request.dry_run:
            background_tasks.add_task(update_category_counts, db)

        return result

    except Exception as e:
        logger.error(f"Import error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/import/upload-json/")
async def upload_json_file(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    dry_run: str = Form("false")
):
    """
    Upload and import a JSON file.

    Accepts JSON files in the same format as files in the Data folder.
    The aggregator name is extracted from the filename or data.
    """
    if not file.filename.endswith('.json'):
        raise HTTPException(status_code=400, detail="Only JSON files are accepted")

    db = get_db()

    try:
        # Read file content
        content = await file.read()
        data = json.loads(content.decode('utf-8'))

        if not isinstance(data, list):
            data = [data]

        # Detect aggregator from filename or data
        aggregator_name = _detect_aggregator(file.filename, data)

        # Parse dry_run from form data
        is_dry_run = dry_run.lower() in ('true', '1', 'yes')

        # Import using DataImporter logic
        importer = DataImporter(db, DATA_PATH)

        # Ensure aggregators exist
        await importer._ensure_aggregators()

        # Process the data
        result = await _process_uploaded_json(
            db=db,
            importer=importer,
            data=data,
            aggregator_name=aggregator_name,
            dry_run=is_dry_run
        )

        # Update category counts in background
        if not is_dry_run:
            background_tasks.add_task(update_category_counts, db)

        return result

    except json.JSONDecodeError as e:
        logger.error(f"JSON decode error: {e}")
        raise HTTPException(status_code=400, detail=f"Invalid JSON file: {str(e)}")
    except Exception as e:
        logger.error(f"Upload import error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


def _detect_aggregator(filename: str, data: list) -> str:
    """Detect aggregator name from filename or data content"""
    filename_lower = filename.lower()

    # Check filename patterns
    if 'glovo' in filename_lower:
        return 'Glovo'
    elif 'arbuz' in filename_lower:
        return 'Arbuz.kz'
    elif 'wolt' in filename_lower:
        return 'Wolt'
    elif 'yandex' in filename_lower or 'lavka' in filename_lower:
        return 'Yandex Lavka'
    elif 'magnum' in filename_lower:
        return 'Magnum'
    elif 'airba' in filename_lower:
        return 'Airba Fresh'

    # Check data content
    if data and len(data) > 0:
        first_item = data[0]
        mercant = first_item.get('mercant_name') or first_item.get('mercant_id') or ''
        mercant_lower = mercant.lower()

        if 'glovo' in mercant_lower:
            return 'Glovo'
        elif 'arbuz' in mercant_lower:
            return 'Arbuz.kz'
        elif 'wolt' in mercant_lower:
            return 'Wolt'
        elif 'yandex' in mercant_lower or 'lavka' in mercant_lower:
            return 'Yandex Lavka'
        elif 'magnum' in mercant_lower:
            return 'Magnum'
        elif 'airba' in mercant_lower:
            return 'Airba Fresh'

    # Default to filename without extension
    return filename.replace('.json', '').replace('_', ' ').title()


async def _process_uploaded_json(
    db,
    importer: DataImporter,
    data: list,
    aggregator_name: str,
    dry_run: bool
) -> dict:
    """Process uploaded JSON data"""
    from datetime import datetime

    stats = {
        'total_read': 0,
        'total_imported': 0,
        'errors': 0,
        'by_aggregator': {aggregator_name: 0},
        'by_category': {}
    }
    error_messages = []

    batch = []
    batch_size = 500

    for item in data:
        stats['total_read'] += 1

        # Parse product using importer's method
        parsed = importer._parse_product(item, aggregator_name.lower())

        if not parsed.get('name'):
            stats['errors'] += 1
            continue

        # Track categories
        category = parsed.get('category') or 'Без категории'
        if category not in stats['by_category']:
            stats['by_category'][category] = 0
        stats['by_category'][category] += 1

        if not dry_run:
            # Determine city from data
            city = parsed.get('city') or 'almaty'

            batch.append({
                'parsed': parsed,
                'aggregator': aggregator_name,
                'city': city
            })

            if len(batch) >= batch_size:
                await importer._process_batch(batch)
                batch = []

        stats['by_aggregator'][aggregator_name] += 1
        stats['total_imported'] += 1

    # Process remaining batch
    if batch and not dry_run:
        await importer._process_batch(batch)

    return {
        'status': 'completed' if not error_messages else 'completed_with_errors',
        'total_read': stats['total_read'],
        'total_imported': stats['total_imported'],
        'errors': stats['errors'],
        'by_aggregator': stats['by_aggregator'],
        'by_category': stats['by_category'],
        'error_messages': error_messages[:20]
    }


@router.post("/import/run-matching/")
async def run_product_matching(
    background_tasks: BackgroundTasks,
    batch_size: int = 10,
    use_ai: bool = True
):
    """
    Run product matching/mapping for unmapped products.
    Uses AI (ChatGPT) to match products across aggregators.
    """
    from services.product_mapper import ProductMapper
    
    db = get_db()
    mapper = ProductMapper(db)
    
    db = get_db()
    mapper = ProductMapper(db)
    
    if MATCHING_STATUS['is_running']:
        return {"result": "already_running", "status": MATCHING_STATUS}

    background_tasks.add_task(mapper.run_matching, batch_size, use_ai)
    
    return {"result": "started", "status": "background_task_initiated"}

@router.get("/import/matching-progress")
async def get_matching_progress():
    """Get current status of product matching process"""
    return MATCHING_STATUS


async def update_category_counts(db):
    """Update product counts for categories"""
    try:
        # Get counts by category
        pipeline = [
            {"$group": {"_id": "$category", "count": {"$sum": 1}}}
        ]
        results = await db.products.aggregate(pipeline).to_list(length=1000)
        
        for r in results:
            if r["_id"]:
                await db.categories.update_one(
                    {"name": r["_id"]},
                    {
                        "$set": {"product_count": r["count"]},
                        "$setOnInsert": {
                            "name": r["_id"],
                            "parent_id": None,
                            "sort_order": 0,
                            "icon": None
                        }
                    },
                    upsert=True
                )
        
        # Get counts by subcategory
        pipeline = [
            {"$group": {"_id": {"sub": "$subcategory", "parent": "$category"}, "count": {"$sum": 1}}}
        ]
        results = await db.products.aggregate(pipeline).to_list(length=1000)
        
        for r in results:
            sub = r["_id"].get("sub")
            parent = r["_id"].get("parent")
            
            if sub and sub != parent:
                # Find parent id
                parent_doc = await db.categories.find_one({"name": parent})
                parent_id = str(parent_doc["_id"]) if parent_doc else None
                
                await db.categories.update_one(
                    {"name": sub},
                    {
                        "$set": {
                            "product_count": r["count"],
                            "parent_id": parent_id
                        },
                        "$setOnInsert": {
                            "name": sub,
                            "sort_order": 0,
                            "icon": None
                        }
                    },
                    upsert=True
                )
        
        logger.info("Category counts updated")
    except Exception as e:
        logger.error(f"Error updating category counts: {e}")


@router.get("/analytics/gaps/")
async def get_analytics_gaps(limit: int = 100):
    """Get products that we don't have but competitors do"""
    db = get_db()
    
    OUR_COMPANY = os.getenv("OUR_COMPANY_AGGREGATOR", "Glovo")
    
    pipeline = [
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
            "$match": {
                "$expr": {
                    "$and": [
                        {"$eq": [{"$size": "$our_prices"}, 0]},
                        {"$gt": [{"$size": "$competitor_prices"}, 0]}
                    ]
                }
            }
        },
        {
            "$addFields": {
                "min_competitor_price": {"$min": "$competitor_prices.price"}
            }
        },
        {"$limit": limit},
        {
            "$project": {
                "_id": 0,
                "product_id": {"$toString": "$_id"},
                "product_name": "$name",
                "category": 1,
                "min_competitor_price": 1,
                "suggested_price": {"$subtract": ["$min_competitor_price", 1]}
            }
        }
    ]
    
    gaps = await db.products.aggregate(pipeline).to_list(length=limit)
    
    return gaps


@router.get("/price-history/")
async def get_price_history(limit: int = 50):
    """Get recent price changes"""
    db = get_db()
    
    history = await db.price_history.find().sort("changed_at", -1).limit(limit).to_list(length=limit)
    
    return [{**h, "_id": str(h["_id"])} for h in history]


@router.get("/export/products/")
async def export_products():
    """Export products to JSON (simplified Excel alternative)"""
    db = get_db()
    
    products = await db.products.find().limit(5000).to_list(length=5000)
    
    export_data = []
    for p in products:
        row = {
            "name": p.get("name"),
            "category": p.get("category"),
            "subcategory": p.get("subcategory"),
            "brand": p.get("brand"),
            "weight": f"{p.get('weight_value', '')} {p.get('weight_unit', '')}".strip(),
        }
        
        for price in p.get("prices", []):
            row[price["aggregator"]] = price.get("price")
        
        export_data.append(row)
    
    return export_data
