
import os
from pymongo import MongoClient
from dotenv import load_dotenv

def check():
    load_dotenv()
    mongo_url = os.getenv("MONGO_URI") or os.getenv("MONGODB_URL")
    db_name = os.getenv("MONGO_DB_NAME") or "scoutalgo"
    our_agg = os.getenv("OUR_COMPANY_AGGREGATOR") or "Рядом"

    print(f"URL: {mongo_url}")
    print(f"DB: {db_name}")
    print(f"Our Aggregator: {our_agg}")

    client = MongoClient(mongo_url)
    db = client[db_name]

    total = db.products.count_documents({})
    # Check different ways our products might be stored
    our_by_agg_field = db.products.count_documents({"aggregator_id": our_agg})
    our_by_prices_agg = db.products.count_documents({"prices.aggregator": our_agg})

    print(f"Total products in DB: {total}")
    print(f"Products with aggregator_id='{our_agg}': {our_by_agg_field}")
    print(f"Products with prices.aggregator='{our_agg}': {our_by_prices_agg}")

    # Check aggregators count
    aggs = db.products.aggregate([
        {"$unwind": "$prices"},
        {"$group": {"_id": "$prices.aggregator", "count": {"$sum": 1}}}
    ])
    print("Aggregator distributions (in prices):")
    for a in aggs:
        print(f"  - {a['_id']}: {a['count']}")

    # Check mapping status distribution
    status_dist = db.products.aggregate([
        {"$group": {"_id": "$mapping_status", "count": {"$sum": 1}}}
    ])
    print("Mapping status distribution:")
    for s in status_dist:
        print(f"  - {s['_id']}: {s['count']}")

    client.close()

if __name__ == "__main__":
    check()
