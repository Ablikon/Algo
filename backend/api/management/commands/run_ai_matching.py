import os
import time
import re
from django.core.management.base import BaseCommand
from api.models import Product, Aggregator, Price, City, ProductLink
from api.services.ai_matching import AIProductMatcher
from django.db.models import Q

class Command(BaseCommand):
    help = 'Run AI matching for products with missing competitor prices'

    def add_arguments(self, parser):
        parser.add_argument('--limit', type=int, help='Limit number of products to process')
        parser.add_argument('--city', type=str, default='Almaty', help='City to process (default: Almaty)')
        parser.add_argument('--keyword', type=str, help='Filter products by name keyword')
        parser.add_argument('--cat', type=int, help='Category ID to process')

    def handle(self, *args, **options):
        limit = options['limit']
        city_name = options['city']
        keyword = options.get('keyword')
        cat_id = options['cat']
        
        try:
            city = City.objects.get(name__icontains=city_name)
        except City.DoesNotExist:
            self.stdout.write(self.style.ERROR(f"City '{city_name}' not found"))
            return
            
        # Get our company aggregator
        try:
            our_agg = Aggregator.objects.get(is_our_company=True)
        except Aggregator.DoesNotExist:
            self.stdout.write(self.style.ERROR("Our company aggregator not found. Set is_our_company=True for one aggregator."))
            return

        # Initialize matcher
        mapper = AIProductMatcher()
        
        # 1. Target products (ours that need competitive data)
        products = Product.objects.filter(
            price__aggregator=our_agg,
            price__city=city
        ).distinct()

        if keyword:
            products = products.filter(name__icontains=keyword)
        
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
            # Filter out common words to avoid broad matching
            STOP_WORDS = {'напиток', 'газированный', 'вода', 'питьевая', 'соки', 'нектар', 'drink', 'water', 'soda', 'beverage'}
            words = [w for w in name_clean.split() if len(w) > 2 and w.lower() not in STOP_WORDS][:3]
            
            if not words:
                # If all words were stop words (e.g. "Drink Water"), fallback to original
                words = [w for w in name_clean.split() if len(w) > 2][:3]
                
            if not words:
                self.stdout.write(self.style.WARNING(f"  Too short name for {product.name}"))
                continue
            
            # Debug
            # self.stdout.write(f"  Debug: Search words: {words}")

            # Search for candidates in the SAME root category but DIFFERENT aggregator
            # Candidates must have prices in the SAME city
            candidate_query = Q()
            for word in words:
                candidate_query |= Q(name__icontains=word)
            
            # Search in same PARENT category to allow cross-subcategory matching (e.g. Fanta in "Coca-Cola" cat vs Fanta in "Fanta" cat)
            parent_cat = product.category.parent if product.category and product.category.parent else product.category
            
            candidates = Product.objects.filter(
                category__parent=parent_cat if product.category.parent else None # If top level, strict match or... logic below
            )
            if not product.category.parent:
                 # If product is top level (unlikely with our importer), use strict category
                 candidates = Product.objects.filter(category=product.category)
            
            candidates = candidates.filter(
                candidate_query
            ).filter(
                price__aggregator__is_our_company=False,
                price__city=city
            ).exclude(id=product.id).distinct()[:200] # Fetch more candidates for ranking
            
            # self.stdout.write(f"  Debug: Raw candidates found in DB: {len(candidates)}")
            
            candidates_data_raw = []
            prod_name_lower = product.name.lower()
            prod_words = set(re.findall(r'\w+', prod_name_lower))

            for c in candidates:
                # Rank candidates by word overlap
                cand_name_lower = c.name.lower()
                cand_words = set(re.findall(r'\w+', cand_name_lower))
                overlap = len(prod_words.intersection(cand_words))
                
                # Boost if brands match
                if product.brand and c.brand and product.brand.lower() == c.brand.lower():
                    overlap += 5
                
                # Get first competitor price for info
                p_info = Price.objects.filter(product=c, aggregator__is_our_company=False, city=city).first()
                if p_info:
                    candidates_data_raw.append({
                        'obj': c,
                        'id': c.id,
                        'name': c.name,
                        'brand': c.brand,
                        'weight': f"{c.weight_value}{c.weight_unit}",
                        'aggregator': p_info.aggregator.name,
                        'price': float(p_info.price),
                        'score': overlap
                    })
            
            # Sort by score desc, take top 10
            candidates_data_raw.sort(key=lambda x: x['score'], reverse=True)
            candidates_data = candidates_data_raw[:10]
            
            if not candidates_data:
                self.stdout.write(f"  No competitor candidates found in DB for {product.name}")
                continue
                
            # 3. AI Comparison
            # Format candidates for AI service
            formatted_candidates = []
            for c in candidates_data:
                formatted_candidates.append({
                    'uuid': str(c['id']),
                    'name': c['name'],
                    'brand': c['brand'],
                    'weight': c['weight'],
                    'category_full': c['aggregator'], # Using aggregator as category info for context if needed, or fetch actual category chain
                    'price': c['price']
                })

            result = mapper.match_product({
                'title': product.name,
                'brand': product.brand,
                'weight': f"{product.weight_value}{product.weight_unit}",
                'category': product.category.name if product.category else ''
            }, formatted_candidates)
            
            if result.get('best_match') == 'match' and result.get('match_confidence', 0) >= 90:
                matched_uuid = result.get('matched_uuid')
                confidence = result.get('match_confidence')
                
                # Find the actual candidate product by uuid
                candidate_prod = None
                for c in candidates_data:
                    if str(c['id']) == matched_uuid:
                        candidate_prod = Product.objects.get(id=c['id'])
                        break
                
                if candidate_prod:
                    self.stdout.write(self.style.SUCCESS(f"  MATCH FOUND ({confidence}%): {candidate_prod.name}"))

                    
                    # 4. Link/Copy Prices
                    comp_prices = Price.objects.filter(product=candidate_prod, city=city, is_available=True).exclude(aggregator=our_agg)
                    
                    for cp in comp_prices:
                        # Create Price
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
                        
                        # Create ProductLink
                        if candidate_prod.image_url: # Assuming we want to link using the candidate's data
                             ProductLink.objects.update_or_create(
                                product=product,
                                aggregator=cp.aggregator,
                                defaults={
                                    'url': candidate_prod.image_url, # Or external_id if we have it. For now using image_url as proxy for link
                                    'external_name': candidate_prod.name,
                                    'is_verified': True
                                }
                             )
                        
                        self.stdout.write(f"    - Linked price from {cp.aggregator.name}: {cp.price}")
                else:
                    self.stdout.write(self.style.WARNING(f"  Candidate product not found for uuid {matched_uuid}"))
            else:
                self.stdout.write(self.style.WARNING(f"  No match. AI Result: {result.get('best_match')} ({result.get('match_confidence')}%)"))
                self.stdout.write(f"  Reason: {result.get('reason')}")
                cand_names = [c['name'] for c in candidates_data]
                self.stdout.write(f"  Candidates considered ({len(cand_names)}): {cand_names[:3]}...")

            time.sleep(1)
