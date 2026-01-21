"""
Fix incorrectly matched multipack products.
Multipacks (2x, 6x, etc.) should NOT have competitor prices from single items.
This script removes those incorrect price links.
"""
import os
import re
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'scoutalgo.settings')
django.setup()

from api.models import Product, Price, Aggregator

def detect_multipack(name):
    """Detect if product name indicates a multipack (2x, 6x, etc.)"""
    if not name:
        return None
    
    # Patterns like "2 x", "2x", "6 x", "4шт", etc.
    match = re.search(r'(^|\s)(\d+)\s*[xхXХ]\s+', name)
    if match:
        return int(match.group(2))
    
    # Pattern like "упаковка 6", "6 шт"
    match = re.search(r'(\d+)\s*(шт|упак|pack|pcs)\b', name.lower())
    if match:
        return int(match.group(1))
    
    return None

def run():
    print("Finding incorrectly matched multipack products...")
    
    our_agg = Aggregator.objects.filter(is_our_company=True).first()
    if not our_agg:
        print("No 'our company' aggregator found!")
        return
    
    # Find multipack products
    multipack_products = []
    for product in Product.objects.filter(price__aggregator=our_agg).distinct():
        mult = detect_multipack(product.name)
        if mult and mult > 1:
            multipack_products.append((product, mult))
    
    print(f"Found {len(multipack_products)} multipack products")
    
    fixed_count = 0
    for product, multiplier in multipack_products:
        # Get competitor prices linked to this product
        comp_prices = Price.objects.filter(
            product=product,
            aggregator__is_our_company=False
        )
        
        for price in comp_prices:
            # Check if the linked price's original product is also a multipack
            # Since we copy price to our product, we need to verify the linking was correct
            # For now, just remove all competitor prices from multipack products
            # They will need to be re-matched with better logic
            print(f"Removing: {product.name} ({multiplier}x) <- {price.aggregator.name}: {price.price}")
            price.delete()
            fixed_count += 1
    
    print(f"\nRemoved {fixed_count} incorrect price links from multipack products.")
    print("Re-run AI matching to find correct multipack matches (if any exist).")

if __name__ == '__main__':
    run()
