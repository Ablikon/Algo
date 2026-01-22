from database import get_db
import asyncio
import json

async def check():
    db = get_db()
    product = await db.products.find_one()
    print(json.dumps(product, indent=2, default=str))

if __name__ == "__main__":
    asyncio.run(check())
