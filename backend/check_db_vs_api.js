const mongoose = require('mongoose');
require('dotenv').config();

mongoose.connect(process.env.MONGO_URI, {
  dbName: process.env.MONGO_DB_NAME
}).then(async () => {
  const Product = require('./src/models/Product');
  const Price = require('./src/models/Price');
  const Aggregator = require('./src/models/Aggregator');
  
  const magnum = await Aggregator.findOne({ name: 'Magnum' }).lean();
  
  console.log('=== Checking if we have MORE Magnum products in DB ===\n');
  
  // Total products
  const totalProducts = await Product.countDocuments();
  console.log(`Total products in DB: ${totalProducts}`);
  
  // Products with Magnum prices
  const magnumPriceIds = await Price.find({ aggregator: magnum._id }).distinct('product');
  console.log(`Products with Magnum prices: ${magnumPriceIds.length}`);
  
  // Sample products
  const sampleProducts = await Product.find({ 
    _id: { $in: magnumPriceIds.slice(0, 10) }
  }).lean();
  
  console.log('\n=== Sample Magnum products in our DB ===');
  sampleProducts.forEach((p, i) => {
    console.log(`${i+1}. ${p.name}`);
    console.log(`   Brand: ${p.brand || 'N/A'}`);
    console.log(`   UUID: ${p.grouping_id || 'NO UUID'}`);
  });
  
  // Now let's see if these match the API csv_names
  const apiData = require('./magnum_full_response.json');
  const apiCsvNames = apiData.data.map(r => r.csv_name).filter(Boolean);
  
  console.log(`\n=== Comparing with API data ===`);
  console.log(`API has ${apiCsvNames.length} csv_name entries`);
  
  // Check if our product names match ANY csv_names
  let matches = 0;
  for (const product of sampleProducts) {
    const found = apiCsvNames.find(csvName => 
      csvName && product.name && 
      csvName.toLowerCase().includes(product.name.toLowerCase().split(' ')[0])
    );
    if (found) matches++;
  }
  
  console.log(`Sample products matching API csv_names: ${matches}/${sampleProducts.length}`);
  
  process.exit(0);
}).catch(err => {
  console.error(err);
  process.exit(1);
});
