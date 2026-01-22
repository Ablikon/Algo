
import asyncio
import os
import re
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv()
MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
MONGO_DB_NAME = os.getenv("MONGO_DB_NAME", "scoutalgo")

def _normalize_string(s):
    if not s: return ''
    s = str(s).lower().strip()
    s = re.sub(r'[^a-z0-9а-яё\s]', ' ', s)
    return ' '.join(s.split())

async def debug_candidates():
    client = AsyncIOMotorClient(MONGO_URI, tlsAllowInvalidCertificates=True)
    db = client[MONGO_DB_NAME]
    
    # Pick some Glovo products
    glovo_products = await db.products.find({"prices.aggregator": "Glovo"}).limit(50).to_list(length=50)
    
    for p in glovo_products:
        name = p['name']
        norm_name = _normalize_string(name)
        keywords = [w for w in norm_name.split() if len(w) > 3][:5]
        brand = _normalize_string(p.get('brand', ''))
        
        print(f"\nProduct: {name}")
        print(f"Keywords: {keywords}, Brand: {brand}")
        
        # Check if we can find ANY potential matches in other aggregators for this name
        # Using a much looser regex
        loose_search = await db.products.find({
            "name": {"$regex": name[:15], "$options": "i"},
            "prices.aggregator": {"$ne": "Glovo"}
        }).limit(5).to_list(length=5)
        
        if loose_search:
            print("Found potential (loose) matches:")
            for ls in loose_search:
                ls_name = ls['name']
                ls_norm = _normalize_string(ls_name)
                ls_brand = _normalize_string(ls.get('brand', ''))
                ls_keywords = [w for w in ls_norm.split() if len(w) > 3]
                
                # Would the current keyword strategy find this?
                intersect = set(keywords) & set(ls_keywords)
                brand_match = (brand == ls_brand) if brand and ls_brand else False
                
                print(f"  - {ls_name} | Agg: {[pr['aggregator'] for pr in ls['prices']]}")
                print(f"    Keyword Intersect: {intersect}, Brand Match: {brand_match}")
                if not intersect and not brand_match:
                    print("    >>> FAILED candidate detection!")

    client.close()

if __name__ == "__main__":
    asyncio.run(debug_candidates())
