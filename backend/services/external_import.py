import os
import json
import logging
import re
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import quote
import httpx

from database import get_db
from services.data_importer import DataImporter
from services.ryadom_matcher import RyadomMatcher

logger = logging.getLogger(__name__)

EXTERNAL_API_BASE = os.getenv("EXTERNAL_API_BASE")
EXTERNAL_API_TOKEN = os.getenv("EXTERNAL_API_TOKEN")
OUR_COMPANY = os.getenv("OUR_COMPANY_AGGREGATOR", "Рядом")

# Progress tracker for external imports
EXTERNAL_IMPORT_STATUS: Dict[str, Any] = {
    "is_running": False,
    "total_files": 0,
    "processed_files": 0,
    "total_items": 0,
    "processed_items": 0,
    "imported_items": 0,
    "errors": 0,
    "current_file": None,
    "current_item": None,
    "last_error": None,
}

# Known file ID patterns to aggregator config
FILE_CONFIG_MAP = {
    "magnum_almaty": {"aggregator": "Magnum", "default_city": "almaty"},
    "magnum_astana": {"aggregator": "Magnum", "default_city": "astana"},
    "glovo": {"aggregator": "Glovo", "default_city": "almaty"},
    "glovo_almaty": {"aggregator": "Glovo", "default_city": "almaty"},
    "glovo_astana": {"aggregator": "Glovo", "default_city": "astana"},
    "wolt": {"aggregator": "Wolt", "default_city": "almaty"},
    "wolt_almaty": {"aggregator": "Wolt", "default_city": "almaty"},
    "yandex_lavka": {"aggregator": "Yandex Lavka", "default_city": "almaty"},
    "yandex_lavka_almaty": {"aggregator": "Yandex Lavka", "default_city": "almaty"},
    "airba_fresh": {"aggregator": "Airba Fresh", "default_city": "almaty"},
    "airba_fresh_almaty": {"aggregator": "Airba Fresh", "default_city": "almaty"},
    "arbuz": {"aggregator": "Arbuz.kz", "default_city": "almaty"},
    "arbuz_almaty": {"aggregator": "Arbuz.kz", "default_city": "almaty"},
    "ryadom": {"aggregator": "Рядом", "default_city": "almaty"},
}

AGGREGATOR_KEYWORDS = {
    "magnum": "Magnum",
    "glovo": "Glovo",
    "wolt": "Wolt",
    "yandex_lavka": "Yandex Lavka",
    "airba": "Airba Fresh",
    "arbuz": "Arbuz.kz",
    "ryadom": "Рядом",
}

CITY_KEYWORDS = {
    "almaty": "almaty",
    "astana": "astana",
}


def _normalize_text(text: Optional[str]) -> str:
    if not text:
        return ""
    return " ".join(str(text).lower().strip().split())


def _parse_weight_value(text: Optional[str]) -> Optional[float]:
    if not text:
        return None
    match = re.search(r"(\d+[.,]?\d*)\s*(кг|kg|л|l|мл|ml|г|g|гр)\b", str(text).lower())
    if not match:
        return None
    value = float(match.group(1).replace(",", "."))
    unit = match.group(2)
    if unit in ("kg", "кг"):
        return value * 1000
    if unit in ("l", "л"):
        return value * 1000
    return value


def _weight_from_product(product: Dict[str, Any]) -> Optional[float]:
    val = product.get("weight_value")
    unit = (product.get("weight_unit") or "").lower()
    if val is None:
        return _parse_weight_value(product.get("name"))
    try:
        val = float(val)
    except Exception:
        return None
    if unit in ("kg", "кг"):
        return val * 1000
    if unit in ("l", "л"):
        return val * 1000
    return val


def _build_ryadom_key(name: Optional[str], brand: Optional[str] = None, weight: Optional[float] = None) -> str:
    base = _normalize_text(name)
    if not base:
        return ""
    parts = [base]
    if brand:
        parts.append(_normalize_text(brand))
    if weight:
        parts.append(str(int(weight)))
    return "|".join(parts)


async def _build_ryadom_index(db) -> Tuple[Dict[str, Dict[str, Any]], List[Dict[str, Any]]]:
    if not OUR_COMPANY:
        return {}, []
    cursor = db.products.find(
        {"prices.aggregator": OUR_COMPANY},
        {"name": 1, "brand": 1, "category": 1, "subcategory": 1, "weight_value": 1, "weight_unit": 1}
    )
    index: Dict[str, Dict[str, Any]] = {}
    candidates: List[Dict[str, Any]] = []
    async for doc in cursor:
        name = doc.get("name")
        if not name:
            continue
        candidates.append(doc)
        brand = doc.get("brand")
        weight = _weight_from_product(doc)
        key_with_weight = _build_ryadom_key(name, brand, weight)
        if key_with_weight and key_with_weight not in index:
            index[key_with_weight] = doc
        key_brand = _build_ryadom_key(name, brand, None)
        if key_brand and key_brand not in index:
            index[key_brand] = doc
        key_name = _build_ryadom_key(name, None, None)
        if key_name and key_name not in index:
            index[key_name] = doc
    return index, candidates


def _match_ryadom_product(
    parsed: Dict[str, Any],
    ryadom_index: Dict[str, Dict[str, Any]],
    ryadom_candidates: List[Dict[str, Any]],
    matcher: Optional[RyadomMatcher] = None,
) -> Optional[Dict[str, Any]]:
    if not ryadom_index and not ryadom_candidates:
        return None
    name = parsed.get("name")
    if not name:
        return None
    brand = parsed.get("brand")
    weight = _parse_weight_value(parsed.get("measure")) or _parse_weight_value(name)
    key_with_weight = _build_ryadom_key(name, brand, weight)
    if key_with_weight and key_with_weight in ryadom_index:
        return ryadom_index[key_with_weight]
    key_brand = _build_ryadom_key(name, brand, None)
    if key_brand and key_brand in ryadom_index:
        return ryadom_index[key_brand]
    key_name = _build_ryadom_key(name, None, None)
    exact = ryadom_index.get(key_name)
    if exact:
        return exact

    if matcher and ryadom_candidates:
        match_result = matcher.match(parsed, ryadom_candidates)
        if match_result.get("best_match") == "match":
            return match_result.get("matched_item")

    return None


def get_external_import_status() -> Dict[str, Any]:
    return EXTERNAL_IMPORT_STATUS


def _reset_status() -> None:
    EXTERNAL_IMPORT_STATUS.update({
        "is_running": False,
        "total_files": 0,
        "processed_files": 0,
        "total_items": 0,
        "processed_items": 0,
        "imported_items": 0,
        "errors": 0,
        "current_file": None,
        "current_item": None,
        "last_error": None,
    })


def _resolve_config(file_id: str, filename: Optional[str] = None) -> Optional[Dict[str, str]]:
    clean_id = (file_id or "").replace("_mapped", "").replace("_products", "")
    if clean_id in FILE_CONFIG_MAP:
        return FILE_CONFIG_MAP[clean_id]

    haystack = f"{file_id or ''} {filename or ''}".lower()

    aggregator_name = None
    for key, value in AGGREGATOR_KEYWORDS.items():
        if key in haystack:
            aggregator_name = value
            break

    if not aggregator_name:
        return None

    city = "almaty"
    for key, value in CITY_KEYWORDS.items():
        if key in haystack:
            city = value
            break

    return {"aggregator": aggregator_name, "default_city": city}


def _extract_items(payload: Any) -> List[Dict[str, Any]]:
    if isinstance(payload, list):
        return payload
    if isinstance(payload, dict):
        return payload.get("data") or payload.get("items") or payload.get("products") or []
    return []


async def _fetch_json(client: httpx.AsyncClient, url: str, headers: Dict[str, str]) -> Any:
    response = await client.get(url, headers=headers)
    response.raise_for_status()
    return response.json()


async def import_from_external_api(
    file_ids: Optional[List[str]] = None,
    dry_run: bool = False,
    limit_per_file: Optional[int] = None,
    batch_size: int = 500,
) -> Dict[str, Any]:
    if not EXTERNAL_API_BASE or not EXTERNAL_API_TOKEN:
        raise RuntimeError("External API not configured")

    db = get_db()
    importer = DataImporter(db, data_path=None)

    _reset_status()
    EXTERNAL_IMPORT_STATUS["is_running"] = True

    headers = {"Authorization": f"Bearer {EXTERNAL_API_TOKEN}"}
    results: Dict[str, Any] = {
        "status": "completed",
        "total_files": 0,
        "processed_files": 0,
        "total_items": 0,
        "imported_items": 0,
        "errors": 0,
        "by_aggregator": {},
        "error_messages": [],
    }

    try:
        async with httpx.AsyncClient(timeout=300) as client:
            files_payload = await _fetch_json(client, f"{EXTERNAL_API_BASE}/api/csv-files", headers)
            files = files_payload.get("files", []) if isinstance(files_payload, dict) else []

            if file_ids:
                files = [f for f in files if f.get("id") in set(file_ids)]

            results["total_files"] = len(files)
            EXTERNAL_IMPORT_STATUS["total_files"] = len(files)

            await importer._ensure_aggregators()

            ryadom_index, ryadom_candidates = await _build_ryadom_index(db)
            ryadom_matcher = RyadomMatcher()

            for file_info in files:
                file_id = file_info.get("id")
                filename = file_info.get("filename", file_id)
                EXTERNAL_IMPORT_STATUS["current_file"] = filename

                config = _resolve_config(file_id, filename)
                if not config:
                    msg = f"Unknown file config: {filename}"
                    results["errors"] += 1
                    results["error_messages"].append(msg)
                    EXTERNAL_IMPORT_STATUS["errors"] += 1
                    EXTERNAL_IMPORT_STATUS["last_error"] = msg
                    continue

                encoded_id = quote(str(file_id), safe="")
                data_payload = await _fetch_json(
                    client,
                    f"{EXTERNAL_API_BASE}/api/csv-data/{encoded_id}",
                    headers
                )

                items = _extract_items(data_payload)
                if not isinstance(items, list):
                    items = []

                if limit_per_file:
                    items = items[:limit_per_file]

                results["total_items"] += len(items)
                EXTERNAL_IMPORT_STATUS["total_items"] += len(items)

                # Process in batches
                batch: List[Dict[str, Any]] = []
                for idx, item in enumerate(items):
                    EXTERNAL_IMPORT_STATUS["processed_items"] += 1
                    EXTERNAL_IMPORT_STATUS["current_item"] = (
                        item.get("title") or item.get("name") or f"{idx + 1}/{len(items)}"
                    )

                    parsed = importer._parse_product(item, config["aggregator"].lower())

                    matched = _match_ryadom_product(
                        parsed,
                        ryadom_index,
                        ryadom_candidates,
                        ryadom_matcher,
                    )
                    if matched:
                        parsed["name"] = matched.get("name") or parsed.get("name")
                        parsed["brand"] = matched.get("brand") or parsed.get("brand")
                        parsed["category"] = matched.get("category") or parsed.get("category")
                        parsed["subcategory"] = matched.get("subcategory") or parsed.get("subcategory")

                    if not parsed.get("name"):
                        results["errors"] += 1
                        EXTERNAL_IMPORT_STATUS["errors"] += 1
                        EXTERNAL_IMPORT_STATUS["last_error"] = "Missing product name in item"
                        continue

                    if not dry_run:
                        batch.append({
                            "parsed": parsed,
                            "aggregator": config["aggregator"],
                            "city": parsed.get("city") or config["default_city"],
                        })

                        if len(batch) >= batch_size:
                            await importer._process_batch(batch)
                            batch = []

                    results["imported_items"] += 1
                    EXTERNAL_IMPORT_STATUS["imported_items"] += 1
                    results["by_aggregator"].setdefault(config["aggregator"], 0)
                    results["by_aggregator"][config["aggregator"]] += 1

                if batch and not dry_run:
                    await importer._process_batch(batch)

                results["processed_files"] += 1
                EXTERNAL_IMPORT_STATUS["processed_files"] += 1

    except Exception as exc:
        msg = str(exc)
        logger.error(f"External import failed: {msg}")
        results["status"] = "failed"
        results["errors"] += 1
        results["error_messages"].append(msg)
        EXTERNAL_IMPORT_STATUS["errors"] += 1
        EXTERNAL_IMPORT_STATUS["last_error"] = msg
    finally:
        EXTERNAL_IMPORT_STATUS["is_running"] = False
        EXTERNAL_IMPORT_STATUS["current_file"] = None
        EXTERNAL_IMPORT_STATUS["current_item"] = None

    return results
