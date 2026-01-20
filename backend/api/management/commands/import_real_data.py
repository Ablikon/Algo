import json
import os
from django.core.management.base import BaseCommand
from django.utils.text import slugify
from api.models import Product, Price, Aggregator, Category, City
from django.db import transaction

class Command(BaseCommand):
    help = 'Imports real data from JSON files'

    def handle(self, *args, **options):
        data_dir = '/Users/abylajhanbegimkulov/Desktop/ScoutAlgo/Data'
        files = [
            'magnum_almaty.json',
            'magnum_astana.json',
            'airba_fresh.airba_products.json',
            'arbuz_kz.arbuz_products.json',
            'glovo.glovo_products.json',
            'wolt.wolt_products.json',
            'yandex_lavka.products.json'
        ]

        self.stdout.write("Starting data import...")

        # Clear existing data? Maybe better to keep it safe or option to wipe.
        # For now, let's assume we want to upsert.
        
        # Ensure 'Our Company' exists (assuming Magnum is us for now, or just a placeholder)
        # Actually user didn't specify who "Our Company" is. Let's assume Magnum is a competitor for now, 
        # or we can ask. But for the sake of the demo, let's make "Magnum" our company if user hasn't specified.
        # Wait, usually "ScoutAlgo" implies we are scraping competitors.
        # Let's just import everything as is.
        
        for filename in files:
            file_path = os.path.join(data_dir, filename)
            if not os.path.exists(file_path):
                self.stdout.write(self.style.WARNING(f"File not found: {filename}"))
                continue

            self.stdout.write(f"Processing {filename}...")
            
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    
                # Determine aggregator from filename if possible, otherwise rely on content
                default_aggregator_name = self.get_aggregator_name(filename)
                
                with transaction.atomic():
                    for item in data:
                        self.process_item(item, default_aggregator_name)
                        
                self.stdout.write(self.style.SUCCESS(f"Finished {filename}"))
                
            except Exception as e:
                self.stdout.write(self.style.ERROR(f"Error processing {filename}: {str(e)}"))

    def get_aggregator_name(self, filename):
        if 'magnum' in filename: return 'Magnum'
        if 'airba' in filename: return 'Airba Fresh'
        if 'arbuz' in filename: return 'Arbuz'
        if 'glovo' in filename: return 'Glovo'
        if 'wolt' in filename: return 'Wolt'
        if 'yandex' in filename: return 'Yandex'
        return 'Unknown'

    def process_item(self, item, default_aggregator_name):
        # 1. City
        city_name = item.get('city', 'Almaty') # Default to Almaty if missing
        if not city_name: city_name = 'Almaty'
        city, _ = City.objects.get_or_create(
            slug=slugify(city_name),
            defaults={'name': city_name}
        )

        # 2. Aggregator
        agg_name = item.get('mercant_name', default_aggregator_name)
        if not agg_name: agg_name = default_aggregator_name
        
        # Mapping names to nicer formats
        agg_map = {
            'MAGNUM': 'Magnum',
            'Magnum': 'Magnum',
            'airba': 'Airba Fresh',
            'arbuz': 'Arbuz.kz'
        }
        agg_name = agg_map.get(agg_name, agg_name)
        
        aggregator, _ = Aggregator.objects.get_or_create(
            name=agg_name,
            defaults={
                'is_our_company': agg_name.lower() == 'magnum', # Let's assume Magnum is us for the demo, or not?
                # Actually, usually in these demos, we pick one. Let's make Magnum 'our company' for now.
                # User asked to "display normally".
                'color': self.get_aggregator_color(agg_name)
            }
        )

        # 3. Category
        category_path = item.get('category_full_path', '')
        category = self.get_or_create_category_tree(category_path)

        # 4. Product
        title = item.get('title') or item.get('name')
        if not title: return

        brand = item.get('brand')
        
        # Simple weight parsing
        measure = item.get('measure', '').lower()
        weight_val = None
        weight_unit = None
        
        # Try to extract weight from title if not in measure or if measure is just unit
        # ... (Simplification for MVP: just save what we have)
        
        product, created = Product.objects.get_or_create(
            name=title,
            defaults={
                'category': category,
                'brand': brand,
                'image_url': item.get('url_picture') or item.get('image_url'),
                'sku': str(item.get('id', '')),
                # 'description': item.get('description'), # Model doesn't have description yet
            }
        )
        
        # 5. Price
        price_val = item.get('price')
        if price_val is not None:
            Price.objects.update_or_create(
                product=product,
                aggregator=aggregator,
                city=city,
                defaults={
                    'price': price_val,
                    'is_available': True,
                    'last_updated': item.get('time_scrap')
                }
            )

    def get_or_create_category_tree(self, path_str):
        if not path_str: return None
        parts = [p.strip() for p in path_str.split('>')]
        parent = None
        category = None
        
        for part in parts:
            category, _ = Category.objects.get_or_create(
                name=part,
                parent=parent
            )
            parent = category
            
        return category

    def get_aggregator_color(self, name):
        colors = {
            'Magnum': '#E31E24',
            'Airba Fresh': '#00A651',
            'Arbuz.kz': '#4CAF50',
            'Glovo': '#FFC244',
            'Wolt': '#00C2E8',
            'Yandex': '#FFCC00'
        }
        return colors.get(name, '#666666')
