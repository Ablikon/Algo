import os
import time
from django.core.management.base import BaseCommand
from api.models import Product, Aggregator, Price, City, ProductLink
from api.services.ai_matching import AIProductMapper
from django.db.models import Q

class Command(BaseCommand):
    help = 'Run AI matching for products with missing competitor prices'

    def add_arguments(self, parser):
        parser.add_argument('--limit', type=int, default=10, help='Limit number of products to process')
        parser.add_argument('--city', type=str, help='City slug to process')

    def handle(self, *args, **options):
        limit = options['limit']
        city_slug = options['city']
        
        # Get city
        city = None
        if city_slug:
            city = City.objects.filter(slug=city_slug).first()
        
        # Initialize mapper
        mapper = AIProductMapper()
        
        # Find products that have few or no competitor prices
        # For simplicity, let's just take first X products
        products = Product.objects.all()
        if city:
            products = products.exclude(price__city=city, price__aggregator__is_our_company=False)
        
        products = products[:limit]
        
        self.stdout.write(self.style.SUCCESS(f"Processing {len(products)} products..."))

        # In a real scenario, we would search other aggregators via scraping or search API
        # Since we are using an existing database, let's simulate by matching against 
        # products that are NOT already linked.
        
        for product in products:
            self.stdout.write(f"Matching: {product.name}")
            
            # This is a bit tricky: who are the candidates? 
            # In this project, candidates are usually products from other aggregators 
            # but since we only have one Product table, we might be looking for 
            # matching existing products or creating Prices for the same product 
            # from different aggregators if they were imported separately.
            
            # THE CORRECT LOGIC for this specific project:
            # We already have a dataset of 3613 products. Many of them might be 
            # duplicates or similar items from different aggregators.
            
            # Actually, the user's dataset seems to have Product as a "Unique Item" 
            # and Price as the aggregator's offering of that item.
            
            # If so, "matching" means finding a Price/Link for this Product 
            # on another aggregator's platform.
            
            # Let's assume we have "Unmatched" results from some scrapers.
            # But the user provided a "ProductMapper" that matches products from candidates.
            
            # Let's simulate a search for candidates (e.g. products with similar names)
            candidates = Product.objects.filter(
                Q(name__icontains=product.name[:10]) | Q(brand__iexact=product.brand)
            ).exclude(id=product.id)[:5]
            
            candidates_data = [
                {
                    'id': c.id,
                    'name': c.name,
                    'brand': c.brand,
                    'weight': f"{c.weight_value}{c.weight_unit}",
                    'aggregator': 'Simulated'
                }
                for c in candidates
            ]
            
            if not candidates_data:
                self.stdout.write(f"  No candidates found for {product.name}")
                continue
                
            result = mapper.map_product_to_candidates(product, candidates_data)
            
            if result.get('best_match') == 'match':
                matched_id = result.get('matched_candidate_id')
                confidence = result.get('match_confidence')
                self.stdout.write(self.style.SUCCESS(f"  MATCH FOUND (Conf: {confidence}%): {matched_id}"))
                self.stdout.write(f"  Reason: {result.get('reason')}")
                
                # In a real system, we'd create a ProductLink or merge products
                # For this demo, we'll just log it.
            else:
                self.stdout.write(self.style.WARNING(f"  No match found. Reason: {result.get('reason')}"))

            # Be nice to the API
            time.sleep(1)
