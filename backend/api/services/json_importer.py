"""
JSON Data Importer Service

Imports product data from JSON files in the Data folder with filtering options.
Supports 6 aggregators: Glovo, Arbuz, Wolt, Yandex Lavka, Magnum (Almaty/Astana), Airba
"""

import os
import json
import re
from decimal import Decimal
from pathlib import Path

from django.conf import settings
from django.utils import timezone
from ..models import Category, Product, Price, Aggregator, ProductLink, City, ImportJob


# Category mapping patterns
CATEGORY_PATTERNS = {
    'eggs': {
        'name': 'Яйца',
        'patterns': ['яйц', 'egg', 'яйко', 'eggs'],
        'subcategories': {
            'Куриные яйца': ['куриные', 'chicken', 'c0', 'c1', 'обычные'],
            'Перепелиные яйца': ['перепел', 'quail'],
            'Яйца эко': ['эко', 'органик', 'organic', 'фермерские', 'farm'],
        }
    },
    'sodas': {
        'name': 'Газировки',
        'patterns': ['газир', 'soda', 'кола', 'cola', 'pepsi', 'fanta', 'sprite', '7up', 'лимонад'],
        'subcategories': {
            'Fanta': ['fanta', 'фанта'],
            'Sprite': ['sprite', 'спрайт'],
            'Pepsi': ['pepsi', 'пепси'],
            '7UP': ['7up', '7-up', 'seven up', 'севен ап'],
            'Coca-Cola': ['coca-cola', 'coca cola', 'кока-кола', 'кока кола'], # Stricter
            'Другие колы': ['cola', 'кола'], # Catch-all for "RC Cola", etc.
            'Другие газировки': [],  # Default subcategory
        }
    },
    'chocolates': {
        'name': 'Шоколадки',
        'patterns': ['шоколад', 'chocolate', 'snickers', 'mars', 'twix', 'bounty', 'milka', 'kitkat', 'kit kat'],
        'subcategories': {
            'Snickers': ['snickers', 'сникерс'],
            'Mars': ['mars', 'марс'],
            'Twix': ['twix', 'твикс'],
            'Bounty': ['bounty', 'баунти'],
            'KitKat': ['kitkat', 'kit kat', 'кит кат', 'киткат'],
            'Milka': ['milka', 'милка'],
            'Alpen Gold': ['alpen gold', 'альпен голд'],
            'Alenka': ['аленка', 'alenka'],
            'Другой шоколад': [],  # Default subcategory
        }
    },
    # Categories to catch false positives
    'salads_herbs': {
        'name': 'Салаты и зелень',
        'patterns': ['салат', 'зелень', 'рукола', 'шпинат', 'базилик', 'укроп', 'петрушка'],
        'subcategories': {'Зелень': []}
    },
    'household': {
        'name': 'Хозтовары',
        'patterns': ['шампунь', 'гель для душа', 'мыло', 'паста', 'крем-краска', 'краска для волос', 'порошок'],
        'subcategories': {'Уход': []}
    }
}


# Aggregator JSON file mapping
AGGREGATOR_FILES = {
    'glovo': 'glovo.glovo_products.json',
    'arbuz': 'arbuz_kz.arbuz_products.json',
    'wolt': 'wolt.wolt_products.json',
    'yandex': 'yandex_lavka.products.json',
    'magnum_almaty': 'magnum_almaty.json',
    'magnum_astana': 'magnum_astana.json',
    'airba': 'airba_fresh.airba_products.json',
}


class JSONDataImporter:
    """Import product data from JSON files with category filtering"""
    
    def __init__(self, job: ImportJob = None):
        self.job = job
        self.stats = {
            'total_read': 0,
            'matched_category': 0,
            'imported': 0,
            'errors': 0,
            'skipped': 0,
        }
        self.errors = []
        self.data_path = Path(settings.BASE_DIR).parent / 'Data'
        
    def get_data_path(self):
        """Get path to Data folder"""
        return self.data_path
    
    def list_available_files(self):
        """List all available JSON files"""
        files = []
        for agg, filename in AGGREGATOR_FILES.items():
            filepath = self.data_path / filename
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
        return files
    
    def normalize_text(self, text):
        """Normalize text for matching"""
        if not text:
            return ""
        return text.lower().strip()
    
    def extract_weight(self, product_data):
        """Extract weight/volume from product data, handling multipliers (e.g. 2 x 0.5L)"""
        # 1. Detect Multiplier from Title
        title = product_data.get('title') or product_data.get('name') or product_data.get('product_name') or ""
        multiplier = 1
        
        # Regex for "2 x", "2x", "2х" (cyrillic), "2шт x"
        mul_match = re.search(r'(^|\s)(\d+)\s*[xхXХ]\s+', title)
        if mul_match:
            try:
                multiplier = float(mul_match.group(2))
            except:
                pass

        # 2. Extract Base Weight
        # Try title/name first as they are most reliable for user-visible weight
        # Then fallback to dedicated fields which might contain scraped errors (e.g. 5L instead of 0.5L)
        search_fields = ['title', 'name', 'product_name', 'measure', 'weight', 'volume', 'unitInfo', 'unit_info']
        
        value = None
        unit = None
        
        for field in search_fields:
            val = product_data.get(field)
            if val:
                # Parse weight string like "500г", "1л", "1 шт"
                # Added space definition to avoid catching "2024" as weight if unit is missing (unlikely due to regex)
                match = re.search(r'(\d+[.,]?\d*)\s*(г|кг|л|мл|g|kg|l|ml|шт|pcs)\b', str(val).lower())
                if match:
                    value = float(match.group(1).replace(',', '.'))
                    unit = match.group(2)
                    # Normalize units
                    unit_map = {'г': 'g', 'кг': 'kg', 'л': 'l', 'мл': 'ml', 'шт': 'pcs'}
                    unit = unit_map.get(unit, unit)
                    break
        
        if value:
            return value * multiplier, unit
            
        return None, None
    
    def detect_category(self, product_data):
        """Detect category using weighted field matching with stem support and exclusions"""
        fields = {
            'title': (product_data.get('title') or product_data.get('name') or product_data.get('product_name'), 10),
            'brand': (product_data.get('brand'), 2),
            'category_name': (product_data.get('categoryName') or product_data.get('sub_category') or product_data.get('category_full_path'), 5),
        }
        
        # 1. Detect Parent Category
        cat_scores = {}
        for cat_slug, cat_info in CATEGORY_PATTERNS.items():
            score = 0
            for field_name, (text, weight) in fields.items():
                if not text: continue
                text = self.normalize_text(str(text))
                
                for pattern in cat_info['patterns']:
                    # Use a regex that allows Cyrillic suffixes for stems (e.g. 'шоколад' matches 'шоколадный')
                    # \b at the start, but allow [а-яё]* at the end before the next \b
                    is_ascii = all(ord(c) < 128 for c in pattern)
                    if is_ascii:
                        pattern_regex = r'\b' + re.escape(pattern) + r'\b' # Strict for English
                    else:
                        # For Cyrillic, allow suffixes like 'ный', 'ая', 'ое'
                        pattern_regex = r'\b' + re.escape(pattern) + r'[а-яё]*\b'
                    
                    if re.search(pattern_regex, text, re.IGNORECASE):
                        # Special check: avoid 'cola' matching in 'chocolate' or 'rucola'
                        if pattern in ['cola', 'кола']:
                            if 'шоколад' in text or 'рукола' in text:
                                continue # Skip this match
                                
                        score += weight
                        break
            if score > 0:
                cat_scores[cat_slug] = score

        if not cat_scores:
            return None, None, None
            
        # Pick category with highest score
        detected_slug = max(cat_scores.items(), key=lambda x: x[1])[0]
        cat_info = CATEGORY_PATTERNS[detected_slug]
        
        # 2. Detect Subcategory
        subcat_scores = {}
        for subcat_name, subcat_patterns in cat_info['subcategories'].items():
            if not subcat_patterns: continue
            
            score = 0
            for field_name, (text, weight) in fields.items():
                if not text: continue
                text = self.normalize_text(str(text))
                
                for pattern in subcat_patterns:
                    is_ascii = all(ord(c) < 128 for c in pattern)
                    if is_ascii:
                        pattern_regex = r'\b' + re.escape(pattern) + r'\b'
                    else:
                        pattern_regex = r'\b' + re.escape(pattern) + r'[а-яё]*\b'
                        
                    if re.search(pattern_regex, text, re.IGNORECASE):
                        # Same exclusion for subcategories if they use generic terms
                        if pattern in ['cola', 'кола'] and ('шоколад' in text or 'рукола' in text):
                            continue
                            
                        score += weight
                        break
            if score > 0:
                subcat_scores[subcat_name] = score

        if subcat_scores:
            best_subcat = max(subcat_scores.items(), key=lambda x: x[1])[0]
            return detected_slug, cat_info['name'], best_subcat
            
        default_subcats = [k for k, v in cat_info['subcategories'].items() if not v]
        subcategory = default_subcats[0] if default_subcats else cat_info['name']
        
        return detected_slug, cat_info['name'], subcategory

    def parse_product(self, data, aggregator_name):
        """Parse product data from different aggregator formats"""
        product = {
            'title': None,
            'brand': None,
            'price': None,
            'original_price': None,
            'weight_value': None,
            'weight_unit': None,
            'image_url': None,
            'external_url': None,
            'external_id': None,
            'city': None,
            'is_available': True,
        }
        
        # Title - try different field names
        product['title'] = data.get('title') or data.get('name') or data.get('product_name')
        
        # Brand
        product['brand'] = data.get('brand') or None
        
        # Price - handle different formats
        price = data.get('cost') or data.get('price') or data.get('priceActual')
        if price:
            try:
                product['price'] = Decimal(str(price))
            except:
                pass
        
        original_price = data.get('prev_cost') or data.get('priceOld') or data.get('originalPrice')
        if original_price:
            try:
                product['original_price'] = Decimal(str(original_price))
            except:
                pass
        
        # Weight
        product['weight_value'], product['weight_unit'] = self.extract_weight(data)
        
        # Image
        product['image_url'] = (
            data.get('url_picture') or 
            data.get('image') or 
            data.get('imageUrl') or
            (data.get('images', [{}])[0] if isinstance(data.get('images'), list) and data.get('images') else None)
        )
        if isinstance(product['image_url'], dict):
            product['image_url'] = product['image_url'].get('url')
        
        # External URL and ID
        product['external_url'] = data.get('url') or data.get('productUrl')
        product['external_id'] = str(data.get('product_id') or data.get('id') or data.get('_id', {}).get('$oid', ''))
        
        # City
        product['city'] = data.get('city', '').lower()
        
        # Availability
        product['is_available'] = data.get('available', True) or data.get('inStock', True)
        
        return product
    
    def ensure_categories(self):
        """Create parent-child category structure"""
        created_categories = {}
        
        for cat_slug, cat_info in CATEGORY_PATTERNS.items():
            # Create parent category
            parent, created = Category.objects.get_or_create(
                name=cat_info['name'],
                defaults={'parent': None, 'sort_order': list(CATEGORY_PATTERNS.keys()).index(cat_slug)}
            )
            created_categories[cat_info['name']] = parent
            
            # Create subcategories
            for idx, subcat_name in enumerate(cat_info['subcategories'].keys()):
                child, _ = Category.objects.get_or_create(
                    name=subcat_name,
                    defaults={'parent': parent, 'sort_order': idx}
                )
                created_categories[subcat_name] = child
        
        return created_categories
    
    def ensure_aggregator(self, name, color=None):
        """Get or create aggregator"""
        # Default colors for aggregators
        colors = {
            'glovo': '#00A082',
            'arbuz': '#1DB954',
            'wolt': '#009DE0',
            'yandex': '#FFCC00',
            'magnum_almaty': '#E31837',
            'magnum_astana': '#E31837',
            'airba': '#FF6B00',
        }
        
        # Normalize aggregator name
        agg_display_names = {
            'glovo': 'Glovo',
            'arbuz': 'Arbuz.kz',
            'wolt': 'Wolt',
            'yandex': 'Yandex Lavka',
            'magnum_almaty': 'Magnum', # Merge to Magnum
            'magnum_astana': 'Magnum', # Merge to Magnum
            'airba': 'Airba Fresh',
        }
        
        display_name = agg_display_names.get(name, name.title())
        # If it's one of the merged ones, we need to ensure unique color or use existing
        aggregator, _ = Aggregator.objects.get_or_create(
            name=display_name,
            defaults={'color': colors.get(name, '#666666')}
        )
        return aggregator
    
    def ensure_city(self, slug):
        """Get or create city"""
        if not slug:
            return None
        
        city_names = {
            'almaty': 'Алматы',
            'astana': 'Астана',
            'shymkent': 'Шымкент',
        }
        
        # Normalize slug
        slug = slug.lower().strip()
        if 'almaty' in slug or 'ala' in slug:
            slug = 'almaty'
        elif 'astana' in slug or 'nqz' in slug:
            slug = 'astana'
        
        name = city_names.get(slug, slug.title())
        city, _ = City.objects.get_or_create(slug=slug, defaults={'name': name})
        return city
    
    def import_from_json(
        self,
        categories=None,  # List of category slugs: ['eggs', 'sodas', 'chocolates']
        aggregators=None,  # List of aggregator slugs: ['glovo', 'arbuz', ...]
        limit_per_category=None,  # Max products per category
        dry_run=False,  # Preview mode without saving
    ):
        """Main import method"""
        results = {
            'status': 'processing',
            'categories': {},
            'aggregators': {},
            'total_imported': 0,
            'errors': [],
        }
        
        # Default to all categories
        if not categories:
            categories = list(CATEGORY_PATTERNS.keys())
        
        # Default to all aggregators
        if not aggregators:
            aggregators = list(AGGREGATOR_FILES.keys())
        
        # Ensure category structure exists
        category_objects = self.ensure_categories()
        
        # Track counts per subcategory
        subcategory_counts = {}
        
        # Process each aggregator file
        for agg_slug in aggregators:
            if agg_slug not in AGGREGATOR_FILES:
                continue
                
            filepath = self.data_path / AGGREGATOR_FILES[agg_slug]
            if not filepath.exists():
                results['errors'].append(f"File not found: {filepath}")
                continue
            
            aggregator = self.ensure_aggregator(agg_slug)
            results['aggregators'][agg_slug] = 0
            
            try:
                with open(filepath, 'r', encoding='utf-8') as f:
                    products_data = json.load(f)
                
                if not isinstance(products_data, list):
                    products_data = [products_data]
                
                for item in products_data:
                    self.stats['total_read'] += 1
                    
                    # Detect category
                    cat_slug, parent_name, subcat_name = self.detect_category(item)
                    
                    if not cat_slug or cat_slug not in categories:
                        self.stats['skipped'] += 1
                        continue
                    
                    self.stats['matched_category'] += 1
                    
                    # Check limit per SUBCATEGORY per AGGREGATOR (to ensure variety and candidates)
                    # Use unique key: "Parent - Subcategory - Aggregator"
                    subcat_agg_key = f"{parent_name} - {subcat_name} - {agg_slug}"
                    current_count = subcategory_counts.get(subcat_agg_key, 0)
                    
                    if limit_per_category and current_count >= limit_per_category:
                        continue
                    
                    # Parse product
                    parsed = self.parse_product(item, agg_slug)
                    
                    if not parsed['title']:
                        self.stats['skipped'] += 1
                        continue
                    
                    if dry_run:
                        # Just count
                        subcategory_counts[subcat_agg_key] = current_count + 1
                        results['total_imported'] += 1
                        results['aggregators'][agg_slug] += 1
                        if parent_name not in results['categories']:
                            results['categories'][parent_name] = {'count': 0, 'subcategories': {}}
                        results['categories'][parent_name]['count'] += 1
                        if subcat_name not in results['categories'][parent_name]['subcategories']:
                            results['categories'][parent_name]['subcategories'][subcat_name] = 0
                        results['categories'][parent_name]['subcategories'][subcat_name] += 1
                        continue
                    
                    try:
                        # Get category
                        category = category_objects.get(subcat_name) or category_objects.get(parent_name)
                        
                        # Create or update product
                        product, created = Product.objects.update_or_create(
                            name=parsed['title'],
                            defaults={
                                'category': category,
                                'brand': parsed['brand'],
                                'weight_value': Decimal(str(parsed['weight_value'])) if parsed['weight_value'] else None,
                                'weight_unit': parsed['weight_unit'],
                                'image_url': parsed['image_url'],
                            }
                        )
                        
                        # Create or update price
                        city = self.ensure_city(parsed['city'])
                        
                        if parsed['price']:
                            Price.objects.update_or_create(
                                product=product,
                                aggregator=aggregator,
                                city=city,
                                defaults={
                                    'price': parsed['price'],
                                    'is_available': parsed['is_available'],
                                }
                            )
                        
                        # Create product link
                        if parsed['external_url'] or parsed['external_id']:
                            url = parsed['external_url']
                            if not url and 'glovo' in agg_slug.lower() and parsed['title']:
                                # Fallback: Generate search URL for Glovo
                                from urllib.parse import quote
                                url = f"https://glovoapp.com/kz/ru/almaty/search/?query={quote(parsed['title'])}"
                                
                            ProductLink.objects.update_or_create(
                                product=product,
                                aggregator=aggregator,
                                defaults={
                                    'url': url,
                                    'external_name': parsed['title'],
                                    'is_verified': True
                                }
                            )
                        
                        subcategory_counts[subcat_agg_key] = current_count + 1
                        results['total_imported'] += 1
                        results['aggregators'][agg_slug] += 1
                        self.stats['imported'] += 1
                        
                        # Update category counts in results
                        if parent_name not in results['categories']:
                            results['categories'][parent_name] = {'count': 0, 'subcategories': {}}
                        results['categories'][parent_name]['count'] += 1
                        if subcat_name not in results['categories'][parent_name]['subcategories']:
                            results['categories'][parent_name]['subcategories'][subcat_name] = 0
                        results['categories'][parent_name]['subcategories'][subcat_name] += 1

                        
                    except Exception as e:
                        self.stats['errors'] += 1
                        results['errors'].append(f"Error importing {parsed['title']}: {str(e)}")
                
            except Exception as e:
                results['errors'].append(f"Error reading {filepath}: {str(e)}")
        
        results['status'] = 'completed' if not results['errors'] else 'completed_with_errors'
        results['stats'] = self.stats
        
        # Update job if exists
        if self.job:
            self.job.status = 'completed'
            self.job.total_rows = self.stats['total_read']
            self.job.success_count = self.stats['imported']
            self.job.error_count = self.stats['errors']
            self.job.error_details = results['errors'][:10] if results['errors'] else None
            self.job.completed_at = timezone.now()
            self.job.save()
        
        return results
