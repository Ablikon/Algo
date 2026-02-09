// Check gaps data
require('dotenv').config({ path: __dirname + '/.env' });
const mongoose = require('mongoose');

async function check() {
    await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB_NAME });
    console.log('Connected to MongoDB\n');
    
    const Price = require('./src/models/Price');
    const Aggregator = require('./src/models/Aggregator');
    
    // Check total available prices
    const totalPrices = await Price.countDocuments({ is_available: true, price: { $ne: null } });
    console.log('Total available prices:', totalPrices);
    
    // Check products with multiple aggregators
    const result = await Price.aggregate([
        { $match: { is_available: true, price: { $ne: null } } },
        {
            $group: {
                _id: '$product',
                aggregators: { $addToSet: '$aggregator' }
            }
        },
        { $match: { 'aggregators.1': { $exists: true } } },
        { $count: 'total' }
    ]);
    
    console.log('Products with 2+ aggregators:', result[0]?.total || 0);
    
    // Get our company aggregator
    const ourAgg = await Aggregator.findOne({ is_our_company: true }).lean();
    console.log('\nOur company aggregator:', ourAgg?.name || 'NOT FOUND');
    
    // Check if Рядом has is_our_company flag
    const ryadom = await Aggregator.findOne({ name: 'Рядом' }).lean();
    console.log('Рядом aggregator:', ryadom);
    
    // Check sample prices
    console.log('\n--- Sample prices by aggregator ---');
    const aggs = await Aggregator.find().lean();
    for (const agg of aggs) {
        const sample = await Price.findOne({ aggregator: agg._id, is_available: true }).lean();
        console.log(`${agg.name}: ${sample ? 'HAS DATA' : 'NO DATA'}, is_our_company: ${agg.is_our_company}`);
    }
    
    await mongoose.disconnect();
    console.log('\nDone!');
}

check().catch(err => { console.error(err); process.exit(1); });
