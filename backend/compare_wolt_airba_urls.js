/**
 * Compare Wolt vs Airba deep link behavior
 * Both use wolt.com URLs — why does Airba work but Wolt doesn't?
 */

require('dotenv').config();
const mongoose = require('mongoose');

async function main() {
    await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB_NAME });
    
    const Price = require('./src/models/Price');
    const Aggregator = require('./src/models/Aggregator');

    const airba = await Aggregator.findOne({ name: 'Airba Fresh' });
    const wolt = await Aggregator.findOne({ name: 'Wolt' });

    // Get original Wolt URLs from API (before our fix) - check if any remain unfixed
    // Actually let's fetch fresh from API to compare
    const token = process.env.EXTERNAL_API_TOKEN || '7e248c0f2ddbe71f1d2339c731d0c5d5954e647a2c000e96d696c3f78acfb2d5';
    const baseUrl = process.env.EXTERNAL_API_URL || 'http://94.131.88.146:3000';

    // Get sample URLs from API directly
    console.log('=== Fetching sample URLs from API ===\n');
    
    // Wolt Market
    const woltResp = await fetch(`${baseUrl}/api/csv-data/wolt_market_almaty_mapped`, {
        headers: { Authorization: `Bearer ${token}` }
    });
    const woltRaw = await woltResp.json();
    const woltData = Array.isArray(woltRaw) ? woltRaw : (woltRaw.data || []);
    console.log('Wolt API response type:', typeof woltRaw, Array.isArray(woltRaw) ? 'array' : 'keys:' + Object.keys(woltRaw).join(','));
    const woltItems = woltData.filter(r => r.url && r.url.includes('wolt.com')).slice(0, 5);
    
    // Airba Fresh
    const airbaResp = await fetch(`${baseUrl}/api/csv-data/airba_fresh_almaty_mapped`, {
        headers: { Authorization: `Bearer ${token}` }
    });
    const airbaRaw = await airbaResp.json();
    const airbaData = Array.isArray(airbaRaw) ? airbaRaw : (airbaRaw.data || []);
    console.log('Airba API response type:', typeof airbaRaw, Array.isArray(airbaRaw) ? 'array' : 'keys:' + Object.keys(airbaRaw).join(','));
    const airbaItems = airbaData.filter(r => r.url && r.url.includes('wolt.com')).slice(0, 5);

    console.log('Wolt Market sample URLs from API:');
    woltItems.forEach(r => console.log(`  ${r.title}: ${r.url}`));
    
    console.log('\nAirba Fresh sample URLs from API:');
    airbaItems.forEach(r => console.log(`  ${r.title}: ${r.url}`));

    // Now test each URL with HTTP
    console.log('\n=== HTTP Tests ===\n');
    
    const testUrl = async (label, url) => {
        try {
            const resp = await fetch(url, { redirect: 'manual' });
            const location = resp.headers.get('location') || 'none';
            console.log(`[${resp.status}] ${label}`);
            console.log(`  URL: ${url}`);
            if (resp.status >= 300 && resp.status < 400) {
                console.log(`  Redirect to: ${location}`);
            }
            console.log('');
        } catch (e) {
            console.log(`[ERR] ${label}: ${e.message}\n`);
        }
    };

    console.log('--- AIRBA FRESH URLs ---');
    for (const item of airbaItems.slice(0, 3)) {
        await testUrl(item.title, item.url);
    }

    console.log('--- WOLT MARKET URLs ---');
    for (const item of woltItems.slice(0, 3)) {
        await testUrl(item.title, item.url);
    }

    // Check URL structure differences
    console.log('=== URL Pattern Analysis ===\n');
    
    const airbaVenues = new Set();
    const woltVenues = new Set();
    
    airbaData.filter(r => r.url && r.url.includes('venue/')).slice(0, 100).forEach(r => {
        const m = r.url.match(/venue\/([^/]+)/);
        if (m) airbaVenues.add(m[1]);
    });
    
    woltData.filter(r => r.url && r.url.includes('venue/')).slice(0, 100).forEach(r => {
        const m = r.url.match(/venue\/([^/]+)/);
        if (m) woltVenues.add(m[1]);
    });

    console.log('Airba venues:', [...airbaVenues]);
    console.log('Wolt venues:', [...woltVenues]);

    // Check item slug patterns
    console.log('\nAirba item slugs (after venue/):');
    airbaData.filter(r => r.url).slice(0, 5).forEach(r => {
        const m = r.url.match(/venue\/[^/]+\/(.+)$/);
        if (m) console.log(`  ${m[1]}`);
    });

    console.log('\nWolt item slugs (after venue/):');
    woltData.filter(r => r.url).slice(0, 5).forEach(r => {
        const m = r.url.match(/venue\/[^/]+\/(.+)$/);
        if (m) console.log(`  ${m[1]}`);
    });

    await mongoose.disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
