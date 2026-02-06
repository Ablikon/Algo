/**
 * Полная очистка базы и свежий реимпорт с API.
 * Удаляет ВСЕ: products, prices, productlinks, categories, importjobs.
 * Оставляет: aggregators, cities.
 * Затем запускает синхронизацию + Рядом.
 */
const mongoose = require('mongoose');

const MONGODB_URI = 'mongodb+srv://admin:2525123@scoutalgo.tfqg35b.mongodb.net/scoutalgo';
const BACKEND_URL = 'http://localhost:8000';

async function wipeAndReimport() {
    // ── 1. Подключение ──
    await mongoose.connect(MONGODB_URI, {
        socketTimeoutMS: 120000,
        serverSelectionTimeoutMS: 30000
    });
    console.log('✅ Connected to MongoDB\n');

    const Product = require('./src/models/Product');
    const Price = require('./src/models/Price');
    const Category = require('./src/models/Category');
    const ImportJob = require('./src/models/ImportJob');

    let ProductLink;
    try { ProductLink = require('./src/models/ProductLink'); } catch(e) {}

    // ── 2. Статистика ДО ──
    const before = {
        products: await Product.countDocuments(),
        prices: await Price.countDocuments(),
        categories: await Category.countDocuments(),
        links: ProductLink ? await ProductLink.countDocuments() : 0
    };
    console.log('📊 До очистки:');
    console.log(`   Products: ${before.products}`);
    console.log(`   Prices:   ${before.prices}`);
    console.log(`   Categories: ${before.categories}`);
    console.log(`   Links:    ${before.links}\n`);

    // ── 3. Удаление ──
    console.log('🗑️  Удаляю всё...');
    
    const r1 = await Price.deleteMany({});
    console.log(`   Prices deleted: ${r1.deletedCount}`);
    
    if (ProductLink) {
        const r2 = await ProductLink.deleteMany({});
        console.log(`   Links deleted: ${r2.deletedCount}`);
    }
    
    const r3 = await Product.deleteMany({});
    console.log(`   Products deleted: ${r3.deletedCount}`);
    
    const r4 = await Category.deleteMany({});
    console.log(`   Categories deleted: ${r4.deletedCount}`);
    
    const r5 = await ImportJob.deleteMany({});
    console.log(`   ImportJobs deleted: ${r5.deletedCount}`);

    // Verify
    const after = {
        products: await Product.countDocuments(),
        prices: await Price.countDocuments(),
    };
    console.log(`\n✅ База чистая: ${after.products} products, ${after.prices} prices`);

    await mongoose.disconnect();
    console.log('\n📡 Отключился от MongoDB');

    // ── 4. Запуск синхронизации через API ──
    console.log('\n🚀 Запускаю синхронизацию с внешнего API...');
    
    const syncRes = await fetch(`${BACKEND_URL}/api/sync/external-api`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force: true })
    });
    const syncData = await syncRes.json();
    console.log(`   Sync response: ${JSON.stringify(syncData)}\n`);

    if (syncData.status !== 'started') {
        console.error('❌ Sync не запустился:', syncData);
        process.exit(1);
    }

    // ── 5. Ожидание завершения ──
    console.log('⏳ Жду завершения синхронизации...');
    let done = false;
    let lastMsg = '';
    
    while (!done) {
        await new Promise(r => setTimeout(r, 10000)); // 10 sec
        
        try {
            const statusRes = await fetch(`${BACKEND_URL}/api/sync/status`);
            const status = await statusRes.json();
            
            const msg = `   [${status.filesProcessed || 0}/${status.totalFiles || '?'}] ${status.currentFile || ''} — ${status.current_stats?.total_prices || 0} prices`;
            if (msg !== lastMsg) {
                console.log(msg);
                lastMsg = msg;
            }
            
            if (status.status === 'completed' || status.status === 'failed') {
                done = true;
                if (status.status === 'failed') {
                    console.error('❌ Sync failed!');
                    process.exit(1);
                }
                console.log(`\n✅ Синхронизация завершена! ${status.current_stats?.total_prices || 0} цен`);
            }
        } catch(e) {
            console.log(`   (waiting... ${e.message})`);
        }
    }

    // ── 6. Импорт Рядом ──
    console.log('\n📦 Загружаю Рядом из BQ CSV...');
    try {
        const rRes = await fetch(`${BACKEND_URL}/api/ryadom/load-bq`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({})
        });
        const rData = await rRes.json();
        console.log(`   Рядом: ${JSON.stringify(rData)}`);
    } catch(e) {
        console.log(`   ⚠️ Рядом не загружен: ${e.message}`);
    }

    // ── 7. Финальная проверка ──
    console.log('\n📊 Финальная проверка...');
    const finalRes = await fetch(`${BACKEND_URL}/api/sync/status`);
    const finalStatus = await finalRes.json();
    console.log(`   Products: ${finalStatus.current_stats?.total_products}`);
    console.log(`   Prices:   ${finalStatus.current_stats?.total_prices}`);
    console.log(`   Aggregators: ${finalStatus.current_stats?.total_aggregators}`);

    console.log('\n🎉 Готово!');
}

wipeAndReimport().catch(e => {
    console.error('❌ Fatal error:', e);
    process.exit(1);
});
