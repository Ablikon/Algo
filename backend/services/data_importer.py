"""
Data Importer Service

Imports product data from JSON files for all 6 aggregators.
Supports: Arbuz, Glovo, Wolt, Yandex Lavka, Magnum (Almaty/Astana), Airba.

Key features:
- Universal JSON parsing for different aggregator formats
- Automatic category detection (no filtering - imports all products)
- Progress tracking and error handling
- Batch processing for performance
"""

import json
import re
import os
import logging
from pathlib import Path
from datetime import datetime
from decimal import Decimal
from typing import Optional, List, Dict, Any
from pymongo import UpdateOne

logger = logging.getLogger(__name__)

# Aggregator file mapping
AGGREGATOR_FILES = {
    'glovo': 'glovo.glovo_products.json',
    'arbuz': 'arbuz_kz.arbuz_products.json',
    'wolt': 'wolt.wolt_products.json',
    'yandex': 'yandex_lavka.products.json',
    'magnum_almaty': 'magnum_almaty.json',
    'magnum_astana': 'magnum_astana.json',
    'airba': 'airba_fresh.airba_products.json',
}

# Display names for aggregators
AGGREGATOR_DISPLAY_NAMES = {
    'glovo': 'Glovo',
    'arbuz': 'Arbuz.kz',
    'wolt': 'Wolt',
    'yandex': 'Yandex Lavka',
    'magnum_almaty': 'Magnum',
    'magnum_astana': 'Magnum',
    'airba': 'Airba Fresh',
    'ryadom': 'Рядом',
}

# Colors for UI
AGGREGATOR_COLORS = {
    'glovo': '#00A082',
    'arbuz': '#FF7F00',
    'wolt': '#00C2E8',
    'yandex': '#FFCC00',
    'magnum_almaty': '#EE1C25',
    'magnum_astana': '#EE1C25',
    'airba': '#78B833',
    'ryadom': '#6B7280',
}


class DataImporter:
    """Universal JSON data importer for all aggregators"""

    def __init__(self, db, data_path: Optional[Path] = None):
        self.db = db
        self.data_path = data_path
        self.stats = {
            'total_read': 0,
            'total_imported': 0,
            'errors': 0,
            'by_aggregator': {},
            'by_category': {}
        }
        self.error_messages = []
        self.our_company = os.getenv("OUR_COMPANY_AGGREGATOR", "Рядом")
        self._our_index = None

    async def import_all(
        self,
        aggregators: Optional[List[str]] = None,
        limit_per_aggregator: Optional[int] = None,
        dry_run: bool = False
    ) -> Dict[str, Any]:
        """
        Import all products from JSON files.

        Args:
            aggregators: List of aggregator slugs to import, None = all
            limit_per_aggregator: Max products per aggregator, None = all
            dry_run: If True, only count without saving
        """

        if aggregators is None:
            aggregators = list(AGGREGATOR_FILES.keys())

        if self.data_path is None:
            raise ValueError("Data path is not configured for JSON import")

        # Ensure aggregators exist in DB
        await self._ensure_aggregators()

        # Process each aggregator
        for agg_slug in aggregators:
            if agg_slug not in AGGREGATOR_FILES:
                self.error_messages.append(f"Unknown aggregator: {agg_slug}")
                continue

            filepath = self.data_path / AGGREGATOR_FILES[agg_slug]
            if not filepath.exists():
                self.error_messages.append(f"File not found: {filepath}")
                continue

            logger.info(f"📥 Importing from {agg_slug}...")

            await self._import_aggregator_file(
                filepath=filepath,
                agg_slug=agg_slug,
                limit=limit_per_aggregator,
                dry_run=dry_run
            )

        return {
            'status': 'completed' if not self.error_messages else 'completed_with_errors',
            'total_read': self.stats['total_read'],
            'total_imported': self.stats['total_imported'],
            'errors': self.stats['errors'],
            'by_aggregator': self.stats['by_aggregator'],
            'by_category': self.stats['by_category'],
            'error_messages': self.error_messages[:20]  # Limit error list
        }

    async def _ensure_aggregators(self):
        """Create aggregators in DB if not exist"""
        for agg_slug, display_name in AGGREGATOR_DISPLAY_NAMES.items():
            await self.db.aggregators.update_one(
                {"name": display_name},
                {"$setOnInsert": {
                    "name": display_name,
                    "color": AGGREGATOR_COLORS.get(agg_slug, "#666666"),
                    "created_at": datetime.utcnow()
                }},
                upsert=True
            )

    async def _import_aggregator_file(
        self,
        filepath: Path,
        agg_slug: str,
        limit: Optional[int],
        dry_run: bool
    ):
        """Import products from a single aggregator JSON file"""

        display_name = AGGREGATOR_DISPLAY_NAMES.get(agg_slug, agg_slug)
        self.stats['by_aggregator'][display_name] = 0

        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                data = json.load(f)

            if not isinstance(data, list):
                data = [data]

            # Determine city from aggregator slug
            city = self._get_city_from_slug(agg_slug)

            count = 0
            batch = []
            batch_size = 500  # Process in batches for performance

            for item in data:
                self.stats['total_read'] += 1

                # Parse product
                parsed = self._parse_product(item, agg_slug)

                if not parsed.get('name'):
                    self.stats['errors'] += 1
                    continue

                if limit and count >= limit:
                    break

                if not dry_run:
                    batch.append({
                        'parsed': parsed,
                        'aggregator': display_name,
                        'city': city or parsed.get('city')
                    })

                    if len(batch) >= batch_size:
                        await self._process_batch(batch)
                        batch = []

                count += 1
                self.stats['by_aggregator'][display_name] = count

                # Track categories
                category = parsed.get('category') or 'Без категории'
                if category not in self.stats['by_category']:
                    self.stats['by_category'][category] = 0
                self.stats['by_category'][category] += 1

            # Process remaining batch
            if batch and not dry_run:
                await self._process_batch(batch)

            self.stats['total_imported'] += count
            logger.info(f"✅ {display_name}: {count} products imported")

        except Exception as e:
            logger.error(f"Error importing {agg_slug}: {e}")
            self.error_messages.append(f"Error in {agg_slug}: {str(e)}")
            self.stats['errors'] += 1

    def _normalize_text(self, text: Optional[str]) -> str:
        if not text:
            return ""
        text = re.sub(r"[^a-zA-Zа-яА-Я0-9]+", " ", str(text)).lower()
        return " ".join(text.split())

    def _build_match_key(self, parsed: Dict[str, Any]) -> str:
        name_key = self._normalize_text(parsed.get("name"))
        brand_key = self._normalize_text(parsed.get("brand"))
        weight_val = parsed.get("weight_value")
        weight_unit = parsed.get("weight_unit") or ""
        weight_key = ""
        if weight_val is not None:
            try:
                weight_key = f"{float(weight_val):.0f}{weight_unit}".lower()
            except Exception:
                weight_key = ""
        return f"{name_key}|{brand_key}|{weight_key}"

    async def _ensure_our_index(self) -> None:
        if self._our_index is not None:
            return
        self._our_index = {}
        cursor = self.db.products.find(
            {"prices.aggregator": self.our_company},
            {"_id": 1, "name": 1, "brand": 1, "weight_value": 1, "weight_unit": 1, "prices": 1, "image_url": 1}
        )
        async for doc in cursor:
            parsed = {
                "name": doc.get("name"),
                "brand": doc.get("brand"),
                "weight_value": doc.get("weight_value"),
                "weight_unit": doc.get("weight_unit"),
            }
            key = self._build_match_key(parsed)
            if key:
                self._our_index[key] = doc

    async def _process_batch(self, batch: List[Dict]):
        """Process a batch of products - upsert into MongoDB"""
        if not batch:
            return

        now = datetime.utcnow()

        # Fetch existing products in one query
        names = [item['parsed'].get('name') for item in batch if item.get('parsed') and item['parsed'].get('name')]
        if not names:
            return

        existing_docs = await self.db.products.find(
            {'name': {'$in': names}},
            {'_id': 1, 'name': 1, 'prices': 1, 'image_url': 1}
        ).to_list(length=len(names))
        existing_map = {doc['name']: doc for doc in existing_docs}

        await self._ensure_our_index()

        bulk_ops = []
        new_docs = []

        for item in batch:
            parsed = item['parsed']
            aggregator = item['aggregator']
            city = item['city']
            name = parsed.get('name')
            if not name:
                continue

            # Build price entry
            price_entry = {
                'aggregator': aggregator,
                'price': parsed.get('price'),
                'original_price': parsed.get('original_price'),
                'city': city,
                'is_available': parsed.get('is_available', True),
                'external_url': parsed.get('external_url'),
                'external_id': parsed.get('external_id'),
                'matched_uuid': parsed.get('matched_uuid'),
                'updated_at': now
            }

            existing = existing_map.get(name)
            if not existing and self._our_index is not None:
                match_key = self._build_match_key(parsed)
                existing = self._our_index.get(match_key)

            if existing:
                prices = existing.get('prices', [])
                prices = [p for p in prices if p.get('aggregator') != aggregator]
                prices.append(price_entry)

                bulk_ops.append(
                    UpdateOne(
                        {'_id': existing['_id']},
                        {'$set': {
                            'prices': prices,
                            'updated_at': now,
                            'image_url': parsed.get('image_url') or existing.get('image_url')
                        }}
                    )
                )
            else:
                new_docs.append({
                    'name': name,
                    'category': parsed.get('category'),
                    'subcategory': parsed.get('subcategory'),
                    'brand': parsed.get('brand'),
                    'weight_value': parsed.get('weight_value'),
                    'weight_unit': parsed.get('weight_unit'),
                    'image_url': parsed.get('image_url'),
                    'country': parsed.get('country'),
                    'prices': [price_entry],
                    'mapping_status': 'pending',
                    'matched_product_ids': [],
                    'created_at': now,
                    'updated_at': now
                })

        if bulk_ops:
            await self.db.products.bulk_write(bulk_ops, ordered=False)

        if new_docs:
            await self.db.products.insert_many(new_docs, ordered=False)

    def _parse_product(self, data: Dict, agg_slug: str) -> Dict:
        """
        Parse product from any aggregator format.
        Handles different field names across aggregators.
        """

        result = {
            'name': None,
            'brand': None,
            'category': None,
            'subcategory': None,
            'price': None,
            'original_price': None,
            'weight_value': None,
            'weight_unit': None,
            'image_url': None,
            'external_url': None,
            'external_id': None,
            'matched_uuid': None,
            'city': None,
            'country': None,
            'is_available': True,
        }

        # Name - try multiple fields
        result['name'] = (
            data.get('title') or
            data.get('name') or
            data.get('product_name') or
            data.get('rawData', {}).get('name')
        )

        # Brand
        result['brand'] = (
            data.get('brand') or
            data.get('rawData', {}).get('brandName')
        )

        # Category - use raw category from source
        category_raw = (
            data.get('categoryName') or
            data.get('category_full_path') or
            data.get('sub_category') or
            data.get('rawData', {}).get('catalogName') or
            data.get('rawData', {}).get('categoryName')
        )

        if category_raw:
            # Use first level as category, rest as subcategory
            parts = str(category_raw).split('/')
            result['category'] = parts[0].strip() if parts else category_raw
            result['subcategory'] = parts[-1].strip() if len(parts) > 1 else None

        # Price
        price = (
            data.get('cost') or
            data.get('price') or
            data.get('priceActual') or
            data.get('rawData', {}).get('priceActual')
        )
        if price:
            try:
                result['price'] = float(price)
            except:
                pass

        # Original price
        orig_price = (
            data.get('prev_cost') or
            data.get('priceOld') or
            data.get('originalPrice') or
            data.get('rawData', {}).get('pricePrevious')
        )
        if orig_price:
            try:
                result['original_price'] = float(orig_price)
            except:
                pass

        # Weight - extract from various fields
        weight_val, weight_unit = self._extract_weight(data)
        result['weight_value'] = weight_val
        result['weight_unit'] = weight_unit

        # Image
        result['image_url'] = (
            data.get('url_picture') or
            data.get('image') or
            data.get('imageUrl') or
            data.get('rawData', {}).get('image')
        )
        if isinstance(result['image_url'], list):
            result['image_url'] = result['image_url'][0] if result['image_url'] else None
        if isinstance(result['image_url'], dict):
            result['image_url'] = result['image_url'].get('url')

        # External URL and ID
        result['external_url'] = data.get('url') or data.get('productUrl')
        result['external_id'] = str(
            data.get('product_id') or
            data.get('id') or
            data.get('_id', {}).get('$oid', '') or
            ''
        )
        result['matched_uuid'] = (
            data.get('matched_uuid')
            or data.get('matched_id')
            or data.get('matchedId')
        )

        # City
        result['city'] = (data.get('city') or '').lower() or None

        # Availability
        result['is_available'] = (
            data.get('available', True) and
            data.get('inStock', True)
        )

        # Country
        result['country'] = (
            data.get('country') or
            data.get('origin') or
            data.get('country_of_origin') or
            data.get('rawData', {}).get('country') or
            data.get('rawData', {}).get('manufacturer', {}).get('country')
        )

        return result

    def _extract_weight(self, data: Dict) -> tuple:
        """Extract weight value and unit from product data"""

        # Try multiple fields
        weight_sources = [
            data.get('title', ''),
            data.get('name', ''),
            data.get('weight', ''),
            data.get('volume', ''),
            data.get('measure', ''),
            str(data.get('rawData', {}).get('weight', ''))
        ]

        for source in weight_sources:
            if not source:
                continue

            # Extract multiplier (e.g., "2 x 500ml")
            multiplier = 1
            mul_match = re.search(r'(\d+)\s*[xхXХ]\s+', str(source))
            if mul_match:
                try:
                    multiplier = int(mul_match.group(1))
                except:
                    pass

            # Extract weight/volume
            match = re.search(
                r'(\d+[.,]?\d*)\s*(г|кг|л|мл|g|kg|l|ml|шт|pcs)\b',
                str(source).lower()
            )

            if match:
                try:
                    value = float(match.group(1).replace(',', '.')) * multiplier
                    unit = match.group(2)

                    # Normalize units
                    unit_map = {'г': 'g', 'кг': 'kg', 'л': 'l', 'мл': 'ml', 'шт': 'pcs'}
                    unit = unit_map.get(unit, unit)

                    return value, unit
                except:
                    pass

        return None, None

    def _get_city_from_slug(self, agg_slug: str) -> Optional[str]:
        """Get city from aggregator slug"""
        if 'astana' in agg_slug:
            return 'astana'
        # Default all others to almaty as it's the primary market
        return 'almaty'
