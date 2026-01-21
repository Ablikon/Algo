import os
import django
import time

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'scoutalgo.settings')
django.setup()

from api.models import Product, Recommendation
from api.services.matching import ProductMatcher

def generate():
    print("Generating recommendations for all products...")
    matcher = ProductMatcher()
    products = Product.objects.all().prefetch_related('price_set__aggregator')
    
    count = 0
    new_recs = 0
    
    for product in products:
        rec = matcher.run(product)
        if rec:
            new_recs += 1
            print(f"Generated: {rec.action_type} for {product.name} (Save: {rec.potential_savings})")
        count += 1
        if count % 50 == 0:
            print(f"Processed {count} products...")
            
    print(f"Finished. Total processed: {count}. New Recommendations: {new_recs}")

if __name__ == '__main__':
    generate()
