const mongoose = require('mongoose');
const Product = require('./src/models/Product');
const Price = require('./src/models/Price');

const MONGODB_URI = 'mongodb+srv://admin:2525123@scoutalgo.tfqg35b.mongodb.net/scoutalgo';

async function cleanupNoUuid() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');
    
    console.log('🗑️  Удаление товаров без UUID...\n');
    
    // Удаляем товары без grouping_id
    const productsToDelete = await Product.find({ 
      $or: [
        { grouping_id: null },
        { grouping_id: { $exists: false } }
      ]
    }).select('_id').lean();
    
    const productIds = productsToDelete.map(p => p._id);
    
    console.log(`Товаров без UUID: ${productIds.length}`);
    
    if (productIds.length === 0) {
      console.log('Нечего удалять');
      await mongoose.disconnect();
      return;
    }
    
    // Удаляем цены этих товаров
    const deletedPrices = await Price.deleteMany({ product_id: { $in: productIds } });
    console.log(`Удалено цен: ${deletedPrices.deletedCount}`);
    
    // Удаляем сами товары
    const deletedProducts = await Product.deleteMany({ _id: { $in: productIds } });
    console.log(`Удалено товаров: ${deletedProducts.deletedCount}`);
    
    const remaining = await Product.countDocuments();
    const remainingPrices = await Price.countDocuments();
    
    console.log(`\n📊 После очистки:`);
    console.log(`Товаров: ${remaining}`);
    console.log(`Цен: ${remainingPrices}`);
    
    await mongoose.disconnect();
    
  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    process.exit(1);
  }
}

cleanupNoUuid();
