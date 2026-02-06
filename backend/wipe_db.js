/**
 * Шаг 1: Очистка базы. Удаляет products, prices, links, categories.
 */
const mongoose = require('mongoose');
const MONGODB_URI = 'mongodb+srv://admin:2525123@scoutalgo.tfqg35b.mongodb.net/scoutalgo';

async function wipe() {
    await mongoose.connect(MONGODB_URI, { socketTimeoutMS: 300000, serverSelectionTimeoutMS: 30000 });
    console.log('✅ Connected\n');
    
    const db = mongoose.connection.db;
    
    // Быстрый способ — drop collections целиком (намного быстрее чем deleteMany)
    const collections = ['prices', 'products', 'productlinks', 'categories', 'importjobs'];
    
    for (const name of collections) {
        try {
            const exists = await db.listCollections({ name }).hasNext();
            if (exists) {
                await db.dropCollection(name);
                console.log(`  ✅ Dropped: ${name}`);
            } else {
                console.log(`  ⏭️  Skip: ${name} (не существует)`);
            }
        } catch(e) {
            console.log(`  ⚠️  ${name}: ${e.message}`);
        }
    }
    
    // Проверим агрегаторы
    const Aggregator = require('./src/models/Aggregator');
    const aggs = await Aggregator.find({}).lean();
    console.log(`\n✅ Агрегаторы (не тронуты): ${aggs.length}`);
    aggs.forEach(a => console.log(`   ${a.name} (${a._id})`));
    
    await mongoose.disconnect();
    console.log('\n🎉 База очищена! Теперь запустите sync.');
}

wipe().catch(e => { console.error(e); process.exit(1); });
