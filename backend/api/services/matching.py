from decimal import Decimal
from ..models import Price, Recommendation, Aggregator

class ProductMatcher:
    def __init__(self):
        self.our_aggregator = Aggregator.objects.filter(is_our_company=True).first()

    def normalize_price(self, product, price_value):
        """Returns price per kg/l if weight is available, else raw price"""
        if not price_value or not product.weight_value or not product.weight_unit:
            return float(price_value)
        
        try:
            val = float(price_value)
            weight = float(product.weight_value)
            unit = product.weight_unit.lower()

            if unit == 'kg' or unit == 'l':
                return val / weight
            elif unit == 'g' or unit == 'ml':
                # Price for 1000 units
                return val / (weight / 1000.0)
            elif unit == 'pcs':
                return val / weight
            return val
        except:
            return float(price_value)

    def denormalize_price(self, product, normalized_price):
        """Converts normalized price back to item price"""
        if not normalized_price or not product.weight_value or not product.weight_unit:
            return Decimal(str(normalized_price))

        try:
            norm_val = float(normalized_price)
            weight = float(product.weight_value)
            unit = product.weight_unit.lower()

            item_price = norm_val
            if unit == 'kg' or unit == 'l':
                item_price = norm_val * weight
            elif unit == 'g' or unit == 'ml':
                item_price = norm_val * (weight / 1000.0)
            elif unit == 'pcs':
                item_price = norm_val * weight
            
            return Decimal(f"{item_price:.2f}")
        except:
             return Decimal(str(normalized_price))

    def run(self, product):
        prices = Price.objects.filter(product=product).select_related('aggregator')
        our_price_obj = None
        competitor_prices = []

        for price in prices:
            if price.aggregator.is_our_company:
                our_price_obj = price
            elif price.is_available and price.price:
                # Store both raw and normalized for logic
                competitor_prices.append({
                    'raw_price': float(price.price),
                    'normalized_price': self.normalize_price(product, price.price),
                    'aggregator': price.aggregator.name
                })

        if not competitor_prices:
            return None

        # Find best competitor by NORMALIZED price
        # Filter out mismatches if possible?
        # If we have brand info, prioritize exact matches.
        
        valid_competitors = []
        for comp in competitor_prices:
            # Logic: If we have specific brand/country info, and they differ significantly, maybe skip?
            # For now, we will add a 'match_quality' score or just flag it.
            # But the requirement is to "pick price based on mass/firm".
            # We already normalize mass.
            # Firm (Brand):
            
            is_brand_mismatch = False
            if product.brand and comp.get('competitor_brand'):
                 if product.brand.lower() != comp['competitor_brand'].lower():
                     is_brand_mismatch = True
            
            is_country_mismatch = False
            if product.country_of_origin and comp.get('competitor_country'):
                if product.country_of_origin.lower() != comp['competitor_country'].lower():
                    is_country_mismatch = True

            # Strategy: If mismatch, we only consider them if they are CHEAPER significantly? 
            # Or we say: If mismatch, we ignore them for "Lower Price" actions?
            # "1 in KZ vs 1 in DE". DE is likely more expensive. 
            # If I sell KZ (cheaper) and see DE (market price high), I shouldn't raise my price to DE level?
            # Actually, standard matching:
            # If I sell Premium, and Competitor sells Generic -> He is cheaper -> I ignore.
            # If I sell Generic, and Competitor sells Premium -> He is expensive -> I ignore.
            
            # Implementation: If explicit mismatch, skip this price for recommendation calculation.
            if is_brand_mismatch or is_country_mismatch:
                continue
                
            valid_competitors.append(comp)

        if not valid_competitors:
             # Fallback: if ALL are mismatched (or no metadata), using raw/all might be better than nothing?
             # For now, strictly respect the constraint if metadata exists.
             if competitor_prices and not valid_competitors:
                 # If we filtered everything out, maybe just take the best one but mark low priority?
                 # Start with STRICT mode: no valid competitors = no action.
                 return None
             return None

        best_competitor = min(valid_competitors, key=lambda x: x['normalized_price'])
        
        # Check specific strategy for this product category if needed (future proofing)
        # For now, simplistic "beat the best price"
        
        # Determine our normalized price
        our_raw = float(our_price_obj.price) if (our_price_obj and our_price_obj.price) else None
        our_norm = self.normalize_price(product, our_price_obj.price) if our_raw else None

        existing = Recommendation.objects.filter(
            product=product,
            status='PENDING'
        ).exists()

        if existing:
            return None

        # TARGET: Beat them by ~1% or 1 Tinge on normalized scale, then convert back
        target_norm = best_competitor['normalized_price'] * 0.99 
        # Or just match? User said 1g difference logic... 
        # "1 portion 600tg 0.9kg vs 1kg... based on grammage pick price"
        
        # We want to be competitive per unit.
        # If their 1kg is 1000tg => 1000/kg.
        # My 0.9kg should be < 900tg (1000/kg).
        # Let's say we want to be 1% cheaper per unit.
        
        target_raw = self.denormalize_price(product, target_norm)

        rec = None

        if not our_raw:
             # We don't have a price -> ADD PRODUCT
            rec = Recommendation(
                product=product,
                action_type='ADD_PRODUCT',
                current_price=None,
                recommended_price=target_raw,
                competitor_price=Decimal(str(best_competitor['raw_price'])),
                priority='HIGH',
                status='PENDING'
            )
        
        elif our_norm > best_competitor['normalized_price']:
            # We are more expensive per unit
            savings = our_raw - float(target_raw)
            priority = 'LOW'
            if savings > 50: priority = 'HIGH'
            elif savings > 10: priority = 'MEDIUM'

            rec = Recommendation(
                product=product,
                action_type='LOWER_PRICE',
                current_price=Decimal(str(our_raw)),
                recommended_price=target_raw,
                competitor_price=Decimal(str(best_competitor['raw_price'])), # Shows their raw price on shelf
                potential_savings=Decimal(str(savings)),
                priority=priority,
                status='PENDING'
            )
        
        if rec:
            rec.save()
            return rec
        return None
