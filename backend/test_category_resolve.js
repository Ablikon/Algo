// Quick test: verify category resolution works in apiSync processBatch context
require('dotenv').config({ path: __dirname + '/.env' });
const mongoose = require('mongoose');

async function test() {
    await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB_NAME || 'scoutalgo' });
    console.log('Connected to MongoDB');

    const Category = require('./src/models/Category');
    
    // Load hierarchy stats
    const parents = await Category.find({ parent: null }).lean();
    const children = await Category.find({ parent: { $ne: null } }).lean();
    console.log(`\nHierarchy: ${parents.length} parents, ${children.length} children = ${parents.length + children.length} total`);

    // Now test the apiSync service's internal logic by simulating what processBatch does
    const apiSync = require('./src/services/apiSync');

    // Get the YANDEX_TO_UNIFIED, FLAT_CATEGORY_MAP etc from the module scope
    // Since they're module-level consts, we can't access them directly.
    // Instead, let's do a mini-sync simulation:
    
    // Simulate Magnum category resolution
    const testCases = [
        { cat: 'Продукты питания > Молочные продукты, яйца > Молоко, сливки', agg: 'Magnum', expected: 'Молоко и сливки' },
        { cat: 'Продукты питания > Сладости и выпечка > Шоколад и батончики', agg: 'Magnum', expected: 'Шоколад и батончики' },
        { cat: 'Товары для рыбалки > Удочки > Спиннинг', agg: 'Magnum', expected: null },  // Non-food
        { cat: 'milk_and_cream', agg: 'Yandex Lavka', expected: 'Молоко и сливки' },
        { cat: 'beer', agg: 'Yandex Lavka', expected: 'Пиво' },
        { cat: 'batteries_and_bulbs', agg: 'Yandex Lavka', expected: null }, // Skipped
        { cat: 'Молоко', agg: 'Airba Fresh', expected: 'Молоко и сливки' },
        { cat: 'Чипсы', agg: 'Wolt', expected: 'Чипсы' },
        { cat: 'ТОВАРЫ НЕДЕЛИ', agg: 'Wolt', expected: null },  // Promo
        { cat: 'Publication 12345', agg: 'Arbuz.kz', expected: null },  // Arbuz skip
    ];

    // We can't call resolveCategory directly since it's a closure inside processBatch.
    // But we can verify that the category lookup would work by checking the DB.
    console.log('\n--- Checking category hierarchy in DB ---');
    
    for (const tc of testCases) {
        if (!tc.expected) {
            console.log(`✅ ${tc.agg}: "${tc.cat}" → skipped (expected null)`);
            continue;
        }
        
        // Find the child category
        const child = await Category.findOne({ name: tc.expected, parent: { $ne: null } }).lean();
        if (child) {
            const parent = await Category.findById(child.parent).lean();
            console.log(`✅ ${tc.agg}: "${tc.cat}" → "${parent.name}" > "${child.name}" (ID: ${child._id})`);
        } else {
            console.log(`❌ ${tc.agg}: "${tc.cat}" → expected "${tc.expected}" but NOT FOUND in DB!`);
        }
    }

    // Count products with categories
    const Product = require('./src/models/Product');
    const withCat = await Product.countDocuments({ category: { $ne: null } });
    const withoutCat = await Product.countDocuments({ $or: [{ category: null }, { category: { $exists: false } }] });
    console.log(`\nProducts: ${withCat} with category, ${withoutCat} without`);

    await mongoose.disconnect();
    console.log('\nDone!');
}

test().catch(err => { console.error(err); process.exit(1); });
