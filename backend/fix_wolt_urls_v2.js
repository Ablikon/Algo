/**
 * Fix Wolt URLs v2 - smart fix
 * 
 * Previous fix replaced ALL Wolt URLs with search links.
 * Actually most Wolt deep links work fine (98%).
 * Only URLs with generic slug "item-itemid-xxx" are broken (~103 URLs).
 * 
 * This script:
 * 1. Restores proper deep links from API for all Wolt products
 * 2. Only replaces "item-itemid-xxx" slugs with search URLs
 */

require('dotenv').config();
const mongoose = require('mongoose');

async function main() {
    await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB_NAME });
    console.log('Connected to MongoDB');

    const Price = require('./src/models/Price');
    const Product = require('./src/models/Product');
    const Aggregator = require('./src/models/Aggregator');
    const City = require('./src/models/City');

    const wolt = await Aggregator.findOne({ name: 'Wolt' });
    if (!wolt) { console.log('Wolt not found'); process.exit(1); }

    const almaty = await City.findOne({ slug: 'almaty' });
    const astana = await City.findOne({ slug: 'astana' });

    const token = process.env.EXTERNAL_API_TOKEN || '7e248c0f2ddbe71f1d2339c731d0c5d5954e647a2c000e96d696c3f78acfb2d5';
    const baseUrl = process.env.EXTERNAL_API_URL || 'http://94.131.88.146:3000';

    // Build a map of title -> original URL from API
    const urlMap = new Map(); // title -> { almaty: url, astana: url }

    for (const [fileId, cityName] of [['wolt_market_almaty_mapped', 'almaty'], ['wolt_market_astana_mapped', 'astana']]) {
        console.log(`Fetching ${fileId}...`);
        const resp = await fetch(`${baseUrl}/api/csv-data/${fileId}`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        const raw = await resp.json();
        const data = raw.data || [];
        console.log(`  Got ${data.length} records`);

        for (const r of data) {
            if (!r.url || !r.title) continue;
            const url = r.url.trim();
            if (!url.includes('wolt.com')) continue;

            if (!urlMap.has(r.title)) urlMap.set(r.title, {});
            urlMap.get(r.title)[cityName] = url;
        }
    }
    console.log(`URL map: ${urlMap.size} unique titles\n`);

    // Get all Wolt prices (currently have search URLs from previous fix)
    const woltPrices = await Price.find({ aggregator: wolt._id })
        .populate('product', 'name')
        .lean();

    console.log(`Found ${woltPrices.length} Wolt price records`);

    let restored = 0;
    let replacedWithSearch = 0;
    let noMatch = 0;
    let alreadyOk = 0;
    const bulkOps = [];

    for (const price of woltPrices) {
        const productName = price.product?.name;
        if (!productName) continue;

        const cityName = price.city?.toString() === almaty?._id?.toString() ? 'almaty' : 'astana';
        const citySlug = cityName === 'astana' ? 'nur-sultan' : 'almaty';

        // Try to find original URL from API
        const urlEntry = urlMap.get(productName);
        let originalUrl = urlEntry?.[cityName];

        if (!originalUrl) {
            // No URL in API for this product - keep search URL
            noMatch++;
            continue;
        }

        // Check if it's a broken generic slug
        const slugMatch = originalUrl.match(/venue\/[^/]+\/(.+)$/);
        if (slugMatch && slugMatch[1].startsWith('item-itemid-')) {
            // Broken URL - use search instead
            const newUrl = `https://wolt.com/ru/kaz/${citySlug}/search?q=${encodeURIComponent(productName)}`;
            if (price.product_url !== newUrl) {
                bulkOps.push({
                    updateOne: {
                        filter: { _id: price._id },
                        update: { $set: { product_url: newUrl } }
                    }
                });
                replacedWithSearch++;
            } else {
                alreadyOk++;
            }
        } else {
            // Good URL - restore it
            if (price.product_url !== originalUrl) {
                bulkOps.push({
                    updateOne: {
                        filter: { _id: price._id },
                        update: { $set: { product_url: originalUrl } }
                    }
                });
                restored++;
            } else {
                alreadyOk++;
            }
        }
    }

    console.log(`\nPlan:`);
    console.log(`  Restore deep links: ${restored}`);
    console.log(`  Replace with search (broken slug): ${replacedWithSearch}`);
    console.log(`  No URL in API: ${noMatch}`);
    console.log(`  Already correct: ${alreadyOk}`);
    console.log(`  Total ops: ${bulkOps.length}`);

    // Execute
    if (bulkOps.length > 0) {
        const BATCH_SIZE = 500;
        let updated = 0;
        for (let i = 0; i < bulkOps.length; i += BATCH_SIZE) {
            const batch = bulkOps.slice(i, i + BATCH_SIZE);
            const result = await Price.bulkWrite(batch, { ordered: false });
            updated += result.modifiedCount;
        }
        console.log(`\nUpdated: ${updated} records`);
    }

    // Verify
    console.log('\n=== Sample results ===');
    const samples = await Price.find({ aggregator: wolt._id }).populate('product', 'name').limit(10).lean();
    for (const s of samples) {
        const url = s.product_url || 'NO URL';
        const isSearch = url.includes('/search?q=');
        console.log(`  ${isSearch ? '🔍' : '🔗'} ${s.product?.name}: ${url.substring(0, 80)}...`);
    }

    await mongoose.disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
