
import asyncio
import os
import logging
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

# Set up logging to check the mapper output
logging.basicConfig(level=logging.INFO)

load_dotenv()
MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
MONGO_DB_NAME = os.getenv("MONGO_DB_NAME", "scoutalgo")

async def test_new_matching():
    from backend.services.product_mapper import ProductMapper
    
    client = AsyncIOMotorClient(MONGO_URI, tlsAllowInvalidCertificates=True)
    db = client[MONGO_DB_NAME]
    
    # We'll use the ProductMapper from the local code
    mapper = ProductMapper(db)
    
    print("\n--- Running Test Matching (Batch of 20) ---")
    # We use a small batch to see immediately if it's working better
    results = await mapper.run_matching(batch_size=20)
    
    print(f"\n--- Results ---")
    print(f"Total processed: {results['total']}") # This is total Glovo products which is 876
    # Wait, run_matching processes ALL our products by default.
    # I should probably check how many NEW matches it found or if 'matched' count increased.
    
    matched_count = await db.products.count_documents({"mapping_status": "matched"})
    print(f"Current total 'matched' products in DB: {matched_count}")
    
    client.close()

if __name__ == "__main__":
    import sys
    sys.path.append(os.path.join(os.getcwd(), "backend"))
    asyncio.run(test_new_matching())
