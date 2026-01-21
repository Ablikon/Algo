from django.core.management.base import BaseCommand
from api.models import ProductLink, Aggregator
from urllib.parse import quote

class Command(BaseCommand):
    help = 'Fix missing URLs for Glovo products by generating search links'

    def handle(self, *args, **options):
        # Find Glovo aggregator
        glovo_aggs = Aggregator.objects.filter(name__icontains='Glovo')
        if not glovo_aggs.exists():
            self.stdout.write(self.style.ERROR('Glovo aggregator not found'))
            return
        
        updated_count = 0
        
        for glovo in glovo_aggs:
            self.stdout.write(f"Processing aggregator: {glovo.name}")
            
            # Find links with empty URL
            links = ProductLink.objects.filter(aggregator=glovo, url='')
            
            # Also find links with url=None (if any)
            links_none = ProductLink.objects.filter(aggregator=glovo, url__isnull=True)
            
            all_links = links | links_none
            
            self.stdout.write(f"Found {all_links.count()} links to fix.")
            
            for link in all_links:
                product_name = link.product.name
                # Construct search URL
                # Example: https://glovoapp.com/kz/ru/almaty/search/?query={name}
                # Using 'ru' and 'almaty' as default, assuming mostly Almaty from filenames.
                # Ideally check city, but ProductLink doesn't have city. Product has city? 
                # Product model doesn't have city (Wait, JSON importer parsed city?).
                # Let's check Product model again? 
                # Product field 234: product['city'] = data.get('city').
                # Importer line 452: Product.objects.update_or_create(..., defaults={'category'...}).
                # Does Product model have city?
                # Step 456 shows Product model... It does NOT have city.
                # Price has city. 
                # So Product is global? Or city-agnostic?
                # Actually, identical products in different cities should be same Product ID?
                # For Glovo, 'product_id': 'almaty-J9I474'. The ID contains city.
                # So products are likely duplicated per city if IDs differ.
                
                # I'll use a generic URL or try to guess city from ID?
                # Or just hardcode 'almaty' as it's the main focus.
                # User is in Almaty ("Glovo-express-ala").
                
                encoded_name = quote(product_name)
                new_url = f"https://glovoapp.com/kz/ru/almaty/search/?query={encoded_name}"
                
                link.url = new_url
                link.save()
                updated_count += 1
                
                if updated_count % 100 == 0:
                    self.stdout.write(f"Updated {updated_count} links...")

        self.stdout.write(self.style.SUCCESS(f'Successfully updated {updated_count} Glovo links'))
