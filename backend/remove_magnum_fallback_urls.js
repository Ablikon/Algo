const mongoose = require('mongoose');
require('dotenv').config();

mongoose.connect(process.env.MONGO_URI, {
  dbName: process.env.MONGO_DB_NAME
}).then(async () => {
  const Price = require('./src/models/Price');
  const Aggregator = require('./src/models/Aggregator');
  
  // Find Magnum aggregator
  const magnum = await Aggregator.findOne({ name: 'Magnum' }).lean();
  if (!magnum) {
    console.log('Magnum aggregator not found');
    process.exit(0);
  }
  
  console.log('Removing fallback Magnum search URLs...');
  
  // Remove only search URLs (keep Kaspi URLs)
  const result = await Price.updateMany(
    { 
      aggregator: magnum._id, 
      product_url: { $regex: 'magnum.kz/catalog\\?q=' }
    },
    { 
      $set: { product_url: null }
    }
  );
  
  console.log(`Updated ${result.modifiedCount} prices`);
  console.log('Fallback URLs removed. Now Magnum products will show links only if they have real Kaspi URLs from API.');
  
  process.exit(0);
}).catch(err => {
  console.error(err);
  process.exit(1);
});
