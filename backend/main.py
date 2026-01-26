"""
ScoutAlgo Backend - FastAPI + MongoDB
Price comparison platform
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import asyncio
import logging
import os
from datetime import datetime, timedelta

from database import connect_db, close_db, get_db
from routers import products, dashboard, categories, aggregators, import_data, recommendations, cities
from services.external_import import import_from_external_api, get_external_import_status
from services.product_mapper import ProductMapper, MATCHING_STATUS

# Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# External import scheduler settings
SCHEDULE_ENABLED = os.getenv("EXTERNAL_IMPORT_SCHEDULE_ENABLED", "true").lower() in ("1", "true", "yes")
SCHEDULE_HOUR = int(os.getenv("EXTERNAL_IMPORT_SCHEDULE_HOUR", "3"))
SCHEDULE_MINUTE = int(os.getenv("EXTERNAL_IMPORT_SCHEDULE_MINUTE", "0"))
AUTO_MATCH_AFTER_IMPORT = os.getenv("AUTO_MATCH_AFTER_IMPORT", "true").lower() in ("1", "true", "yes")
MATCHING_BATCH_SIZE = int(os.getenv("MATCHING_BATCH_SIZE", "10"))
MATCHING_USE_AI = os.getenv("MATCHING_USE_AI", "true").lower() in ("1", "true", "yes")


async def _sleep_until_next_run() -> None:
    now = datetime.now()
    next_run = now.replace(
        hour=SCHEDULE_HOUR,
        minute=SCHEDULE_MINUTE,
        second=0,
        microsecond=0
    )
    if next_run <= now:
        next_run += timedelta(days=1)
    delay = (next_run - now).total_seconds()
    logger.info(f"⏳ Next external import scheduled in {int(delay)}s")
    await asyncio.sleep(delay)


async def _run_daily_import_cycle() -> None:
    while True:
        await _sleep_until_next_run()
        if not SCHEDULE_ENABLED:
            continue

        status = get_external_import_status()
        if status.get("is_running"):
            logger.info("⏭️ External import already running, skipping scheduled run")
            continue

        try:
            logger.info("📥 Starting scheduled external import...")
            await import_from_external_api()

            if AUTO_MATCH_AFTER_IMPORT and not MATCHING_STATUS.get("is_running"):
                logger.info("🧠 Starting scheduled AI matching...")
                db = get_db()
                mapper = ProductMapper(db)
                await mapper.run_matching(
                    batch_size=MATCHING_BATCH_SIZE,
                    use_ai=MATCHING_USE_AI
                )
        except Exception as exc:
            logger.error(f"Scheduled import failed: {exc}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("🚀 Starting ScoutAlgo Backend...")
    await connect_db()
    logger.info("✅ Connected to MongoDB")

    app.state.external_import_task = None
    if SCHEDULE_ENABLED:
        logger.info("🗓️ External import scheduler enabled")
        app.state.external_import_task = asyncio.create_task(_run_daily_import_cycle())
    else:
        logger.info("🛑 External import scheduler disabled")

    yield

    logger.info("🛑 Shutting down...")
    task = getattr(app.state, "external_import_task", None)
    if task:
        task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            pass

    await close_db()
    logger.info("✅ Disconnected from MongoDB")


# 🔥 СОЗДАЁМ APP ОДИН РАЗ
app = FastAPI(
    title="ScoutAlgo API",
    version="2.0.0",
    lifespan=lifespan
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ✅ РЕГИСТРАЦИЯ РОУТОВ (ПОСЛЕ СОЗДАНИЯ APP)
app.include_router(products.router, prefix="/api", tags=["Products"])
app.include_router(dashboard.router, prefix="/api", tags=["Dashboard"])
app.include_router(categories.router, prefix="/api", tags=["Categories"])
app.include_router(aggregators.router, prefix="/api", tags=["Aggregators"])
app.include_router(import_data.router, prefix="/api", tags=["Import"])
app.include_router(recommendations.router, prefix="/api", tags=["Recommendations"])
app.include_router(cities.router, prefix="/api", tags=["Cities"])


@app.get("/")
async def root():
    return {"message": "ScoutAlgo API running"}


@app.get("/health")
async def health():
    return {"status": "healthy"}
