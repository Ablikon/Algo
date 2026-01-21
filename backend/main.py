"""
ScoutAlgo Backend - FastAPI + MongoDB

Price comparison platform for 6 aggregators with AI-powered product matching.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import logging

from database import connect_db, close_db
from routers import products, dashboard, categories, aggregators, import_data, recommendations, cities

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events"""
    # Startup
    logger.info("🚀 Starting ScoutAlgo Backend...")
    await connect_db()
    logger.info("✅ Connected to MongoDB")
    
    yield
    
    # Shutdown
    logger.info("🛑 Shutting down...")
    await close_db()
    logger.info("✅ Disconnected from MongoDB")


app = FastAPI(
    title="ScoutAlgo API",
    description="Price comparison and AI product matching platform",
    version="2.0.0",
    lifespan=lifespan
)

# CORS middleware - allow frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(products.router, prefix="/api", tags=["Products"])
app.include_router(dashboard.router, prefix="/api", tags=["Dashboard"])
app.include_router(categories.router, prefix="/api", tags=["Categories"])
app.include_router(aggregators.router, prefix="/api", tags=["Aggregators"])
app.include_router(import_data.router, prefix="/api", tags=["Import"])
app.include_router(recommendations.router, prefix="/api", tags=["Recommendations"])
app.include_router(cities.router, prefix="/api", tags=["Cities"])


@app.get("/")
async def root():
    return {"message": "ScoutAlgo API v2.0", "status": "running"}


@app.get("/health")
async def health_check():
    return {"status": "healthy"}
