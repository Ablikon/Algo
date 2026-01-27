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
from typing import Optional

from database import get_db
from models import ImportRequest, ImportResult
from services.data_importer import DataImporter
from services.product_mapper import MATCHING_STATUS
from services.external_import import import_from_external_api, get_external_import_status
from services.ryadom_importer import RyadomCsvImporter
from services.mapping_review import MappingReviewService

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


@router.post("/import/ryadom-csv/")
async def import_ryadom_csv(
    background_tasks: BackgroundTasks,
    filename: str = "bq-results-20260120-103930-1768905602731.csv",
    dry_run: bool = False,
    limit: Optional[int] = None,
    city: str = "almaty",
):
    db = get_db()
    aggregator_name = os.getenv("OUR_COMPANY_AGGREGATOR", "Рядом")
    importer = RyadomCsvImporter(db, aggregator=aggregator_name, city=city)
    file_path = DATA_PATH / filename

    try:
        result = await importer.import_csv(
            file_path=file_path,
            dry_run=dry_run,
            limit=limit,
        )
        if not dry_run:
            background_tasks.add_task(update_category_counts, db)
        return result
    except Exception as e:
        logger.error(f"Ryadom CSV import error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/import/mapped/review-file/")
async def review_mapped_file(
    filename: str,
    source_aggregator: str = "Рядом",
    matched_aggregator: Optional[str] = None,
    limit: Optional[int] = None,
):
    db = get_db()
    service = MappingReviewService(db)
    file_path = DATA_PATH / filename

    if not file_path.exists():
        raise HTTPException(status_code=404, detail=f"File not found: {filename}")

    try:
        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)
    except Exception as e:
        logger.error(f"Failed to read mapped file: {e}")
        raise HTTPException(status_code=400, detail=str(e))

    if isinstance(data, dict):
        data = data.get("data") or data.get("items") or data.get("products") or []
    if not isinstance(data, list):
        raise HTTPException(status_code=400, detail="Invalid mapped file format")

    if limit:
        data = data[:limit]

    return await service.review_mapped_items(
        mapped_items=data,
        source_aggregator=source_aggregator,
        matched_aggregator=matched_aggregator,
    )


@router.post("/import/mapped/review-upload/")
async def review_mapped_upload(
    file: UploadFile = File(...),
    source_aggregator: str = "Рядом",
    matched_aggregator: Optional[str] = None,
    limit: Optional[int] = None,
):
    db = get_db()
    service = MappingReviewService(db)

    try:
        content = await file.read()
        data = json.loads(content.decode("utf-8"))
    except Exception as e:
        logger.error(f"Mapped upload decode error: {e}")
        raise HTTPException(status_code=400, detail="Invalid JSON file")

    if isinstance(data, dict):
        data = data.get("data") or data.get("items") or data.get("products") or []
    if not isinstance(data, list):
        raise HTTPException(status_code=400, detail="Invalid mapped file format")

    if limit:
        data = data[:limit]

    return await service.review_mapped_items(
        mapped_items=data,
        source_aggregator=source_aggregator,
        matched_aggregator=matched_aggregator,
    )


@router.post("/import/mapped/review-from-api/")
async def review_mapped_from_api(
    file_id: str,
    source_aggregator: str = "Рядом",
    matched_aggregator: Optional[str] = None,
    limit: Optional[int] = None,
):
    """
    Review mapped file directly from external API.
    file_id examples: wolt_wolt market_almaty_mapped, yandex_lavka_almaty_mapped
    """
    import httpx
    from urllib.parse import quote

    EXTERNAL_API_BASE = os.getenv("EXTERNAL_API_BASE")
    EXTERNAL_API_TOKEN = os.getenv("EXTERNAL_API_TOKEN")

    if not EXTERNAL_API_BASE or not EXTERNAL_API_TOKEN:
        raise HTTPException(status_code=500, detail="External API not configured")

    db = get_db()
    service = MappingReviewService(db)

    headers = {"Authorization": f"Bearer {EXTERNAL_API_TOKEN}"}
    encoded_id = quote(str(file_id), safe="")

    try:
        async with httpx.AsyncClient(timeout=120) as client:
            response = await client.get(
                f"{EXTERNAL_API_BASE}/api/csv-data/{encoded_id}",
                headers=headers
            )
            response.raise_for_status()
            payload = response.json()
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail=f"API error: {e.response.text}")
    except Exception as e:
        logger.error(f"Failed to fetch mapped file from API: {e}")
        raise HTTPException(status_code=500, detail=str(e))

    data = payload.get("data") or payload.get("items") or payload.get("products") or []
    if not isinstance(data, list):
        raise HTTPException(status_code=400, detail="Invalid mapped file format from API")

    if limit:
        data = data[:limit]

    return await service.review_mapped_items(
        mapped_items=data,
        source_aggregator=source_aggregator,
        matched_aggregator=matched_aggregator,
    )


@router.get("/import/mapped/api-files/")
async def list_mapped_api_files():
    """List available mapped files from external API"""
    import httpx

    EXTERNAL_API_BASE = os.getenv("EXTERNAL_API_BASE")
    EXTERNAL_API_TOKEN = os.getenv("EXTERNAL_API_TOKEN")

    if not EXTERNAL_API_BASE or not EXTERNAL_API_TOKEN:
        raise HTTPException(status_code=500, detail="External API not configured")

    headers = {"Authorization": f"Bearer {EXTERNAL_API_TOKEN}"}

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.get(f"{EXTERNAL_API_BASE}/api/csv-files", headers=headers)
            response.raise_for_status()
            payload = response.json()
    except Exception as e:
        logger.error(f"Failed to fetch file list from API: {e}")
        raise HTTPException(status_code=500, detail=str(e))

    files = payload.get("files", []) if isinstance(payload, dict) else []
    # Filter only mapped files
    mapped_files = [f for f in files if "mapped" in f.get("id", "").lower()]

    return {
        "success": True,
        "count": len(mapped_files),
        "files": mapped_files
    }


@router.post("/import/external/run/")
async def run_external_import(
    background_tasks: BackgroundTasks,
    dry_run: bool = False,
    limit_per_file: Optional[int] = None,
    file_id: Optional[str] = None
):
    status = get_external_import_status()
    if status.get("is_running"):
        return {"result": "already_running", "status": status}

    file_ids = [file_id] if file_id else None
    background_tasks.add_task(
        import_from_external_api,
        file_ids=file_ids,
        dry_run=dry_run,
        limit_per_file=limit_per_file
    )
    return {"result": "started", "status": "background_task_initiated"}


@router.get("/import/external/progress")
async def get_external_import_progress():
    return get_external_import_status()


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

    OUR_COMPANY = os.getenv("OUR_COMPANY_AGGREGATOR", "Рядом")

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
