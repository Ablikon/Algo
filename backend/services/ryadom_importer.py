"""
Ryadom CSV Catalog Importer

Imports products from the Рядом CSV catalog into MongoDB.
Supports basic normalization, category mapping, and weight parsing.
Optimized with bulk operations for fast imports.

Expected columns (examples):
- name, name_origin, name_short
- brand_name
- category_1, category_2, category_3
- weight
- ntin, slug
"""

import csv
import logging
import re
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Tuple

from pymongo import UpdateOne

logger = logging.getLogger(__name__)


WEIGHT_PATTERN = re.compile(
    r"(?P<value>\d+(?:[.,]\d+)?)\s*(?P<unit>кг|kg|г|g|гр|л|l|мл|ml|шт|pcs)\b",
    re.IGNORECASE,
)


UNIT_MAP = {
    "кг": "kg",
    "kg": "kg",
    "г": "g",
    "g": "g",
    "гр": "g",
    "л": "l",
    "l": "l",
    "мл": "ml",
    "ml": "ml",
    "шт": "pcs",
    "pcs": "pcs",
}


@dataclass
class ImportStats:
    total_read: int = 0
    total_imported: int = 0
    errors: int = 0
    by_category: Dict[str, int] = None

    def __post_init__(self) -> None:
        if self.by_category is None:
            self.by_category = {}


class RyadomCsvImporter:
    def __init__(self, db, aggregator: str = "Рядом", city: str = "almaty") -> None:
        self.db = db
        self.aggregator = aggregator
        self.city = city
        self.stats = ImportStats()
        self.error_messages: List[str] = []

    async def import_csv(
        self,
        file_path: str | Path,
        batch_size: int = 500,
        dry_run: bool = False,
        limit: Optional[int] = None,
        price_field: Optional[str] = None,
    ) -> Dict[str, Any]:
        path = Path(file_path)
        if not path.exists():
            raise FileNotFoundError(f"CSV not found: {path}")

        with path.open("r", encoding="utf-8", errors="ignore") as f:
            reader = csv.DictReader(f)
            headers = reader.fieldnames or []
            if not headers:
                raise ValueError("CSV file has no headers")

            if not price_field:
                price_field = self._detect_price_field(headers)

            batch: List[Dict[str, Any]] = []

            for idx, row in enumerate(reader):
                if limit and idx >= limit:
                    break

                self.stats.total_read += 1
                parsed = self._parse_row(row, price_field)

                if not parsed.get("name"):
                    self.stats.errors += 1
                    continue

                category = parsed.get("category") or "Без категории"
                self.stats.by_category[category] = self.stats.by_category.get(category, 0) + 1

                if not dry_run:
                    batch.append(parsed)
                    if len(batch) >= batch_size:
                        await self._process_batch(batch)
                        batch = []

                self.stats.total_imported += 1

            if batch and not dry_run:
                await self._process_batch(batch)

        return {
            "status": "completed" if not self.error_messages else "completed_with_errors",
            "total_read": self.stats.total_read,
            "total_imported": self.stats.total_imported,
            "errors": self.stats.errors,
            "by_category": self.stats.by_category,
            "error_messages": self.error_messages[:20],
        }

    def _detect_price_field(self, headers: List[str]) -> Optional[str]:
        candidates = [
            "price",
            "cost",
            "price_actual",
            "priceActual",
            "price_kzt",
        ]
        lower_headers = {h.lower(): h for h in headers}
        for c in candidates:
            if c.lower() in lower_headers:
                return lower_headers[c.lower()]
        return None

    def _parse_row(self, row: Dict[str, Any], price_field: Optional[str]) -> Dict[str, Any]:
        name = (
            row.get("name")
            or row.get("name_origin")
            or row.get("name_short")
            or row.get("name_kk")
        )

        brand = row.get("brand_name") or row.get("brand")

        category_1 = row.get("category_1")
        category_2 = row.get("category_2")
        category_3 = row.get("category_3")

        category = category_1 or category_2 or category_3
        subcategory = None
        if category_3 and category_3 != category:
            subcategory = category_3
        elif category_2 and category_2 != category:
            subcategory = category_2

        weight_value, weight_unit = self._extract_weight(row, name)

        price = None
        if price_field:
            price_val = row.get(price_field)
            try:
                price = float(str(price_val).replace(",", ".")) if price_val else None
            except Exception:
                price = None

        external_id = row.get("ntin") or row.get("slug")
        external_url = row.get("url") or row.get("product_url")

        return {
            "name": name,
            "brand": brand,
            "category": category,
            "subcategory": subcategory,
            "weight_value": weight_value,
            "weight_unit": weight_unit,
            "price": price,
            "external_id": external_id,
            "external_url": external_url,
            "is_available": True,
        }

    def _extract_weight(self, row: Dict[str, Any], name: Optional[str]) -> Tuple[Optional[float], Optional[str]]:
        raw_weight = row.get("weight")
        if raw_weight:
            match = WEIGHT_PATTERN.search(str(raw_weight).lower())
            if match:
                return self._normalize_weight(match.group("value"), match.group("unit"))

        if name:
            match = WEIGHT_PATTERN.search(str(name).lower())
            if match:
                return self._normalize_weight(match.group("value"), match.group("unit"))

        return None, None

    def _normalize_weight(self, value_str: str, unit: str) -> Tuple[Optional[float], Optional[str]]:
        try:
            value = float(value_str.replace(",", "."))
        except Exception:
            return None, None

        norm_unit = UNIT_MAP.get(unit.lower(), unit.lower())
        return value, norm_unit

    async def _process_batch(self, batch: List[Dict[str, Any]]) -> None:
        if not batch:
            return

        now = datetime.utcnow()

        # Collect all names for bulk lookup
        names = [item["name"] for item in batch if item.get("name")]
        if not names:
            return

        # Single query to find all existing products
        existing_cursor = self.db.products.find(
            {"name": {"$in": names}},
            {"_id": 1, "name": 1, "prices": 1}
        )
        existing_map = {}
        async for doc in existing_cursor:
            existing_map[doc["name"]] = doc

        # Prepare bulk operations
        bulk_ops = []
        new_docs = []

        for item in batch:
            name = item.get("name")
            if not name:
                continue

            price_entry = {
                "aggregator": self.aggregator,
                "price": item.get("price"),
                "original_price": None,
                "city": self.city,
                "is_available": item.get("is_available", True),
                "external_url": item.get("external_url"),
                "external_id": item.get("external_id"),
                "updated_at": now,
            }

            if name in existing_map:
                # Update existing product
                existing = existing_map[name]
                prices = existing.get("prices", [])
                prices = [p for p in prices if p.get("aggregator") != self.aggregator]
                prices.append(price_entry)

                bulk_ops.append(
                    UpdateOne(
                        {"_id": existing["_id"]},
                        {"$set": {"prices": prices, "updated_at": now}}
                    )
                )
            else:
                # New product
                new_docs.append({
                    "name": name,
                    "category": item.get("category"),
                    "subcategory": item.get("subcategory"),
                    "brand": item.get("brand"),
                    "weight_value": item.get("weight_value"),
                    "weight_unit": item.get("weight_unit"),
                    "image_url": None,
                    "country": None,
                    "prices": [price_entry],
                    "mapping_status": "pending",
                    "matched_product_ids": [],
                    "created_at": now,
                    "updated_at": now,
                })
                # Mark as existing for duplicates in same batch
                existing_map[name] = {"_id": None, "name": name, "prices": [price_entry]}

        # Execute bulk operations
        if bulk_ops:
            await self.db.products.bulk_write(bulk_ops, ordered=False)

        if new_docs:
            await self.db.products.insert_many(new_docs, ordered=False)
