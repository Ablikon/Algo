/**
 * Анализирует маппинг csv_name между агрегаторами.
 * csv_name — это ключ, по которому API замаппил товары.
 */
const axios = require('axios');

const client = axios.create({
    baseURL: 'http://94.131.88.146:3000',
    headers: { 'Authorization': 'Bearer 7e248c0f2ddbe71f1d2339c731d0c5d5954e647a2c000e96d696c3f78acfb2d5' },
    timeout: 120000
});

const FILES = {
    'Arbuz': 'arbuz_kz_almaty',
    'Magnum': 'magnum_almaty',
    'Yandex': 'yandex_lavka_almaty',
    'Airba': 'airba_fresh_almaty',
    'Wolt': 'wolt_market_almaty'
};

async function run() {
    const csvNamesByAgg = {};
    const allRecordsByCsvName = {};
    
    for (const [aggName, fileId] of Object.entries(FILES)) {
        console.log(`Fetching ${aggName} (${fileId})...`);
        const res = await client.get(`/api/csv-data/${fileId}_mapped`);
        const recs = res.data.data || [];
        
        const matched = recs.filter(r => r.match && r.csv_name);
        csvNamesByAgg[aggName] = new Set(matched.map(r => r.csv_name));
        
        console.log(`  Total: ${recs.length}, Matched: ${matched.length}, Unique csv_names: ${csvNamesByAgg[aggName].size}`);
        
        // Store records by csv_name
        for (const r of matched) {
            if (!allRecordsByCsvName[r.csv_name]) allRecordsByCsvName[r.csv_name] = [];
            allRecordsByCsvName[r.csv_name].push({ agg: aggName, title: r.title, cost: r.cost, url: r.url });
        }
    }
    
    // Count how many aggregators each csv_name appears in
    const counts = {};
    for (const [csvName, records] of Object.entries(allRecordsByCsvName)) {
        const uniqueAggs = new Set(records.map(r => r.agg));
        counts[csvName] = uniqueAggs.size;
    }
    
    // Distribution
    const dist = {};
    for (const count of Object.values(counts)) {
        dist[count] = (dist[count] || 0) + 1;
    }
    
    console.log('\n=== Распределение csv_name по кол-ву агрегаторов ===');
    for (const [k, v] of Object.entries(dist).sort((a, b) => b[0] - a[0])) {
        console.log(`  ${k} агрегаторов: ${v} товаров`);
    }
    
    // Show samples with 3+ aggregators
    console.log('\n=== Примеры товаров с 3+ агрегаторами ===');
    let shown = 0;
    for (const [csvName, records] of Object.entries(allRecordsByCsvName)) {
        const uniqueAggs = new Set(records.map(r => r.agg));
        if (uniqueAggs.size >= 3 && shown < 10) {
            console.log(`\n  csv_name: "${csvName}" (${uniqueAggs.size} agg)`);
            for (const r of records) {
                console.log(`    ${r.agg}: "${r.title}" — ${r.cost} тг`);
            }
            shown++;
        }
    }
    
    // Show samples with exactly 2
    console.log('\n=== Примеры с 2 агрегаторами ===');
    shown = 0;
    for (const [csvName, records] of Object.entries(allRecordsByCsvName)) {
        const uniqueAggs = new Set(records.map(r => r.agg));
        if (uniqueAggs.size === 2 && shown < 5) {
            console.log(`\n  csv_name: "${csvName}" (${[...uniqueAggs].join(', ')})`);
            for (const r of records) {
                console.log(`    ${r.agg}: "${r.title}" — ${r.cost} тг`);
            }
            shown++;
        }
    }
}

run().catch(e => { console.error(e); process.exit(1); });
