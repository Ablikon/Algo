const mongoose = require('mongoose');

async function run() {
    await mongoose.connect('mongodb+srv://admin:2525123@scoutalgo.tfqg35b.mongodb.net/scoutalgo', {
        socketTimeoutMS: 120000
    });
    
    const Price = require('./src/models/Price');
    const Product = require('./src/models/Product');
    const Aggregator = require('./src/models/Aggregator');
    const Category = require('./src/models/Category');

    // URL coverage per aggregator
    console.log('=== URL покрытие по агрегаторам ===');
    const aggs = await Aggregator.find({}).lean();
    for (const agg of aggs) {
        const total = await Price.countDocuments({ aggregator: agg._id });
        const withUrl = await Price.countDocuments({ 
            aggregator: agg._id, 
            product_url: { $nin: [null, ''] } 
        });
        console.log(`  ${agg.name}: ${withUrl}/${total} (${total > 0 ? Math.round(withUrl/total*100) : 0}%)`);
    }

    // Categories
    const catCount = await Category.countDocuments();
    const totalProducts = await Product.countDocuments();
    const withCat = await Product.countDocuments({ category: { $ne: null } });
    console.log(`\n=== Категории ===`);
    console.log(`  Уникальных категорий: ${catCount}`);
    console.log(`  Товаров с категорией: ${withCat}/${totalProducts} (${Math.round(withCat/totalProducts*100)}%)`);

    // Top categories
    const topCats = await Product.aggregate([
        { $match: { category: { $ne: null } } },
        { $group: { _id: '$category', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 15 }
    ]);
    for (const tc of topCats) {
        const cat = await Category.findById(tc._id).lean();
        console.log(`    ${cat?.name || 'unknown'}: ${tc.count}`);
    }

    // Aggregator distribution (by unique aggregators per product, not prices)
    console.log('\n=== Покрытие (уникальные агрегаторы на товар) ===');
    const coverage = await Price.aggregate([
        { $group: { _id: { product: '$product', aggregator: '$aggregator' } } },
        { $group: { _id: '$_id.product', aggCount: { $sum: 1 } } },
        { $group: { _id: '$aggCount', products: { $sum: 1 } } },
        { $sort: { _id: -1 } }
    ]);
    coverage.forEach(c => console.log(`  ${c._id} агрегаторов: ${c.products} товаров`));

    await mongoose.disconnect();
}

run().catch(e => { console.error(e); process.exit(1); });
