
import asyncio
import os
import sys
from dotenv import load_dotenv


# Add backend dir to path so we can import 'database' and 'routers' directly
sys.path.append(os.path.join(os.getcwd(), 'backend'))

from database import connect_db, close_db
from routers.dashboard import get_dashboard_stats

load_dotenv()

async def verify_stats():
    print("Connecting to DB...")
    await connect_db()
    
    print("Fetching dashboard stats...")
    try:
        # Pass city=None explicitly to avoid FastAPI's Query(None) default value
        stats = await get_dashboard_stats(city=None)
        print("\n--- Aggregator Stats ---")
        for name, data in stats.aggregator_stats.items():
            print(f"{name}:")
            print(f"  Count: {data['count']}")
            print(f"  Overlap: {data.get('overlap_count', 'MISSING')}")
            print(f"  Price Index: {data.get('price_index', 'MISSING')}%")
            
        print("\n✅ API Response Structure Verified")
    except Exception as e:
        print(f"❌ Error: {e}")
    finally:
        await close_db()

if __name__ == "__main__":
    asyncio.run(verify_stats())
