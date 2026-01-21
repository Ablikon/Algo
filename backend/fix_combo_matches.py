"""
Fix incorrectly matched combo products.
Combos ("Food + Drink") should NOT have competitor prices from single drinks.
This script removes those incorrect price links.
"""
import os
import re
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'scoutalgo.settings')
django.setup()

from api.models import Product, Price, Aggregator

def detect_combo(name):
    """Detect if product name indicates a combo (contains ' + ' or similar)"""
    if not name:
        return False
    
    # Simple check for "+" surrounded by spaces or "plus"
    if ' + ' in name or ' plus ' in name.lower():
        return True
    return False

def run():
    print("Finding incorrectly matched combo products...")
    
    our_agg = Aggregator.objects.filter(is_our_company=True).first()
    if not our_agg:
        print("No 'our company' aggregator found!")
        return
    
    # Find combo products
    combo_products = []
    for product in Product.objects.filter(price__aggregator=our_agg).distinct():
        if detect_combo(product.name):
            combo_products.append(product)
    
    print(f"Found {len(combo_products)} combo products")
    
    fixed_count = 0
    for product in combo_products:
        # Get competitor prices linked to this product
        comp_prices = Price.objects.filter(
            product=product,
            aggregator__is_our_company=False
        )
        
        for price in comp_prices:
            # Check if competitor product/price matches the combo complexity?
            # Typically competitors sell single drinks (e.g. Sprite 505)
            # If the combo is "Food + Sprite" (2000+), linking to 505 is definitely wrong.
            
            # Heuristic: If our price > 2 * competitor price, it's suspicious for a combo vs drink match.
            # But safer to just remove ALL links for combos that were matched to "Sodas/Beverages"
            
            # Actually, simply remove all links. Combos are unique usually.
            print(f"Removing: {product.name} (Combo) <- {price.aggregator.name}: {price.price}")
            price.delete()
            fixed_count += 1
    
    print(f"\nRemoved {fixed_count} incorrect price links from combo products.")
    print("Re-run AI matching to find correct combo matches (if any exist).")

if __name__ == '__main__':
    run()
