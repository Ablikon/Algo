
import asyncio
import os
import re
import sys
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from bson import ObjectId
from difflib import SequenceMatcher

# Add backend to path for imports
sys.path.append(os.path.join(os.getcwd(), 'backend'))

load_dotenv()
MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
MONGO_DB_NAME = os.getenv("MONGO_DB_NAME", "scoutalgo")
OUR_COMPANY = os.getenv("OUR_COMPANY_AGGREGATOR", "Рядом")

def normalize_text(text):
    if not text:
        return ""
    text = str(text).lower().strip()
    # Remove special chars but keep spaces
    text = re.sub(r"[^\w\sа-яёіїєґ]+", " ", text, flags=re.UNICODE)
    text = re.sub(r"\s+", " ", text)
    return text.strip()

def extract_weight(text):
    if not text:
        return None
    match = re.search(r"(\d+[.,]?\d*)\s*(кг|kg|л|l|мл|ml|г|g|гр)\b", str(text).lower())
    if not match:
        return None
    try:
        value = float(match.group(1).replace(",", "."))
        unit = match.group(2)
        if unit in ("kg", "кг", "l", "л"):
            return value * 1000
        return value
    except:
        return None

class AggressiveMatcher:
    def __init__(self, ryadom_products):
        print(f"Indexing {len(ryadom_products)} products...")
        self.products = ryadom_products
        self.name_index = {}
        self.brand_weight_index = {}
        
        for p in ryadom_products:
            name = p.get('name')
            norm_name = normalize_text(name)
            if norm_name:
                if norm_name not in self.name_index:
                    self.name_index[norm_name] = []
                self.name_index[norm_name].append(p)
            
            brand = normalize_text(p.get('brand'))
            weight = extract_weight(name) or p.get('weight_value')
            if brand and weight:
                key = f"{brand}|{int(weight)}"
                if key not in self.brand_weight_index:
                    self.brand_weight_index[key] = []
                self.brand_weight_index[key].append(p)
            
            # Also index just by brand for the fuzzy step
            if brand:
                b_key = f"BRAND:{brand}"
                if b_key not in self.brand_weight_index:
                    self.brand_weight_index[b_key] = []
                self.brand_weight_index[b_key].append(p)

    def find_match(self, item_name, item_brand=None, item_weight=None):
        if not item_name: return None
        norm_name = normalize_text(item_name)
        
        # 1. Exact normalized name match
        if norm_name in self.name_index:
            return self.name_index[norm_name][0]
        
        # 2. Brand + Weight match (very reliable for packaged goods)
        norm_brand = normalize_text(item_brand) if item_brand else None
        weight_val = extract_weight(item_name) or item_weight
        if norm_brand and weight_val:
            bw_key = f"{norm_brand}|{int(weight_val)}"
            if bw_key in self.brand_weight_index:
                # If multiple, take the first or try to find best name match
                candidates = self.brand_weight_index[bw_key]
                if len(candidates) == 1:
                    return candidates[0]
                # Pick one with highest similarity
                best_c = None
                best_s = 0
                for c in candidates:
                    s = SequenceMatcher(None, norm_name, normalize_text(c.get('name'))).ratio()
                    if s > best_s:
                        best_s = s
                        best_c = c
                if best_s > 0.6:
                    return best_c

        # 3. FAST Fuzzy matching (Optimized)
        # Only check if we have a brand match, otherwise skip to avoid O(N*M) complexity
        if norm_brand:
            brand_products = self.brand_weight_index.get(f"BRAND:{norm_brand}", [])
            if not brand_products:
                 # Fallback: try to find brand in name_index keys? Too slow.
                 return None
            
            best_match = None
            max_ratio = 0.85 # High threshold for speed/accuracy trade-off
            
            for p in brand_products:
                p_norm = normalize_text(p.get('name'))
                # Quick length check optimization
                if abs(len(norm_name) - len(p_norm)) > 10:
                    continue
                    
                ratio = SequenceMatcher(None, norm_name, p_norm).ratio()
                if ratio > max_ratio:
                    # Check weight if both have it
                    p_weight = extract_weight(p.get('name')) or p.get('weight_value')
                    if weight_val and p_weight and abs(weight_val - p_weight) > 5:
                        continue
                    max_ratio = ratio
                    best_match = p
            if best_match: return best_match

        return None

async def migrate():
    print(f"Connecting to {MONGO_DB_NAME}...")
    client = AsyncIOMotorClient(MONGO_URI, tlsAllowInvalidCertificates=True)
    db = client[MONGO_DB_NAME]
    
    # 1. Load ALL Ryadom products
    print(f"Loading ALL '{OUR_COMPANY}' products...")
    ryadom_products = await db.products.find({"prices.aggregator": OUR_COMPANY}).to_list(length=40000)
    print(f"Loaded {len(ryadom_products)} baseline products.")
    
    matcher = AggressiveMatcher(ryadom_products)
    
    # 2. Find standalone products (not ours and not already merged)
    cursor = db.products.find({
        "prices.aggregator": {"$ne": OUR_COMPANY},
        "mapping_status": {"$ne": "merged_into_parent"}
    })
    
    total_checked = 0
    total_merged = 0
    
    print("Starting aggressive migration phase...")
    async for product in cursor:
        total_checked += 1
        if total_checked % 100 == 0:
            print(f"Checked {total_checked} products, Merged so far: {total_merged}")
            
        target_id = None
        
        # Strategy A: Check matched_uuid in ANY price entry (legacy import)
        for pr in product.get('prices', []):
            uuid = pr.get('matched_uuid')
            if uuid:
                # Try to find if this UUID exists as external_id in our prices or as an _id
                # (Optimization: We'll assume the user wants us to use our logic if UUID doesn't directly map)
                pass # Already checked in debug - they don't map directly to _id
        
        # Strategy B: Use aggressive matcher
        match = matcher.find_match(
            product.get('name'), 
            product.get('brand'), 
            product.get('weight_value')
        )
        
        if match:
            target_id = match['_id']
            
            # MERGE
            # 1. Add these prices to the target parent
            await db.products.update_one(
                {"_id": target_id},
                {
                    "$addToSet": {
                        "prices": {"$each": product['prices']}
                    },
                    "$set": {
                        "mapping_status": "matched"
                    }
                }
            )
            
            # 2. Mark current as merged
            await db.products.update_one(
                {"_id": product['_id']},
                {"$set": {
                    "mapping_status": "merged_into_parent", 
                    "parent_id": target_id
                }}
            )
            total_merged += 1

    print(f"\n--- Aggressive Migration Completed ---")
    print(f"Total checked: {total_checked}")
    print(f"Total merged: {total_merged}")
    client.close()

if __name__ == "__main__":
    asyncio.run(migrate())
