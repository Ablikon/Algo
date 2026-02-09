// Debug gaps query
require('dotenv').config({ path: __dirname + '/.env' });
const mongoose = require('mongoose');

async function debug() {
    await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB_NAME });
    console.log('Connected\n');
    
    const Category = require('./src/models/Category');
    const Price = require('./src/models/Price');
    const Product = require('./src/models/Product');
    
    // Step 1: Aggregation
    console.log('Step 1: Running aggregation...');
    const productPrices = await Price.aggregate([
        { $match: { is_available: true, price: { $ne: null } } },
        {
            $group: {
                _id: '$product',
                aggregators: { $addToSet: '$aggregator' },
                prices: { $push: { aggregator: '$aggregator', price: '$price' } },
                min_price: { $min: '$price' }
            }
        },
        { $match: { 'aggregators.1': { $exists: true } } },
        { $sort: { aggregators: -1 } },
        { $limit: 5 }
    ]);
    
    console.log('Found', productPrices.length, 'products with 2+ aggregators');
    console.log('Sample:', productPrices[0]);
    
    // Step 2: Get product details
    console.log('\nStep 2: Getting product details...');
    const productIds = productPrices.map(p => p._id);
    console.log('Product IDs:', productIds);
    
    const products = await Product.find({ _id: { $in: productIds } }).populate('category').lean();
    console.log('Found', products.length, 'products');
    
    if (products.length > 0) {
        console.log('Sample product:', products[0]);
    }
    
    // Step 3: Build results
    console.log('\nStep 3: Building results...');
    const productMap = {};
    products.forEach(p => { productMap[p._id.toString()] = p; });
    
    const results = productPrices.map(pp => {
        const product = productMap[pp._id.toString()];
        return {
            product_id: pp._id.toString(),
            product_name: product?.name || 'Unknown',
            category: product?.category?.name || null,
            aggregator_count: pp.aggregators.length,
            min_competitor_price: pp.min_price
        };
    });
    
    console.log('Results:', JSON.stringify(results, null, 2));
    
    await mongoose.disconnect();
}

debug().catch(err => { console.error('ERROR:', err); process.exit(1); });
