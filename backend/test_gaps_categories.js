// Quick test: check if gaps endpoint returns categories
require('dotenv').config({ path: __dirname + '/.env' });
const mongoose = require('mongoose');

async function test() {
    await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB_NAME || 'scoutalgo' });
    console.log('Connected to MongoDB\n');

    const Category = require('./src/models/Category');
    const Product = require('./src/models/Product');
    const Price = require('./src/models/Price');
    
    // Get a sample of products that appear in multiple aggregators
    const productPrices = await Price.aggregate([
        { $match: { is_available: true, price: { $ne: null } } },
        {
            $group: {
                _id: '$product',
                aggregators: { $addToSet: '$aggregator' },
                min_price: { $min: '$price' }
            }
        },
        { $match: { 'aggregators.1': { $exists: true } } },
        { $sort: { aggregators: -1 } },
        { $limit: 5 }
    ]);

    console.log(`Found ${productPrices.length} products with 2+ aggregators\n`);

    // Get product details with category populated
    const productIds = productPrices.map(p => p._id);
    const products = await Product.find({ _id: { $in: productIds } }).populate('category').lean();
    
    console.log('Sample products with categories:\n');
    products.forEach((p, idx) => {
        console.log(`${idx + 1}. ${p.name}`);
        console.log(`   Category ID: ${p.category || 'NULL'}`);
        if (p.category && typeof p.category === 'object') {
            console.log(`   Category Name: ${p.category.name || 'N/A'}`);
            console.log(`   Category Parent: ${p.category.parent || 'NULL (root)'}`);
        } else if (p.category) {
            console.log(`   ⚠️  Category not populated! Still ObjectId: ${p.category}`);
        }
        console.log('');
    });

    await mongoose.disconnect();
    console.log('Done!');
}

test().catch(err => { console.error(err); process.exit(1); });
