
import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv()
MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
MONGO_DB_NAME = os.getenv("MONGO_DB_NAME", "scoutalgo")

async def check_mapping():
    client = AsyncIOMotorClient(MONGO_URI, tlsAllowInvalidCertificates=True)
    db = client[MONGO_DB_NAME]
    
    # 1. Counts of mapping status
    pipeline = [
        {"$group": {"_id": "$mapping_status", "count": {"$sum": 1}}}
    ]
    status_results = await db.products.aggregate(pipeline).to_list(length=10)
    print("--- Mapping Status Counts ---")
    for r in status_results:
        print(f"{r['_id'] or 'None'}: {r['count']}")
        
    # 2. Check a few 'matched' products
    matched_prods = await db.products.find({"mapping_status": "matched"}).limit(3).to_list(length=3)
    print("\n--- Sample Matched Products ---")
    for p in matched_prods:
        print(f"Product: {p.get('name')}")
        print(f"Aggregators in 'prices': {[pr['aggregator'] for pr in p.get('prices', [])]}")
        print(f"Match Result: {p.get('match_result', {}).get('reason', 'No reason')}")
        print("-" * 20)
        
    client.close()

if __name__ == "__main__":
    asyncio.run(check_mapping())
