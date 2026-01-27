
import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv()
MONGO_URI = os.getenv("MONGO_URI")
MONGO_DB_NAME = os.getenv("MONGO_DB_NAME", "scoutalgo")

async def analyze_aggregators():
    print(f"Connecting to {MONGO_URI} (DB: {MONGO_DB_NAME})")
    client = AsyncIOMotorClient(MONGO_URI)
    db = client[MONGO_DB_NAME]

    # 1. Get distinct aggregators
    distinct_aggregators = await db.products.distinct("prices.aggregator")
    print("Distinct Aggregators:", distinct_aggregators)

    # 2. Calculate "Win Rate" and "Price Index" for each
    our_company = os.getenv("OUR_COMPANY_AGGREGATOR", "Рядом")
    print(f"Our Company: {our_company}")

    pipeline = [
        {"$match": {"prices.aggregator": our_company}}, # Only products we sell
        {"$project": {
            "name": 1,
            "prices": 1
        }}
    ]

    products = await db.products.aggregate(pipeline).to_list(length=2000)
    print(f"Analyzing {len(products)} products that '{our_company}' sells...")

    stats = {}
    for agg in distinct_aggregators:
        if agg == our_company:
            continue
        stats[agg] = {
            "overlap_count": 0,
            "cheaper_count": 0,
            "total_price_ratio": 0,
            "count_for_ratio": 0
        }

    for p in products:
        our_price_entry = next((x for x in p.get("prices", []) if x["aggregator"] == our_company), None)
        if not our_price_entry:
            continue

        our_price = our_price_entry["price"]
        if our_price <= 0: continue

        for price_entry in p.get("prices", []):
            agg = price_entry["aggregator"]
            if agg == our_company:
                continue

            if agg not in stats:
                 continue

            comp_price = price_entry["price"]
            if comp_price <= 0: continue

            stats[agg]["overlap_count"] += 1
            if comp_price < our_price:
                stats[agg]["cheaper_count"] += 1

            stats[agg]["total_price_ratio"] += (comp_price / our_price)
            stats[agg]["count_for_ratio"] += 1

    print("\n--- Stats (vs Our Company) ---")
    for agg, data in stats.items():
        if data["overlap_count"] == 0:
            print(f"{agg}: No overlap")
            continue

        win_rate = (data["cheaper_count"] / data["overlap_count"]) * 100
        avg_ratio = (data["total_price_ratio"] / data["count_for_ratio"]) if data["count_for_ratio"] > 0 else 1.0
        price_index = (avg_ratio - 1) * 100 # +5% or -5%

        print(f"{agg}:")
        print(f"  Overlap: {data['overlap_count']}")
        print(f"  Cheaper than us: {data['cheaper_count']} ({win_rate:.1f}%)")
        print(f"  Avg Price Difference: {price_index:+.1f}%")

if __name__ == "__main__":
    asyncio.run(analyze_aggregators())
