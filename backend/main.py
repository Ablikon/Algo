"""
ScoutAlgo Backend - FastAPI + MongoDB
Price comparison platform
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import logging

from database import connect_db, close_db
from routers import products, dashboard, categories, aggregators, import_data, recommendations, cities

# Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("🚀 Starting ScoutAlgo Backend...")
    await connect_db()
    logger.info("✅ Connected to MongoDB")
    yield
    logger.info("🛑 Shutting down...")
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
