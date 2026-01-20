import os
import django
import sys

# Set up Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'scoutalgo.settings')
django.setup()

from api.models import Product, Category, Price, Recommendation, ProductLink, PriceHistory
from django.db.models import Q

def cleanup_data_strict_v2():
    print("Starting strictly targeted data cleanup v2...")

    # 1. Defined Keywords for PRODUCTS
    soda_keywords = [
        "газиров", "кола", "пепси", "лимонад", "schweppes", "fanta", "sprite", 
        "миринда", "7up", "borjomi", "aspan", "напиток", "энергетик", "red bull", "gorilla", 
        "pepsi", "coca-cola", "classic", "zero"
    ]
    chocolate_keywords = [
        "шоколад", "батончик", "конфет", "kinder", "snickers", "mars", "twix", "milka", 
        "alpen gold", "kitkat", "ferrero", "raffaello", "плитк", "батон", "драже", "паста шоколадная"
    ]
    egg_keywords = [
        "яйцо", "яйца"
    ]

    # Negative keywords (to exclude milk, etc.)
    negative_keywords = ["молоко", "масло", "кефир", "сметана", "творог", "чипсы", "сухарики", "семечки"]

    def build_query(keywords):
        query = Q()
        for kw in keywords:
            query |= Q(name__icontains=kw)
        return query

    # 2. Identify Products to keep
    print("Filtering products...")
    
    soda_products = Product.objects.filter(build_query(soda_keywords)).exclude(build_query(negative_keywords))
    chocolate_products = Product.objects.filter(build_query(chocolate_keywords))
    egg_products = Product.objects.filter(build_query(egg_keywords)).exclude(name__icontains="шоколадн") # exclude chocolate eggs from eggs root

    print(f"Products found: Sodas: {soda_products.count()}, Chocolates: {chocolate_products.count()}, Eggs: {egg_products.count()}")

    keep_ids = set(soda_products.values_list('id', flat=True)) | \
               set(chocolate_products.values_list('id', flat=True)) | \
               set(egg_products.values_list('id', flat=True))

    # 3. Handle Categories
    print("Reconstructing hierarchy...")
    
    drinks_root, _ = Category.objects.get_or_create(name="Напитки", parent__isnull=True, defaults={'icon': 'Coffee'})
    sweets_root, _ = Category.objects.get_or_create(name="Шоколад и конфеты", parent__isnull=True, defaults={'icon': 'Cookie'})
    eggs_root, _ = Category.objects.get_or_create(name="Яйца", parent__isnull=True, defaults={'icon': 'Egg'})

    # 4. Assignment
    for p in soda_products:
        p.category = drinks_root
        p.save()
    for p in chocolate_products:
        p.category = sweets_root
        p.save()
    for p in egg_products:
        p.category = eggs_root
        p.save()

    # 5. Massive Delete
    print("Deleting irrelevant products...")
    count, _ = Product.objects.exclude(id__in=keep_ids).delete()
    print(f"Deleted {count} products.")

    print("Cleaning up categories...")
    # Delete all categories except our 3 roots
    roots = [drinks_root.id, sweets_root.id, eggs_root.id]
    Category.objects.exclude(id__in=roots).delete()

    print("Cleanup complete!")

if __name__ == "__main__":
    cleanup_data_strict_v2()
