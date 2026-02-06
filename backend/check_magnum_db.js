const mongoose = require('mongoose');
require('dotenv').config();

mongoose.connect(process.env.MONGO_URI, {
  dbName: process.env.MONGO_DB_NAME
}).then(async () => {
  const Price = require('./src/models/Price');
  const Aggregator = require('./src/models/Aggregator');
  const Product = require('./src/models/Product');
  
  // Find Magnum aggregator
  const magnum = await Aggregator.findOne({ name: 'Magnum' }).lean();
  if (!magnum) {
    console.log('Magnum aggregator not found');
    process.exit(0);
  }
  
  console.log('Magnum aggregator ID:', magnum._id);
  console.log('');
  
  // Count Magnum prices
  const totalPrices = await Price.countDocuments({ aggregator: magnum._id });
  console.log('Total Magnum prices in DB:', totalPrices);
  
  // Count by URL type
  const withKaspiUrl = await Price.countDocuments({ 
    aggregator: magnum._id, 
    product_url: { $regex: '^https://kaspi.kz/shop' }
  });
  
  const withSearchUrl = await Price.countDocuments({ 
    aggregator: magnum._id, 
    product_url: { $regex: 'magnum.kz/catalog\\?q=' }
  });
  
  const withoutUrl = await Price.countDocuments({ 
    aggregator: magnum._id, 
    $or: [
      { product_url: null },
      { product_url: '' }
    ]
  });
  
  console.log('With Kaspi URL:', withKaspiUrl);
  console.log('With Magnum search URL:', withSearchUrl);
  console.log('Without URL:', withoutUrl);
  console.log('');
  
  // Get sample prices with Kaspi URLs
  const kaspiPrices = await Price.find({ 
    aggregator: magnum._id, 
    product_url: { $regex: '^https://kaspi.kz/shop' }
  }).populate('product').limit(3).lean();
  
  console.log('=== Sample products with Kaspi URLs ===');
  kaspiPrices.forEach((p, i) => {
    console.log(`\n${i+1}. ${p.product?.name}`);
    console.log(`   Last updated: ${p.last_updated}`);
    console.log(`   URL: ${p.product_url}`);
  });
  
  // Get sample prices with search URLs (the problem ones)
  const searchPrices = await Price.find({ 
    aggregator: magnum._id, 
    product_url: { $regex: 'magnum.kz/catalog\\?q=' }
  }).populate('product').limit(3).lean();
  
  console.log('\n\n=== Sample products with Magnum SEARCH URLs (the problem) ===');
  searchPrices.forEach((p, i) => {
    console.log(`\n${i+1}. ${p.product?.name}`);
    console.log(`   Last updated: ${p.last_updated}`);
    console.log(`   URL: ${p.product_url}`);
  });
  
  process.exit(0);
}).catch(err => {
  console.error(err);
  process.exit(1);
});
