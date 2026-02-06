const mongoose = require('mongoose');

async function run() {
    await mongoose.connect('mongodb+srv://admin:2525123@scoutalgo.tfqg35b.mongodb.net/scoutalgo');
    
    const Price = require('./src/models/Price');
    const Product = require('./src/models/Product');
    const Aggregator = require('./src/models/Aggregator');
    
    const aggNames = {};
    const aggs = await Aggregator.find({}).lean();
    aggs.forEach(a => aggNames[a._id.toString()] = a.name);

    // Products with 5+ aggregators
    const top = await Price.aggregate([
        { $group: { _id: '$product', aggs: { $addToSet: '$aggregator' }, count: { $sum: 1 } } },
        { $match: { count: { $gte: 5 } } },
        { $sort: { count: -1 } },
        { $limit: 10 }
    ]);
    
    console.log('=== Товары с 5+ агрегаторов ===');
    for (const t of top) {
        const p = await Product.findById(t._id).select('name normalized_name category').lean();
        const names = t.aggs.map(id => aggNames[id.toString()]).join(', ');
        console.log(`  [${t.count}] ${p.name} → ${names}`);
    }

    // Pairs analysis for products with exactly 2 aggregators
    const pairs = await Price.aggregate([
        { $group: { _id: '$product', aggs: { $addToSet: '$aggregator' }, count: { $sum: 1 } } },
        { $match: { count: 2 } }
    ]);
    
    const pairCount = {};
    for (const p of pairs) {
        const names = p.aggs.map(id => aggNames[id.toString()]).sort().join(' + ');
        pairCount[names] = (pairCount[names] || 0) + 1;
    }
    console.log('\n=== Пары агрегаторов (товары с ровно 2 агрегаторами) ===');
    Object.entries(pairCount).sort((a,b) => b[1] - a[1]).forEach(([k,v]) => console.log(`  ${k}: ${v}`));

    // Show a few examples of Magnum+Magnum same-city duplicates vs cross-aggregator
    console.log('\n=== Примеры Magnum Almaty + Magnum Astana (если есть) ===');
    const magnumId = aggs.find(a => a.name === 'Magnum')?._id;
    if (magnumId) {
        const magnumDups = await Price.aggregate([
            { $match: { aggregator: magnumId } },
            { $group: { _id: '$product', count: { $sum: 1 } } },
            { $match: { count: { $gte: 2 } } },
            { $limit: 5 }
        ]);
        for (const d of magnumDups) {
            const p = await Product.findById(d._id).select('name').lean();
            const prices = await Price.find({ product: d._id, aggregator: magnumId }).lean();
            console.log(`  ${p.name}: ${prices.length} prices (cities: ${prices.map(pr => pr.city || 'null').join(', ')})`);
        }
    }

    // URL coverage
    console.log('\n=== URL покрытие по агрегаторам ===');
    for (const agg of aggs) {
        const total = await Price.countDocuments({ aggregator: agg._id });
        const withUrl = await Price.countDocuments({ aggregator: agg._id, product_url: { $ne: null, $ne: '' } });
        console.log(`  ${agg.name}: ${withUrl}/${total} (${total > 0 ? Math.round(withUrl/total*100) : 0}%)`);
    }

    // Categories
    const Category = require('./src/models/Category');
    const catCount = await Category.countDocuments();
    const withCat = await Product.countDocuments({ category: { $ne: null } });
    const totalProducts = await Product.countDocuments();
    console.log(`\n=== Категории ===`);
    console.log(`  Уникальных категорий: ${catCount}`);
    console.log(`  Товаров с категорией: ${withCat}/${totalProducts} (${Math.round(withCat/totalProducts*100)}%)`);
    
    // Show top categories
    const topCats = await Product.aggregate([
        { $match: { category: { $ne: null } } },
        { $group: { _id: '$category', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 15 }
    ]);
    for (const tc of topCats) {
        const cat = await Category.findById(tc._id).lean();
        console.log(`  ${cat?.name || 'unknown'}: ${tc.count} товаров`);
    }

    await mongoose.disconnect();
}

run().catch(e => { console.error(e); process.exit(1); });
