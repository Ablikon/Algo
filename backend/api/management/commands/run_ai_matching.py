import os
import time
import re
from django.core.management.base import BaseCommand
from api.models import Product, Aggregator, Price, City, ProductLink
from api.services.ai_matching import AIProductMapper
from django.db.models import Q

class Command(BaseCommand):
    help = 'Run AI matching for products with missing competitor prices'

    def add_arguments(self, parser):
        parser.add_argument('--limit', type=int, default=10, help='Limit number of products to process')
        parser.add_argument('--city', type=str, help='City slug to process')
        parser.add_argument('--cat', type=int, help='Category ID to process')

    def handle(self, *args, **options):
        limit = options['limit']
        city_slug = options['city']
        cat_id = options['cat']
        
        # Get city
        city = None
        if city_slug:
            city = City.objects.filter(slug=city_slug).first()
        else:
            city = City.objects.first() # Default to first city if none specified
            
        if not city:
            self.stdout.write(self.style.ERROR("No city found. Please seed cities first."))
            return
            
        # Get our company aggregator
        our_agg = Aggregator.objects.filter(is_our_company=True).first()
        if not our_agg:
            self.stdout.write(self.style.ERROR("Our company aggregator not found."))
            return

        # Initialize mapper
        mapper = AIProductMapper()
        
        # 1. Target products (ours that need competitive data)
        products = Product.objects.filter(price__aggregator=our_agg, price__city=city)
        if cat_id:
            products = products.filter(category_id=cat_id)
            
        # Exclude those that ALREADY have competitor prices
        products = products.exclude(price__aggregator__is_our_company=False, price__city=city)
        
        products = products[:limit]
        
        self.stdout.write(self.style.SUCCESS(f"Processing {len(products)} products in {city.name}..."))

        for product in products:
            self.stdout.write(f"Matching: {product.name}")
            
            # 2. Candidate Discovery
            # Strategy: first 2-3 significant words from the name
            name_clean = re.sub(r'[^a-zA-Zа-яА-Я0-9\s]', '', product.name).lower()
            words = [w for w in name_clean.split() if len(w) > 2][:3]
            
            if not words:
                self.stdout.write(self.style.WARNING(f"  Too short name for {product.name}"))
                continue
                
            # Search for candidates in the SAME root category but DIFFERENT aggregator
            # Candidates must have prices in the SAME city
            candidate_query = Q()
            for word in words:
                candidate_query |= Q(name__icontains=word)
            
            candidates = Product.objects.filter(
                category=product.category
            ).filter(
                candidate_query
            ).filter(
                price__aggregator__is_our_company=False,
                price__city=city
            ).exclude(id=product.id).distinct()[:10]
            
            candidates_data = []
            for c in candidates:
                # Get first competitor price for info
                p_info = Price.objects.filter(product=c, aggregator__is_our_company=False, city=city).first()
                if p_info:
                    candidates_data.append({
                        'id': c.id,
                        'name': c.name,
                        'brand': c.brand,
                        'weight': f"{c.weight_value}{c.weight_unit}",
                        'aggregator': p_info.aggregator.name,
                        'price': float(p_info.price)
                    })
            
            if not candidates_data:
                self.stdout.write(f"  No competitor candidates found in DB for {product.name}")
                continue
                
            # 3. AI Comparison
            result = mapper.map_product_to_candidates(product, candidates_data)
            
            if result.get('best_match') == 'match' and result.get('match_confidence', 0) >= 90:
                matched_uuid = result.get('matched_uuid')
                confidence = result.get('match_confidence')
                
                # Find the actual candidate product by uuid
                candidate_prod = None
                for c in candidates_data:
                    if c['csv']['uuid'] == matched_uuid:  # Assuming candidates_data has 'csv' key
                        candidate_prod = Product.objects.get(id=c['id'])
                        break
                
                if candidate_prod:
                    self.stdout.write(self.style.SUCCESS(f"  MATCH FOUND ({confidence}%): {candidate_prod.name}"))
                    
                    # 4. Link/Copy Prices
                    comp_prices = Price.objects.filter(product=candidate_prod, city=city).exclude(aggregator=our_agg)
                    
                    for cp in comp_prices:
                        Price.objects.update_or_create(
                            product=product,
                            aggregator=cp.aggregator,
                            city=city,
                            defaults={
                                'price': cp.price,
                                'is_available': cp.is_available,
                                'competitor_brand': cp.competitor_brand,
                                'competitor_country': cp.competitor_country
                            }
                        )
                        self.stdout.write(f"    - Linked price from {cp.aggregator.name}: {cp.price}")
                else:
                    self.stdout.write(self.style.WARNING(f"  Candidate product not found for uuid {matched_uuid}"))
            else:
                self.stdout.write(self.style.WARNING(f"  No match found. Reason: {result.get('reason')}"))

            time.sleep(1)
