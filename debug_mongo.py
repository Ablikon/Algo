
import asyncio
import os
import sys
import certifi
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo import MongoClient
import ssl

# Load env vars
from dotenv import load_dotenv
load_dotenv()

MONGO_URI = os.getenv("MONGO_URI")
print(f"Testing connection to: {MONGO_URI.split('@')[-1]}")

def test_pymongo_sync():
    print("\n--- Testing Synchronous PyMongo ---")
    try:
        # Test 1: Standard
        print("1. Attempting standard connection...")
        client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=5000)
        client.admin.command('ping')
        print("   ✅ Standard connection SUCCESS!")
        return
    except Exception as e:
        print(f"   ❌ Standard connection FAILED: {e}")

    try:
        # Test 2: No Verify
        print("2. Attempting tlsAllowInvalidCertificates=True...")
        client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=5000, tlsAllowInvalidCertificates=True)
        client.admin.command('ping')
        print("   ✅ No Verify connection SUCCESS!")
        return
    except Exception as e:
        print(f"   ❌ No Verify connection FAILED: {e}")

    try:
        # Test 3: Certifi
        print("3. Attempting certifi CA...")
        client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=5000, tlsCAFile=certifi.where())
        client.admin.command('ping')
        print("   ✅ Certifi connection SUCCESS!")
        return
    except Exception as e:
        print(f"   ❌ Certifi connection FAILED: {e}")

async def test_motor_async():
    print("\n--- Testing Async Motor ---")
    try:
        # Test 1: Standard
        print("1. Attempting standard connection...")
        client = AsyncIOMotorClient(MONGO_URI, serverSelectionTimeoutMS=5000)
        await client.admin.command('ping')
        print("   ✅ Standard connection SUCCESS!")
        return
    except Exception as e:
        print(f"   ❌ Standard connection FAILED: {e}")

    try:
        # Test 2: No Verify
        print("2. Attempting tlsAllowInvalidCertificates=True...")
        client = AsyncIOMotorClient(MONGO_URI, serverSelectionTimeoutMS=5000, tlsAllowInvalidCertificates=True)
        await client.admin.command('ping')
        print("   ✅ No Verify connection SUCCESS!")
        return
    except Exception as e:
        print(f"   ❌ No Verify connection FAILED: {e}")

if __name__ == "__main__":
    print(f"Python SSL Default Verify Paths: {ssl.get_default_verify_paths()}")
    test_pymongo_sync()
    asyncio.run(test_motor_async())
