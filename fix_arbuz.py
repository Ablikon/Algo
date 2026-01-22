
import asyncio
import os
from database import connect_db, get_db

# Load env vars
from dotenv import load_dotenv
load_dotenv()

async def fix_arbuz_city():
    print("Connecting to DB...")
    await connect_db()
    db = get_db()
    
    print('Updating Arbuz cities...')
    # Pass array_filters as a keyword argument to avoid it being interpreted as 'upsert'
    result = await db.products.update_many(
        {'prices.aggregator': 'Arbuz.kz', 'prices.city': None},
        {'$set': {'prices.$[elem].city': 'almaty'}},
        array_filters=[{'elem.aggregator': 'Arbuz.kz', 'elem.city': None}]
    )
    print(f'Matched {result.matched_count} documents')
    print(f'Modified {result.modified_count} documents')

if __name__ == "__main__":
    asyncio.run(fix_arbuz_city())
