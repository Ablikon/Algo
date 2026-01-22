import asyncio
import os
import sys

# Add backend to path
sys.path.append(os.path.join(os.getcwd(), 'backend'))

from database import connect_db, close_db, get_db
from routers.dashboard import get_dashboard_stats
from routers.import_data import get_analytics_gaps
from routers.products import get_products_comparison

async def test_endpoints():
    await connect_db()
    
    print("Testing /api/dashboard/...")
    try:
        stats = await get_dashboard_stats(city=None)
        print("✅ Dashboard stats loaded")
    except Exception as e:
        print(f"❌ Dashboard stats failed: {e}")
        import traceback
        traceback.print_exc()

    print("\nTesting /api/analytics/gaps/...")
    try:
        gaps = await get_analytics_gaps(limit=1000)
        print(f"✅ Gaps loaded: {len(gaps)}")
    except Exception as e:
        print(f"❌ Gaps failed: {e}")
        import traceback
        traceback.print_exc()

    print("\nTesting /api/products/comparison/...")
    try:
        comparison = await get_products_comparison(page=1, page_size=5, search=None, city=None, category_ids=None)
        print(f"✅ Product comparison loaded: {len(comparison['results'])}")
    except Exception as e:
        print(f"❌ Product comparison failed: {e}")
        import traceback
        traceback.print_exc()

    await close_db()

if __name__ == "__main__":
    asyncio.run(test_endpoints())
