import os
import django
import sys

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'scoutalgo.settings')
django.setup()

from api.models import Product, Price, Aggregator
from api.services.matching import ProductMatcher

def debug():
    print("Debugging Recommendations...")
    
    # 1. Check Glovo aggregator
    glovo = Aggregator.objects.filter(is_our_company=True).first()
    print(f"Our Aggregator: {glovo}")
    if not glovo:
        print("ERROR: No 'our_company' aggregator found.")
        return

    # 2. Find a product with prices
    # Find product that has a price from Glovo AND at least one other price
    products = Product.objects.filter(price__aggregator=glovo).distinct()
    print(f"Products with Glovo price: {products.count()}")
    
    target_product = None
    for p in products:
        prices = p.price_set.all()
        aggs = [price.aggregator.name for price in prices]
        if len(aggs) > 1 and glovo.name in aggs:
            target_product = p
            print(f"Found target product: {p.name} (Prices from: {aggs})")
            break
            
    if not target_product:
        print("No product found with both Glovo and Competitor prices.")
        return

    # 3. Run Matcher
    matcher = ProductMatcher()
    print(f"\nRunning Matcher for '{target_product.name}'...")
    
    # Manually step through logic to print details
    prices = Price.objects.filter(product=target_product).select_related('aggregator')
    our_price_obj = None
    competitor_prices = []
    
    for price in prices:
        print(f" - Price: {price.price} ({price.aggregator.name}), IsOur: {price.aggregator.is_our_company}")
        if price.aggregator.is_our_company:
            our_price_obj = price
        elif price.is_available and price.price:
            competitor_prices.append({
                'raw_price': float(price.price),
                'normalized_price': matcher.normalize_price(target_product, price.price),
                'aggregator': price.aggregator.name,
                'competitor_brand': price.competitor_brand,
                'competitor_country': price.competitor_country
            })
            
    print(f"Competitor Prices parsed: {competitor_prices}")
    
    if not competitor_prices:
        print("No valid competitor prices found.")
        return

    # Call run
    rec = matcher.run(target_product)
    print(f"\nResult Recommendation: {rec}")
    if rec:
        print(f"Action: {rec.action_type}, Suggested: {rec.recommended_price}")
        
if __name__ == '__main__':
    debug()
