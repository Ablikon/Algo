const mongoose = require('mongoose');
const Product = require('./src/models/Product');
const Price = require('./src/models/Price');

const MONGODB_URI = 'mongodb+srv://admin:2525123@scoutalgo.tfqg35b.mongodb.net/scoutalgo';

async function checkSampleProducts() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');
    
    // Возьмем случайные товары с grouping_id
    const productsWithGrouping = await Product.find({ grouping_id: { $ne: null } })
      .limit(5);
    
    console.log('📦 Примеры товаров с grouping_id:\n');
    
    for (const product of productsWithGrouping) {
      console.log(`\n${product.name}`);
      console.log(`  grouping_id: ${product.grouping_id}`);
      
      // Найдем другие товары с таким же grouping_id
      const related = await Product.find({ 
        grouping_id: product.grouping_id,
        _id: { $ne: product._id }
      }).limit(5);
      
      if (related.length > 0) {
        console.log(`  📌 Связанные товары с тем же grouping_id:`);
        for (const rel of related) {
          console.log(`    - ${rel.name}`);
        }
      }
      
      // Цены для этого товара
      const prices = await Price.find({ product_id: product._id })
        .populate('aggregator_id', 'name');
      
      if (prices.length > 0) {
        console.log(`  💰 Цены (${prices.length}):`);
        prices.forEach(p => {
          console.log(`    - ${p.aggregator_id?.name}: ${p.price} тг`);
        });
      }
    }
    
    // Теперь товары БЕЗ grouping_id, которые имеют несколько цен
    console.log('\n\n📦 Товары БЕЗ grouping_id с множественными ценами:\n');
    
    const productsWithoutGrouping = await Product.find({ grouping_id: null }).limit(100);
    
    for (const product of productsWithoutGrouping) {
      const prices = await Price.find({ product_id: product._id })
        .populate('aggregator_id', 'name');
      
      if (prices.length >= 3) {
        console.log(`\n${product.name}`);
        console.log(`  💰 Цены (${prices.length}):`);
        prices.forEach(p => {
          console.log(`    - ${p.aggregator_id?.name}: ${p.price} тг`);
        });
        break; // Показываем только один пример
      }
    }
    
    await mongoose.disconnect();
    
  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    process.exit(1);
  }
}

checkSampleProducts();
