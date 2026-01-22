
import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from bson import ObjectId

load_dotenv()
MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
MONGO_DB_NAME = os.getenv("MONGO_DB_NAME", "scoutalgo")
OUR_COMPANY = os.getenv("OUR_COMPANY_AGGREGATOR", "Glovo")

async def migrate_matches():
    client = AsyncIOMotorClient(MONGO_URI, tlsAllowInvalidCertificates=True)
    db = client[MONGO_DB_NAME]
    
    # 1. Find all products that are 'matched' but only have 1 price (ours)
    cursor = db.products.find({
        "mapping_status": "matched",
        "prices.aggregator": OUR_COMPANY,
        "match_result.matched_uuid": {"$exists": True}
    })
    
    count = 0
    merged = 0
    
    async for product in cursor:
        count += 1
        matched_uuid = product.get('match_result', {}).get('matched_uuid')
        if not matched_uuid:
            continue
            
        # The uuid in match_result might be a string
        try:
            target_id = ObjectId(matched_uuid) if isinstance(matched_uuid, str) else matched_uuid
        except:
            print(f"Invalid ID: {matched_uuid}")
            continue
            
        matched_product = await db.products.find_one({"_id": target_id})
        
        if matched_product and 'prices' in matched_product:
            # Merge prices
            await db.products.update_one(
                {"_id": product['_id']},
                {
                    "$addToSet": {
                        "prices": {"$each": matched_product['prices']}
                    }
                }
            )
            # Mark the other as merged
            await db.products.update_one(
                {"_id": matched_product['_id']},
                {"$set": {"mapping_status": "merged_into_parent", "parent_id": product['_id']}}
            )
            merged += 1
            if merged % 10 == 0:
                print(f"Merged {merged} products...")

    print(f"--- Migration Completed ---")
    print(f"Checked: {count}")
    print(f"Actually merged: {merged}")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(migrate_matches())
