"""
MongoDB Database Connection

Uses Motor (async driver) for high-performance async operations.
Connection pooling is handled automatically by Motor.
"""

from motor.motor_asyncio import AsyncIOMotorClient
from pymongo import IndexModel, ASCENDING, DESCENDING, TEXT
import os
import logging

from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

# MongoDB connection settings
MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
MONGO_DB_NAME = os.getenv("MONGO_DB_NAME", "scoutalgo")

# Global database client and database
client: AsyncIOMotorClient = None
db = None


async def connect_db():
    """Connect to MongoDB and create indexes"""
    global client, db
    
    logger.info(f"Connecting to MongoDB: {MONGO_DB_NAME}")
    
    client = AsyncIOMotorClient(
        MONGO_URI,
        maxPoolSize=50,  # Connection pool for ~40k products
        minPoolSize=10,
        serverSelectionTimeoutMS=5000
    )
    
    db = client[MONGO_DB_NAME]
    
    # Create indexes for performance
    await create_indexes()
    
    return db


async def create_indexes():
    """Create indexes for optimal query performance with 40k+ products"""
    global db
    
    # Products collection indexes
    try:
        await db.products.create_indexes([
            IndexModel([("name", TEXT)]),  # Text search
            IndexModel([("category", ASCENDING)]),
            IndexModel([("subcategory", ASCENDING)]),
            IndexModel([("brand", ASCENDING)]),
            IndexModel([("prices.aggregator", ASCENDING)]),
            IndexModel([("prices.price", ASCENDING)]),
            IndexModel([("mapping_status", ASCENDING)]),
            IndexModel([("created_at", DESCENDING)]),
        ])
        logger.info("✅ Products indexes created")
    except Exception as e:
        logger.warning(f"Products indexes may already exist: {e}")
    
    # Categories collection indexes
    try:
        await db.categories.create_indexes([
            IndexModel([("name", ASCENDING)], unique=True),
            IndexModel([("parent_id", ASCENDING)]),
            IndexModel([("sort_order", ASCENDING)]),
        ])
        logger.info("✅ Categories indexes created")
    except Exception as e:
        logger.warning(f"Categories indexes may already exist: {e}")
    
    # Aggregators collection indexes
    try:
        await db.aggregators.create_indexes([
            IndexModel([("name", ASCENDING)], unique=True),
        ])
        logger.info("✅ Aggregators indexes created")
    except Exception as e:
        logger.warning(f"Aggregators indexes may already exist: {e}")


async def close_db():
    """Close MongoDB connection"""
    global client
    if client:
        client.close()


def get_db():
    """Get database instance"""
    return db
