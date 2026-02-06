/**
 * Fix remaining Wolt search URLs by matching via the API's csv_name / original title
 * 3252 Wolt prices still have search URLs because their product.name 
 * came from a different aggregator (csv_name grouping).
 * 
 * Strategy: build a lookup by normalized name from API data 
 * and try to match products that still have search URLs.
 */

require('dotenv').config();
const mongoose = require('mongoose');

function normalizeName(name) {
    return (name || '').toLowerCase()
        .replace(/[^\p{L}\p{N}]/gu, '')
        .trim();
}

async function main() {
    await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB_NAME });
    
    const Price = require('./src/models/Price');
    const Product = require('./src/models/Product');
    const Aggregator = require('./src/models/Aggregator');
    const City = require('./src/models/City');

    const wolt = await Aggregator.findOne({ name: 'Wolt' });
    const almaty = await City.findOne({ slug: 'almaty' });
    const astana = await City.findOne({ slug: 'astana' });

    const token = process.env.EXTERNAL_API_TOKEN || '7e248c0f2ddbe71f1d2339c731d0c5d5954e647a2c000e96d696c3f78acfb2d5';
    const baseUrl = process.env.EXTERNAL_API_URL || 'http://94.131.88.146:3000';

    // Build comprehensive URL maps from API (by normalized title, csv_name, etc.)
    const urlByNorm = {}; // normalized_title -> { almaty: url, astana: url }
    
    for (const [fileId, cityName] of [['wolt_market_almaty_mapped', 'almaty'], ['wolt_market_astana_mapped', 'astana']]) {
        console.log(`Fetching ${fileId}...`);
        const resp = await fetch(`${baseUrl}/api/csv-data/${fileId}`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        const raw = await resp.json();
        const data = raw.data || [];
        
        for (const r of data) {
            if (!r.url || !r.title) continue;
            const url = r.url.trim();
            if (!url.includes('wolt.com')) continue;
            
            // Check if URL is broken (generic slug)
            const slugMatch = url.match(/venue\/[^/]+\/(.+)$/);
            if (slugMatch && slugMatch[1].startsWith('item-itemid-')) continue; // skip broken
            
            const norm = normalizeName(r.title);
            if (!urlByNorm[norm]) urlByNorm[norm] = {};
            urlByNorm[norm][cityName] = url;
            
            // Also index by csv_name if available
            if (r.csv_name) {
                const csvNorm = normalizeName(r.csv_name);
                if (!urlByNorm[csvNorm]) urlByNorm[csvNorm] = {};
                if (!urlByNorm[csvNorm][cityName]) urlByNorm[csvNorm][cityName] = url;
            }
        }
    }
    console.log(`URL lookup: ${Object.keys(urlByNorm).length} normalized keys\n`);

    // Find Wolt prices that still have search URLs
    const searchPrices = await Price.find({
        aggregator: wolt._id,
        product_url: { $regex: 'search\\?q=' }
    }).populate('product', 'name normalized_name grouping_id').lean();

    console.log(`Wolt prices with search URLs: ${searchPrices.length}`);

    let fixed = 0;
    let stillSearch = 0;
    const bulkOps = [];

    for (const price of searchPrices) {
        const product = price.product;
        if (!product) continue;

        const cityId = price.city?.toString();
        const cityName = cityId === almaty?._id?.toString() ? 'almaty' : 'astana';

        // Try multiple matching strategies
        let url = null;
        
        // 1. By product name
        const norm1 = normalizeName(product.name);
        url = urlByNorm[norm1]?.[cityName];
        
        // 2. By normalized_name
        if (!url && product.normalized_name) {
            const norm2 = normalizeName(product.normalized_name);
            url = urlByNorm[norm2]?.[cityName];
        }
        
        // 3. By grouping_id (csv_name)
        if (!url && product.grouping_id) {
            const norm3 = normalizeName(product.grouping_id);
            url = urlByNorm[norm3]?.[cityName];
        }

        if (url) {
            bulkOps.push({
                updateOne: {
                    filter: { _id: price._id },
                    update: { $set: { product_url: url } }
                }
            });
            fixed++;
        } else {
            stillSearch++;
        }
    }

    console.log(`\nCan fix: ${fixed}`);
    console.log(`Still search: ${stillSearch}`);

    if (bulkOps.length > 0) {
        const BATCH_SIZE = 500;
        let updated = 0;
        for (let i = 0; i < bulkOps.length; i += BATCH_SIZE) {
            const batch = bulkOps.slice(i, i + BATCH_SIZE);
            const result = await Price.bulkWrite(batch, { ordered: false });
            updated += result.modifiedCount;
        }
        console.log(`Updated: ${updated}`);
    }

    // Final stats
    const totalWolt = await Price.countDocuments({ aggregator: wolt._id });
    const deepLinks = await Price.countDocuments({ aggregator: wolt._id, product_url: { $regex: 'venue/' } });
    const searchLinks = await Price.countDocuments({ aggregator: wolt._id, product_url: { $regex: 'search\\?q=' } });
    const noUrl = await Price.countDocuments({ aggregator: wolt._id, $or: [{ product_url: null }, { product_url: '' }] });

    console.log(`\n=== Final Wolt URL stats ===`);
    console.log(`Total: ${totalWolt}`);
    console.log(`Deep links (working): ${deepLinks}`);
    console.log(`Search links (fallback): ${searchLinks}`);
    console.log(`No URL: ${noUrl}`);

    await mongoose.disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
