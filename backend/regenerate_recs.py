import os
import django
import sys

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'scoutalgo.settings')
django.setup()

from api.models import Recommendation, Product
from api.services.matching import ProductMatcher

def run():
    print("Clearing PENDING recommendations...")
    Recommendation.objects.filter(status='PENDING').delete()
    
    print("Regenerating...")
    matcher = ProductMatcher()
    products = Product.objects.all().prefetch_related('price_set__aggregator')
    
    count = 0
    new_recs = 0
    
    for city_slug in ['almaty', 'astana']:
        print(f"Regenerating for {city_slug}...")
        count = 0
        new_recs = 0
        
        for product in products:
            rec = matcher.run(product, city_slug=city_slug)
            if rec:
                new_recs += 1
            count += 1
            if count % 100 == 0:
                print(f"Processed {count} in {city_slug}...")
                
        print(f"Done for {city_slug}. Generated {new_recs} recommendations.")

if __name__ == '__main__':
    run()
