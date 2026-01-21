import os
import django
import sys

sys.path.append('/Users/abylajhanbegimkulov/Desktop/ScoutAlgo/backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'scoutalgo.settings')
django.setup()

from api.models import Category, Product

def check_categories():
    print("Checking Category Structure and Product Counts:")
    for cat in Category.objects.filter(parent=None):
        count = Product.objects.filter(category=cat).count()
        print(f"\n📁 {cat.name} (ID: {cat.id}) - Products: {count}")
        
        for sub in cat.children.all():
            sub_count = Product.objects.filter(category=sub).count()
            print(f"  └─ 📂 {sub.name} (ID: {sub.id}) - Products: {sub_count}")

            products = Product.objects.filter(category=sub)[:3]
            for p in products:
                print(f"     - {p.name}")

if __name__ == '__main__':
    check_categories()
