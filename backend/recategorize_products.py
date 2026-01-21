
import os
import django
import sys

# Setup Django
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'scoutalgo.settings')
django.setup()

from api.models import Product, Category
from api.services.json_importer import JSONDataImporter

def recategorize():
    importer = JSONDataImporter()
    products = Product.objects.all()
    
    print(f"Recategorizing {products.count()} products...")
    
    updated_count = 0
    category_map = importer.ensure_categories()
    
    for p in products:
        # Reconstruct search fields from DB
        fake_data = {
            'title': p.name,
            'brand': p.brand,
            'category_name': p.category.name if p.category else None,
        }
        
        slug, parent_name, subcat_name = importer.detect_category(fake_data)
        
        if subcat_name:
            new_cat = category_map.get(subcat_name) or category_map.get(parent_name)
            if new_cat and p.category_id != new_cat.id:
                p.category = new_cat
                p.save()
                updated_count += 1
                if updated_count % 50 == 0:
                    print(f"Updated {updated_count} products...")
                
    print(f"Done. Updated {updated_count} products.")

if __name__ == "__main__":
    recategorize()
