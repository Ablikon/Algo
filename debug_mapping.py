
import asyncio
import os
import json
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from bson import ObjectId

load_dotenv()
MONGO_URI = os.getenv("MONGO_URI")
MONGO_DB_NAME = os.getenv("MONGO_DB_NAME", "scoutalgo")
OUR_COMPANY = os.getenv("OUR_COMPANY_AGGREGATOR", "Рядом")

async def analyze():
    client = AsyncIOMotorClient(MONGO_URI, tlsAllowInvalidCertificates=True)
    db = client[MONGO_DB_NAME]
    
    sample = await db.products.find_one({"prices.matched_uuid": {"$ne": None}})
    if sample:
        uuid = next(p["matched_uuid"] for p in sample["prices"] if p.get("matched_uuid"))
        print(f"Sample product: {sample['name']}")
        print(f"Sample UUID: {uuid}")
        
        # Look for target in ANYTHING
        # Check if it matches a slug, external_id, ntin, etc.
        target = await db.products.find_one({
            "$or": [
                {"prices.external_id": uuid},
                {"_id": ObjectId(uuid) if len(uuid) == 24 else None},
                {"slug": uuid},
                {"ntin": uuid}
            ]
        })
        if target:
            print(f"Target found: {target['name']} (ID: {target['_id']})")
        else:
            print(f"Target NOT found by any common field.")
            # Search for this UUID string in ANY field of ANY Ryadom product
            # Just to find where it comes from
            regex = f".*{uuid}.*"
            print(f"Searching for string {uuid} in Ryadom products...")
            found = await db.products.find_one({
                "prices.aggregator": OUR_COMPANY,
                "$or": [
                    {"name": {"$regex": regex, "$options": "i"}},
                    {"slug": {"$regex": regex}},
                    {"ntin": {"$regex": regex}}
                ]
            })
            if found:
                print(f"Found Ryadom product mentioning this UUID: {found['name']}")

    client.close()

if __name__ == "__main__":
    asyncio.run(analyze())
