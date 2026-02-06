/**
 * Fix Wolt URLs in database
 * 
 * Problem: Wolt deep links like wolt.com/.../venue/wolt-market-shevchenko/item-itemid-xxx
 * return 301 redirect to venue main page. They don't work as product links.
 * 
 * Solution: Replace with search URLs: wolt.com/ru/kaz/{city}/search?q={product_name}
 */

require('dotenv').config();
const mongoose = require('mongoose');

async function main() {
    await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB_NAME });
    console.log('Connected to MongoDB');

    const Price = require('./src/models/Price');
    const Product = require('./src/models/Product');
    const Aggregator = require('./src/models/Aggregator');

    const wolt = await Aggregator.findOne({ name: 'Wolt' });
    if (!wolt) {
        console.log('Wolt aggregator not found');
        process.exit(1);
    }

    // Find all Wolt prices with venue deep links
    const woltPrices = await Price.find({
        aggregator: wolt._id,
        product_url: { $regex: 'wolt\\.com.*venue/wolt-market' }
    }).populate('product', 'name').lean();

    console.log(`Found ${woltPrices.length} Wolt prices with venue deep links to fix`);

    if (woltPrices.length === 0) {
        console.log('Nothing to fix!');
        await mongoose.disconnect();
        return;
    }

    // Show samples before fix
    console.log('\nSample BEFORE fix:');
    woltPrices.slice(0, 3).forEach(p => {
        console.log(`  ${p.product?.name || 'unknown'}`);
        console.log(`  OLD: ${p.product_url}`);
    });

    let updated = 0;
    let errors = 0;
    const bulkOps = [];

    for (const price of woltPrices) {
        const productName = price.product?.name;
        if (!productName) {
            errors++;
            continue;
        }

        // Determine city from existing URL
        let citySlug = 'almaty';
        if (price.product_url && price.product_url.includes('/nur-sultan/')) {
            citySlug = 'nur-sultan';
        }

        const newUrl = `https://wolt.com/ru/kaz/${citySlug}/search?q=${encodeURIComponent(productName)}`;

        bulkOps.push({
            updateOne: {
                filter: { _id: price._id },
                update: { $set: { product_url: newUrl } }
            }
        });
    }

    // Execute in batches
    const BATCH_SIZE = 500;
    for (let i = 0; i < bulkOps.length; i += BATCH_SIZE) {
        const batch = bulkOps.slice(i, i + BATCH_SIZE);
        const result = await Price.bulkWrite(batch, { ordered: false });
        updated += result.modifiedCount;
        console.log(`Batch ${Math.floor(i / BATCH_SIZE) + 1}: updated ${result.modifiedCount}`);
    }

    console.log(`\nDone! Updated: ${updated}, Errors: ${errors}`);

    // Show samples after fix
    const after = await Price.find({
        aggregator: wolt._id
    }).populate('product', 'name').limit(5).lean();

    console.log('\nSample AFTER fix:');
    after.forEach(p => {
        console.log(`  ${p.product?.name || 'unknown'}`);
        console.log(`  URL: ${p.product_url}`);
    });

    await mongoose.disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
