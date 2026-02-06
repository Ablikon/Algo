const mongoose = require('mongoose');
require('dotenv').config();

mongoose.connect(process.env.MONGO_URI, {
  dbName: process.env.MONGO_DB_NAME
})
  .then(async () => {
    console.log('Connected to MongoDB');
    
    const Product = require('./src/models/Product');
    const Price = require('./src/models/Price');
    const Aggregator = require('./src/models/Aggregator');
    
    // Count documents
    const productCount = await Product.countDocuments();
    const priceCount = await Price.countDocuments();
    
    console.log('Product count:', productCount);
    console.log('Price count:', priceCount);
    console.log('');
    
    if (productCount === 0) {
      console.log('Database is EMPTY!');
      process.exit(0);
    }
    
    // Find product by name
    console.log('Looking for products...');
    const sampleProducts = await Product.find({}).limit(5).lean();
    console.log(`Found ${sampleProducts.length} sample products:`);
    sampleProducts.forEach(p => {
      console.log(' -', p.name, '| grouping_id:', p.grouping_id || 'NO UUID');
    });
    console.log('');
    
    // Find any product with name containing common words from the screenshot
    const product = await Product.findOne({ name: /Драже/i }).lean();
    if (!product) {
      console.log('No product found with Драже');
      process.exit(0);
    }
    
    console.log('Product ID:', product._id);
    console.log('Product name:', product.name);
    console.log('Product grouping_id:', product.grouping_id);
    console.log('');
    
    // Find all prices for this product
    const prices = await Price.find({ product: product._id }).populate('aggregator').lean();
    console.log(`Found ${prices.length} prices:`);
    
    prices.forEach(p => {
      console.log('\n---');
      console.log('Aggregator:', p.aggregator?.name);
      console.log('Price:', p.price);
      console.log('Last updated:', p.last_updated);
      console.log('Product URL:', p.product_url || 'NO URL');
    });
    
    process.exit(0);
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
