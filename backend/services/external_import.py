import os
import httpx
from pymongo import UpdateOne
from database import get_db

EXTERNAL_API_BASE = os.getenv("EXTERNAL_API_BASE")
EXTERNAL_API_TOKEN = os.getenv("EXTERNAL_API_TOKEN")


async def import_products_from_external(file_id: str):
    if not EXTERNAL_API_BASE or not EXTERNAL_API_TOKEN:
        raise Exception("External API not configured")

    url = f"{EXTERNAL_API_BASE}/api/csv-data/{file_id}"
    headers = {"Authorization": f"Bearer {EXTERNAL_API_TOKEN}"}

    # 🔹 Скачиваем данные
    async with httpx.AsyncClient(timeout=300) as client:
        response = await client.get(url, headers=headers)

    if response.status_code != 200:
        raise Exception(f"External API error: {response.text}")

    data = response.json()

    if "data" not in data:
        raise Exception("Invalid data format from external API")

    products = data["data"]

    if not isinstance(products, list):
        raise Exception("Products data is not a list")

    db = get_db()

    bulk_ops = []

    for p in products:
        external_id = p.get("id")
        if not external_id:
            continue

        # 🔥 ВАЖНО — ДОБАВЛЯЕМ ПОЛЯ, КОТОРЫЕ ЖДЁТ ТВОЙ API
        p["external_id"] = external_id
        p["aggregator"] = "airba"
        p["mapping_status"] = "mapped"
        p["is_active"] = True

        bulk_ops.append(
            UpdateOne(
                {"external_id": external_id},
                {"$set": p},
                upsert=True
            )
        )

    if not bulk_ops:
        return {"inserted": 0, "updated": 0, "message": "No valid products"}

    result = await db.products.bulk_write(bulk_ops)

    return {
        "inserted": result.upserted_count,
        "updated": result.modified_count,
        "total_processed": len(bulk_ops)
    }
