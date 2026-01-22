
import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv()
MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
MONGO_DB_NAME = os.getenv("MONGO_DB_NAME", "scoutalgo")

async def get_names():
    client = AsyncIOMotorClient(MONGO_URI, tlsAllowInvalidCertificates=True)
    db = client[MONGO_DB_NAME]
    
    # Get unique aggregators from the nested prices array
    pipeline = [
        {"$unwind": "$prices"},
        {"$group": {"_id": "$prices.aggregator", "count": {"$sum": 1}}}
    ]
    
    results = await db.products.aggregate(pipeline).to_list(length=100)
    print("--- Aggregator Names Found in DB ---")
    for r in results:
        print(f"'{r['_id']}': {r['count']} entries")
        
    client.close()

if __name__ == "__main__":
    asyncio.run(get_names())
