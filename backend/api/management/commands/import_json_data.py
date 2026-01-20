import json
import os
import re
from django.core.management.base import BaseCommand
from django.utils.text import slugify
from django.db import transaction
from api.models import Product, Price, Aggregator, Category, City


class Command(BaseCommand):
    help = 'Imports real data from JSON files with batch processing'

    def add_arguments(self, parser):
        parser.add_argument(
            '--data-dir',
            default='/Users/abylajhanbegimkulov/Desktop/ScoutAlgo/Data',
            help='Directory containing JSON files'
        )
        parser.add_argument(
            '--batch-size',
            type=int,
            default=500,
            help='Batch size for bulk operations'
        )
        parser.add_argument(
            '--clear',
            action='store_true',
            help='Clear existing data before import'
        )

    def handle(self, *args, **options):
        self.batch_size = options['batch_size']
        data_dir = options['data_dir']

        if options['clear']:
            self.stdout.write("Clearing existing data...")
            from api.models import Recommendation, PriceHistory, ProductLink
            # Delete in correct order due to foreign keys
            Recommendation.objects.all().delete()
            PriceHistory.objects.all().delete()
            ProductLink.objects.all().delete()
            Price.objects.all().delete()
            Product.objects.all().delete()
            Category.objects.all().delete()
            self.stdout.write(self.style.SUCCESS("Data cleared"))

        # Setup cities and aggregators first
        self.setup_initial_data()

        # File configurations with specific field mappings
        file_configs = [
            {
                'filename': 'magnum_almaty.json',
                'aggregator': 'Magnum',
                'price_field': 'price',
                'default_city': 'Almaty',
            },
            {
                'filename': 'magnum_astana.json',
                'aggregator': 'Magnum',
                'price_field': 'price',
                'default_city': 'Astana',
            },
            {
                'filename': 'glovo.glovo_products.json',
                'aggregator': 'Glovo',
                'price_field': 'cost',  # Glovo uses 'cost' field
                'default_city': 'Almaty',
            },
            {
                'filename': 'wolt.wolt_products.json',
                'aggregator': 'Wolt',
                'price_field': 'price',
                'default_city': 'Almaty',
            },
            {
                'filename': 'yandex_lavka.products.json',
                'aggregator': 'Yandex Lavka',
                'price_field': 'price',
                'default_city': 'Almaty',
            },
            {
                'filename': 'airba_fresh.airba_products.json',
                'aggregator': 'Airba Fresh',
                'price_field': 'price',
                'default_city': 'Almaty',
            },
            {
                'filename': 'arbuz_kz.arbuz_products.json',
                'aggregator': 'Arbuz',
                'price_field': 'price',
                'default_city': 'Almaty',
            },
        ]

        total_products = 0
        total_prices = 0

        for config in file_configs:
            file_path = os.path.join(data_dir, config['filename'])
            if not os.path.exists(file_path):
                self.stdout.write(self.style.WARNING(f"File not found: {config['filename']}"))
                continue

            self.stdout.write(f"\nProcessing {config['filename']}...")

            try:
                products, prices = self.process_file(file_path, config)
                total_products += products
                total_prices += prices
                self.stdout.write(self.style.SUCCESS(
                    f"  -> {products} products, {prices} prices"
                ))
            except Exception as e:
                self.stdout.write(self.style.ERROR(f"Error: {str(e)}"))
                import traceback
                traceback.print_exc()

        self.stdout.write(self.style.SUCCESS(
            f"\n=== Import complete ===\n"
            f"Total products: {total_products}\n"
            f"Total prices: {total_prices}"
        ))

    def setup_initial_data(self):
        """Create cities and aggregators"""
        self.stdout.write("Setting up cities and aggregators...")

        # Cities
        cities_data = [
            {'name': 'Алматы', 'slug': 'almaty'},
            {'name': 'Астана', 'slug': 'astana'},
        ]
        self.cities = {}
        for c in cities_data:
            city, _ = City.objects.get_or_create(slug=c['slug'], defaults={'name': c['name']})
            self.cities[c['slug'].lower()] = city
            # Also map common variations
            self.cities[c['name'].lower()] = city

        # Also map English names
        self.cities['almaty'] = self.cities.get('almaty') or self.cities.get('алматы')
        self.cities['astana'] = self.cities.get('astana') or self.cities.get('астана')

        # Aggregators - GLOVO is our company!
        aggregators_data = [
            {'name': 'Glovo', 'color': '#FFC244', 'is_our_company': True},
            {'name': 'Magnum', 'color': '#E31E24', 'is_our_company': False},
            {'name': 'Wolt', 'color': '#00C2E8', 'is_our_company': False},
            {'name': 'Yandex Lavka', 'color': '#FFCC00', 'is_our_company': False},
            {'name': 'Airba Fresh', 'color': '#00A651', 'is_our_company': False},
            {'name': 'Arbuz', 'color': '#4CAF50', 'is_our_company': False},
        ]
        self.aggregators = {}
        for a in aggregators_data:
            agg, created = Aggregator.objects.update_or_create(
                name=a['name'],
                defaults={'color': a['color'], 'is_our_company': a['is_our_company']}
            )
            self.aggregators[a['name'].lower()] = agg

        # Categories cache
        self.categories_cache = {}

        self.stdout.write(self.style.SUCCESS(
            f"  Cities: {City.objects.count()}, Aggregators: {Aggregator.objects.count()}"
        ))

    def process_file(self, file_path, config):
        """Process a single JSON file with batch operations"""
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)

        aggregator = self.aggregators.get(config['aggregator'].lower())
        if not aggregator:
            raise ValueError(f"Unknown aggregator: {config['aggregator']}")

        products_created = 0
        prices_created = 0

        # Process in batches
        batch_products = []
        batch_prices = []
        existing_products = {}  # name -> product

        total = len(data)
        self.stdout.write(f"  Total items: {total}")

        for idx, item in enumerate(data):
            if idx % 5000 == 0 and idx > 0:
                self.stdout.write(f"  Progress: {idx}/{total}")

            # Extract data
            title = item.get('title') or item.get('name')
            if not title:
                continue

            # Normalize title for matching
            title_normalized = self.normalize_title(title)

            # Get or prepare product
            if title_normalized not in existing_products:
                # Check if exists in DB
                product = Product.objects.filter(name=title).first()
                if not product:
                    # Prepare category
                    category = self.get_or_create_category(
                        item.get('category_full_path') or item.get('categoryName')
                    )

                    # Parse weight
                    weight_val, weight_unit = self.parse_weight(
                        title,
                        item.get('weight') or item.get('volume') or item.get('measure')
                    )

                    product = Product(
                        name=title,
                        category=category,
                        brand=item.get('brand'),
                        image_url=item.get('url_picture') or item.get('image') or item.get('imageUrl'),
                        sku=str(item.get('id', '') or item.get('product_id', '')),
                        weight_value=weight_val,
                        weight_unit=weight_unit,
                    )
                    batch_products.append(product)

                existing_products[title_normalized] = product

            # Save products batch
            if len(batch_products) >= self.batch_size:
                self.save_products_batch(batch_products)
                products_created += len(batch_products)
                batch_products = []
                # Refresh existing_products with actual DB objects
                for name in existing_products:
                    if existing_products[name].pk is None:
                        existing_products[name] = Product.objects.filter(
                            name=existing_products[name].name
                        ).first()

            # Prepare price
            product = existing_products.get(title_normalized)
            if not product:
                continue

            # Get city
            city_name = (item.get('city') or config['default_city']).lower()
            city = self.cities.get(city_name) or self.cities.get('almaty')

            # Get price value
            price_val = item.get(config['price_field'])
            if price_val is None:
                continue

            # Create price entry (will be batch processed)
            batch_prices.append({
                'product': product,
                'aggregator': aggregator,
                'city': city,
                'price': price_val,
                'is_available': item.get('inStock', True) if 'inStock' in item else item.get('available', True),
            })

            # Save prices batch
            if len(batch_prices) >= self.batch_size:
                prices_created += self.save_prices_batch(batch_prices)
                batch_prices = []

        # Save remaining batches
        if batch_products:
            self.save_products_batch(batch_products)
            products_created += len(batch_products)

        if batch_prices:
            prices_created += self.save_prices_batch(batch_prices)

        return products_created, prices_created

    def save_products_batch(self, products):
        """Bulk create products, ignore conflicts"""
        if not products:
            return

        # Filter out products that already have pk (already in DB)
        new_products = [p for p in products if p.pk is None]
        if not new_products:
            return

        with transaction.atomic():
            # Use bulk_create with ignore_conflicts for products that might already exist
            Product.objects.bulk_create(
                new_products,
                batch_size=self.batch_size,
                ignore_conflicts=True
            )

    def save_prices_batch(self, prices_data):
        """Bulk create/update prices"""
        if not prices_data:
            return 0

        created = 0
        with transaction.atomic():
            for p in prices_data:
                product = p['product']
                # Ensure product has pk
                if product.pk is None:
                    product = Product.objects.filter(name=product.name).first()
                    if not product:
                        continue

                _, is_created = Price.objects.update_or_create(
                    product=product,
                    aggregator=p['aggregator'],
                    city=p['city'],
                    defaults={
                        'price': p['price'],
                        'is_available': p['is_available'],
                    }
                )
                if is_created:
                    created += 1

        return created

    def normalize_title(self, title):
        """Normalize title for matching"""
        if not title:
            return ''
        return title.lower().strip()

    def get_or_create_category(self, path_str):
        """Get or create category hierarchy"""
        if not path_str:
            return None

        # Check cache
        if path_str in self.categories_cache:
            return self.categories_cache[path_str]

        parts = [p.strip() for p in path_str.split('>') if p.strip()]
        if not parts:
            return None

        parent = None
        category = None

        for part in parts:
            cache_key = f"{parent.id if parent else 'root'}:{part}"
            if cache_key in self.categories_cache:
                category = self.categories_cache[cache_key]
            else:
                category, _ = Category.objects.get_or_create(
                    name=part,
                    parent=parent
                )
                self.categories_cache[cache_key] = category
            parent = category

        self.categories_cache[path_str] = category
        return category

    def parse_weight(self, title, measure_str):
        """Parse weight from title or measure string"""
        if not title and not measure_str:
            return None, None

        text = f"{title or ''} {measure_str or ''}"

        # Patterns for weight/volume
        patterns = [
            (r'(\d+(?:[.,]\d+)?)\s*(кг|kg)', 'kg'),
            (r'(\d+(?:[.,]\d+)?)\s*(г|g|гр)', 'g'),
            (r'(\d+(?:[.,]\d+)?)\s*(л|l|литр)', 'l'),
            (r'(\d+(?:[.,]\d+)?)\s*(мл|ml)', 'ml'),
            (r'(\d+(?:[.,]\d+)?)\s*(шт|pcs|штук)', 'pcs'),
        ]

        for pattern, unit in patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                try:
                    value = float(match.group(1).replace(',', '.'))
                    # Limit to reasonable values (max 9999999 for DecimalField)
                    if value > 9999999:
                        value = None
                    return value, unit
                except (ValueError, TypeError):
                    continue

        return None, None
