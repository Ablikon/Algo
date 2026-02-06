const mongoose = require('mongoose');
require('dotenv').config();

mongoose.connect(process.env.MONGO_URI, {
  dbName: process.env.MONGO_DB_NAME
}).then(async () => {
  const Price = require('./src/models/Price');
  const Aggregator = require('./src/models/Aggregator');
  const Product = require('./src/models/Product');
  
  const magnum = await Aggregator.findOne({ name: 'Magnum' }).lean();
  
  // Get recently updated prices with Kaspi URLs
  const recentKaspiPrices = await Price.find({ 
    aggregator: magnum._id, 
    product_url: { $regex: '^https://kaspi.kz/shop' },
    last_updated: { $gte: new Date('2026-02-05') }
  }).populate('product').limit(10).lean();
  
  console.log('=== Recently updated Magnum prices with Kaspi URLs (today) ===');
  console.log(`Found ${recentKaspiPrices.length} prices updated today`);
  
  recentKaspiPrices.forEach((p, i) => {
    console.log(`\n${i+1}. ${p.product?.name}`);
    console.log(`   Price: ${p.price} тг`);
    console.log(`   Last updated: ${p.last_updated}`);
    console.log(`   URL: ${p.product_url.substring(0, 80)}...`);
  });
  
  // Total count updated today
  const updatedTodayCount = await Price.countDocuments({ 
    aggregator: magnum._id,
    last_updated: { $gte: new Date('2026-02-05') }
  });
  
  console.log(`\n\nTotal Magnum prices updated today: ${updatedTodayCount}`);
  
  process.exit(0);
}).catch(err => {
  console.error(err);
  process.exit(1);
});
