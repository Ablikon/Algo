
import os
import django
import sys

# Setup Django environment
sys.path.append('/Users/abylajhanbegimkulov/Desktop/ScoutAlgo/backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'scoutalgo.settings')
django.setup()

from api.models import Product, Price, Aggregator, City

def analyze_dashboard_data():
    print("--- Aggregators ---")
    aggregators = Aggregator.objects.all()
    for agg in aggregators:
        price_count = Price.objects.filter(aggregator=agg).count()
        available_count = Price.objects.filter(aggregator=agg, is_available=True, price__isnull=False).count()
        print(f"Aggregator: {agg.name} (ID: {agg.id}), Total Prices: {price_count}, Available: {available_count}, Is Our: {agg.is_our_company}")

    print("\n--- Products & Prices (ALMATY Simulation) ---")
    total_products = Product.objects.count()
    print(f"Total Products In DB: {total_products}")

    # Set Logic Analysis
    products = Product.objects.prefetch_related(
        django.db.models.Prefetch(
            'price_set',
            queryset=Price.objects.filter(city__slug='almaty', is_available=True, price__isnull=False).select_related('aggregator'),
            to_attr='cached_prices'
        )
    )

    our_product_ids = set()
    competitor_product_ids = set() # Union of all competitors
    
    # Per competitor sets
    magnum_ids = set()
    yandex_ids = set()

    for product in products:
        prices = product.cached_prices
        
        has_us = False
        has_competitor = False
        
        for p in prices:
            if p.aggregator.is_our_company:
                has_us = True
                our_product_ids.add(product.id)
            else:
                has_competitor = True
                competitor_product_ids.add(product.id)
                
                # Debug specific aggregators
                if 'Magnum' in p.aggregator.name:
                    magnum_ids.add(product.id)
                elif 'Yandex' in p.aggregator.name:
                    yandex_ids.add(product.id)

    print(f"\n--- SET ANALYSIS ---")
    print(f"1. We have (Our Assortment): {len(our_product_ids)}")
    print(f"2. Any Competitor has (Market Offer): {len(competitor_product_ids)}")
    print(f"   - Magnum has: {len(magnum_ids)}")
    print(f"   - Yandex has: {len(yandex_ids)}")
    
    # Overlaps
    overlap_magnum_yandex = len(magnum_ids.intersection(yandex_ids))
    print(f"   (Overlap Magnum & Yandex: {overlap_magnum_yandex} products common)")
    
    # Missing Logic
    # Missing = Exists in Market Offer BUT NOT in Our Assortment
    missing_set = competitor_product_ids - our_product_ids
    print(f"\n3. Missing Products (Market Offer - Our Assortment): {len(missing_set)}")
    
    # Dead Products
    # Total DB - (Our Union Market)
    active_products = our_product_ids.union(competitor_product_ids)
    dead_products = total_products - len(active_products)
    print(f"4. Dead/Inactive Products (Nobody has): {dead_products}")
    
    print("\n--- SUMMARY FOR USER ---")
    print(f"Old 'Missing' logic (Total ({total_products}) - Ours ({len(our_product_ids)})) = {total_products - len(our_product_ids)}")
    print(f"New 'Missing' logic (competitor_product_ids - our_product_ids) = {len(missing_set)}")


if __name__ == "__main__":
    analyze_dashboard_data()
