const mongoose = require('mongoose');

async function run() {
    await mongoose.connect('mongodb+srv://admin:2525123@scoutalgo.tfqg35b.mongodb.net/scoutalgo', {
        socketTimeoutMS: 120000
    });
    
    const Product = require('./src/models/Product');
    const Price = require('./src/models/Price');
    const Aggregator = require('./src/models/Aggregator');

    const aggs = await Aggregator.find({}).lean();
    const aggMap = {};
    aggs.forEach(a => aggMap[a._id.toString()] = a.name);

    // Search for "Coca-Cola" across aggregators
    const searchTerms = ['coca-cola', 'кока-кола', 'coca cola', 'молоко lactel', 'бананы'];
    
    for (const term of searchTerms) {
        console.log(`\n=== Поиск: "${term}" ===`);
        const products = await Product.find({
            name: { $regex: term, $options: 'i' }
        }).select('name normalized_name').limit(20).lean();
        
        for (const p of products) {
            const prices = await Price.find({ product: p._id })
                .select('aggregator price')
                .lean();
            const aggList = prices.map(pr => aggMap[pr.aggregator.toString()] + ':' + pr.price + 'тг').join(', ');
            console.log(`  ${p.name} | norm: "${p.normalized_name}" | ${prices.length} prices: ${aggList}`);
        }
    }

    await mongoose.disconnect();
}

run().catch(e => { console.error(e); process.exit(1); });
