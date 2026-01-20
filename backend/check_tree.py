import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'scoutalgo.settings')
django.setup()

from api.models import Category
from django.db.models import Count

def print_tree(cat, indent=0):
    p_count = cat.product_set.count()
    children = cat.children.all().order_by('name')
    print('  ' * indent + f'- {cat.name} (ID: {cat.id}, Products: {p_count})')
    for child in children:
        print_tree(child, indent + 1)

roots = Category.objects.filter(parent__isnull=True).order_by('name')
print("Category Tree:")
for root in roots:
    print_tree(root)
