
import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv()
MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
MONGO_DB_NAME = os.getenv("MONGO_DB_NAME", "scoutalgo")

async def check_count():
    client = AsyncIOMotorClient(MONGO_URI, tlsAllowInvalidCertificates=True)
    db = client[MONGO_DB_NAME]
    count = await db.products.count_documents({})
    print(f"Total products: {count}")
    
    our_company = os.getenv("OUR_COMPANY_AGGREGATOR", "Рядом")
    ours = await db.products.count_documents({"prices.aggregator": our_company})
    print(f"Our products ({our_company}): {ours}")
    
    merged = await db.products.count_documents({"mapping_status": "merged_into_parent"})
    print(f"Merged products: {merged}")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(check_count())
