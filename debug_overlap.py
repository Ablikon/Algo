
import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

# Load environment variables
load_dotenv()
MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
MONGO_DB_NAME = os.getenv("MONGO_DB_NAME", "scoutalgo")
OUR_COMPANY = os.getenv("OUR_COMPANY_AGGREGATOR", "Рядом")

async def analyze_data():
    client = AsyncIOMotorClient(MONGO_URI, tlsAllowInvalidCertificates=True)
    db = client[MONGO_DB_NAME]

    print(f"--- Analysis Status ---")
    print(f"Our Company: {OUR_COMPANY}")

    # 1. Total products
    total = await db.products.count_documents({})
    print(f"Total products in DB: {total}")

    # 2. Products with OUR prices
    with_ours = await db.products.count_documents({"prices.aggregator": OUR_COMPANY})
    print(f"Products with '{OUR_COMPANY}' price: {with_ours}")

    # 3. Check specific aggregators from the screenshot
    # Magnum and Airba Fresh seemed to have 0 or very low overlap in the bar chart
    aggregators = ["Magnum", "Airba Fresh", "Arbuz.kz", "Wolt", "Yandex Lavka"]

    print(f"\n--- Overlap Detailed Check ---")
    for agg in aggregators:
        # Total counts for this agg
        count = await db.products.count_documents({"prices.aggregator": agg})

        # Overlap with OUR_COMPANY
        overlap = await db.products.count_documents({
            "$and": [
                {"prices.aggregator": agg},
                {"prices.aggregator": OUR_COMPANY}
            ]
        })

        print(f"{agg}: Total={count}, Overlap with {OUR_COMPANY}={overlap}")

    # 4. Sample check of a product that has both
    sample = await db.products.find_one({
        "$and": [
            {"prices.aggregator": {"$in": aggregators}},
            {"prices.aggregator": OUR_COMPANY}
        ]
    })

    if sample:
        print(f"\n--- Sample Product with overlap ---")
        print(f"Name: {sample.get('name')}")
        print(f"Aggregators: {[p['aggregator'] for p in sample.get('prices', [])]}")
    else:
        print("\nNo products found with overlap in this sampled subset.")

    client.close()

if __name__ == "__main__":
    asyncio.run(analyze_data())
