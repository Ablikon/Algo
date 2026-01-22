
import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

async def check():
    load_dotenv()
    mongo_url = os.getenv("MONGO_URI") or os.getenv("MONGODB_URL")
    db_name = os.getenv("MONGO_DB_NAME") or "scoutalgo"
    our_agg = os.getenv("OUR_COMPANY_AGGREGATOR")
    
    print(f"URL: {mongo_url}")
    print(f"DB: {db_name}")
    print(f"Our Aggregator: {our_agg}")
    
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    
    total = await db.products.count_documents({})
    # Check by prices.aggregator
    our_by_prices = await db.products.count_documents({"prices.aggregator": our_agg})
    # Check by aggregator_id (sometimes used)
    our_by_id = await db.products.count_documents({"aggregator_id": our_agg})
    
    print(f"Total products: {total}")
    print(f"Products with prices.aggregator='{our_agg}': {our_by_prices}")
    print(f"Products with aggregator_id='{our_agg}': {our_by_id}")
    
    sample = await db.products.find_one({"prices.aggregator": our_agg})
    if sample:
        print(f"Sample 'our' product: {sample.get('name')} (ID: {sample.get('_id')})")
        print(f"Prices shape: {sample.get('prices')}")
    else:
        sample_any = await db.products.find_one()
        print(f"Sample ANY product: {sample_any.get('name') if sample_any else 'None'}")
        if sample_any:
            print(f"Aggregators in sample: {[p.get('aggregator') for p in sample_any.get('prices', [])]}")
            print(f"Aggregator ID: {sample_any.get('aggregator_id')}")

    client.close()

if __name__ == "__main__":
    asyncio.run(check())
