import os
import requests
from django.core.management.base import BaseCommand
from api.management.commands.import_json_data import Command as ImportJsonCommand


API_BASE_URL = os.getenv('EXTERNAL_API_BASE', 'http://94.131.88.146')
API_TOKEN = os.getenv('EXTERNAL_API_TOKEN')

# Mapping of known file ID patterns to config
FILE_CONFIG_MAP = {
    'magnum_almaty': {'aggregator': 'Magnum', 'price_field': 'price', 'default_city': 'Almaty'},
    'magnum_astana': {'aggregator': 'Magnum', 'price_field': 'price', 'default_city': 'Astana'},
    'glovo': {'aggregator': 'Glovo', 'price_field': 'cost', 'default_city': 'Almaty'},
    'glovo_almaty': {'aggregator': 'Glovo', 'price_field': 'cost', 'default_city': 'Almaty'},
    'glovo_astana': {'aggregator': 'Glovo', 'price_field': 'cost', 'default_city': 'Astana'},
    'wolt': {'aggregator': 'Wolt', 'price_field': 'price', 'default_city': 'Almaty'},
    'wolt_almaty': {'aggregator': 'Wolt', 'price_field': 'price', 'default_city': 'Almaty'},
    'yandex_lavka': {'aggregator': 'Yandex Lavka', 'price_field': 'price', 'default_city': 'Almaty'},
    'yandex_lavka_almaty': {'aggregator': 'Yandex Lavka', 'price_field': 'price', 'default_city': 'Almaty'},
    'airba_fresh': {'aggregator': 'Airba Fresh', 'price_field': 'price', 'default_city': 'Almaty'},
    'airba_fresh_almaty': {'aggregator': 'Airba Fresh', 'price_field': 'price', 'default_city': 'Almaty'},
    'arbuz': {'aggregator': 'Arbuz', 'price_field': 'price', 'default_city': 'Almaty'},
    'arbuz_almaty': {'aggregator': 'Arbuz', 'price_field': 'price', 'default_city': 'Almaty'},
}

# Known aggregator keywords for inference
AGGREGATOR_KEYWORDS = {
    'magnum': ('Magnum', 'price'),
    'glovo': ('Glovo', 'cost'),
    'wolt': ('Wolt', 'price'),
    'yandex_lavka': ('Yandex Lavka', 'price'),
    'airba_fresh': ('Airba Fresh', 'price'),
    'airba': ('Airba Fresh', 'price'),
    'arbuz': ('Arbuz', 'price'),
}

CITY_KEYWORDS = {
    'almaty': 'Almaty',
    'astana': 'Astana',
}


def resolve_config(file_id):
    """Resolve file_id to a processing config dict."""
    # Strip common suffixes like _mapped
    clean_id = file_id.replace('_mapped', '').replace('_products', '')

    # Direct match
    if clean_id in FILE_CONFIG_MAP:
        return FILE_CONFIG_MAP[clean_id]

    # Try inference from filename parts
    file_lower = file_id.lower()

    aggregator_name = None
    price_field = 'price'
    city = 'Almaty'

    for keyword, (agg, pf) in AGGREGATOR_KEYWORDS.items():
        if keyword in file_lower:
            aggregator_name = agg
            price_field = pf
            break

    if not aggregator_name:
        return None

    for keyword, city_name in CITY_KEYWORDS.items():
        if keyword in file_lower:
            city = city_name
            break

    return {'aggregator': aggregator_name, 'price_field': price_field, 'default_city': city}


class Command(BaseCommand):
    help = 'Imports product data from external API into the database'

    def add_arguments(self, parser):
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
        parser.add_argument(
            '--file-id',
            type=str,
            default=None,
            help='Import only a specific file by ID'
        )

    def handle(self, *args, **options):
        if not API_TOKEN:
            self.stdout.write(self.style.ERROR(
                "EXTERNAL_API_TOKEN is not set. Add it to your .env file."
            ))
            return

        # Create an instance of the import command to reuse its processing logic
        self.importer = ImportJsonCommand()
        self.importer.stdout = self.stdout
        self.importer.style = self.style
        self.importer.batch_size = options['batch_size']

        if options['clear']:
            self.stdout.write("Clearing existing data...")
            from api.models import Recommendation, PriceHistory, ProductLink, Price, Product, Category
            Recommendation.objects.all().delete()
            PriceHistory.objects.all().delete()
            ProductLink.objects.all().delete()
            Price.objects.all().delete()
            Product.objects.all().delete()
            Category.objects.all().delete()
            self.stdout.write(self.style.SUCCESS("Data cleared"))

        # Setup cities and aggregators
        self.importer.setup_initial_data()

        headers = {'Authorization': f'Bearer {API_TOKEN}'}

        # Fetch file list
        self.stdout.write("Fetching file list from external API...")
        try:
            resp = requests.get(f'{API_BASE_URL}/api/csv-files', headers=headers, timeout=30)
            resp.raise_for_status()
        except requests.RequestException as e:
            self.stdout.write(self.style.ERROR(f"Failed to fetch file list: {e}"))
            return

        files_data = resp.json()
        if not files_data.get('success'):
            self.stdout.write(self.style.ERROR("API returned unsuccessful response for file list"))
            return

        files = files_data.get('files', [])
        self.stdout.write(f"Found {len(files)} files")

        # Filter by file-id if provided
        target_file_id = options.get('file_id')
        if target_file_id:
            files = [f for f in files if f.get('id') == target_file_id]
            if not files:
                self.stdout.write(self.style.ERROR(f"File ID '{target_file_id}' not found"))
                return

        total_products = 0
        total_prices = 0

        for file_info in files:
            file_id = file_info.get('id')
            filename = file_info.get('filename', file_id)

            config = resolve_config(file_id)
            if not config:
                self.stdout.write(self.style.WARNING(
                    f"Skipping '{filename}': cannot determine aggregator config"
                ))
                continue

            self.stdout.write(f"\nFetching {filename} (aggregator: {config['aggregator']}, city: {config['default_city']})...")

            try:
                data_resp = requests.get(
                    f'{API_BASE_URL}/api/csv-data/{file_id}',
                    headers=headers,
                    timeout=120
                )
                data_resp.raise_for_status()
            except requests.RequestException as e:
                self.stdout.write(self.style.ERROR(f"  Failed to fetch '{filename}': {e}"))
                continue

            try:
                data = data_resp.json()
            except ValueError:
                self.stdout.write(self.style.ERROR(f"  Invalid JSON response for '{filename}'"))
                continue

            # Handle case where API wraps data in an object
            if isinstance(data, dict):
                data = data.get('data') or data.get('items') or data.get('products', [])

            if not isinstance(data, list):
                self.stdout.write(self.style.WARNING(f"  Unexpected data format for '{filename}', skipping"))
                continue

            self.stdout.write(f"  Received {len(data)} items, processing...")

            try:
                products, prices = self.importer.process_data(data, config)
                total_products += products
                total_prices += prices
                self.stdout.write(self.style.SUCCESS(
                    f"  -> {products} products, {prices} prices"
                ))
            except Exception as e:
                self.stdout.write(self.style.ERROR(f"  Error processing '{filename}': {e}"))
                import traceback
                traceback.print_exc()

        self.stdout.write(self.style.SUCCESS(
            f"\n=== Import from API complete ===\n"
            f"Total products: {total_products}\n"
            f"Total prices: {total_prices}"
        ))
