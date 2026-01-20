import os
import django
import sys

# Set up Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'scoutalgo.settings')
django.setup()

from api.models import Product, Category, Price, Recommendation, ProductLink, PriceHistory
from django.db.models import Q

def cleanup_data():
    print("Starting data cleanup...")

    # 1. Identify target categories
    target_keywords = ["яйца", "газиров", "напит", "шоколад", "конфет", "кола", "пепси", "газировка", "фанта", "спрайт"]
    query = Q()
    for kw in target_keywords:
        query |= Q(name__icontains=kw)
    
    target_categories = Category.objects.filter(query)
    target_category_ids = set(target_categories.values_list('id', flat=True))
    
    # Also include children of these categories recursively
    def get_all_children(cat_ids):
        children = Category.objects.filter(parent_id__in=cat_ids)
        if not children.exists():
            return set()
        child_ids = set(children.values_list('id', flat=True))
        new_ids = child_ids - cat_ids
        if not new_ids:
            return set()
        return child_ids | get_all_children(cat_ids | child_ids)

    all_target_cat_ids = target_category_ids | get_all_children(target_category_ids)
    print(f"Target categories identified: {len(all_target_cat_ids)}")

    # 2. Identify products to keep
    products_to_keep = Product.objects.filter(category_id__in=all_target_cat_ids)
    products_to_keep_ids = set(products_to_keep.values_list('id', flat=True))
    print(f"Products to keep: {len(products_to_keep_ids)}")

    # 3. Restructure Categories
    print("Restructuring category hierarchy...")
    
    # Create or get Root categories
    def get_root(name, icon):
        roots = Category.objects.filter(name=name, parent__isnull=True)
        if roots.exists():
            return roots.first()
        # If exists but has parent, let's keep it as is and create NEW root or promote it?
        # Better: create unique roots
        root, _ = Category.objects.get_or_create(name=name, parent__isnull=True, defaults={'icon': icon})
        return root

    drinks_root = get_root("Напитки", "Coffee")
    sweets_root = get_root("Шоколад и конфеты", "Cookie")
    eggs_root = get_root("Яйца", "Egg")

    # Move target categories under roots
    for cat in Category.objects.filter(id__in=all_target_cat_ids):
        if cat.id in [drinks_root.id, sweets_root.id, eggs_root.id]:
            continue
            
        name_lower = cat.name.lower()
        if any(kw in name_lower for kw in ["газиров", "напит", "кола", "пепси", "фанта", "спрайт"]):
            cat.parent = drinks_root
            cat.save()
        elif any(kw in name_lower for kw in ["шоколад", "конфет"]):
            cat.parent = sweets_root
            cat.save()
        elif "яйц" in name_lower:
            cat.parent = eggs_root
            cat.save()

    # 4. Delete irrelevant data
    print("Deleting irrelevant products and related data...")
    # Related data is usually deleted via CASCADE, but let's be safe/explicit if needed
    # Actually, we can just delete products not in our list
    products_to_delete = Product.objects.exclude(id__in=products_to_keep_ids)
    count, _ = products_to_delete.delete()
    print(f"Deleted {count} products and related objects.")

    # 5. Delete empty/unused categories (that are not our target or roots)
    print("Cleaning up categories...")
    roots = [drinks_root.id, sweets_root.id, eggs_root.id]
    unused_categories = Category.objects.exclude(id__in=all_target_cat_ids).exclude(id__in=roots)
    count, _ = unused_categories.delete()
    print(f"Deleted {count} unused categories.")

    print("Cleanup complete!")

if __name__ == "__main__":
    cleanup_data()
