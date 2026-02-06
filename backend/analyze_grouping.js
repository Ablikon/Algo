const mongoose = require('mongoose');
const Product = require('./src/models/Product');
const Price = require('./src/models/Price');

const MONGODB_URI = 'mongodb+srv://admin:2525123@scoutalgo.tfqg35b.mongodb.net/scoutalgo';

async function analyzeGrouping() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');
    
    const totalProducts = await Product.countDocuments();
    const withGroupingId = await Product.countDocuments({ grouping_id: { $ne: null } });
    
    console.log(`📊 Статистика grouping_id:`);
    console.log(`Всего товаров: ${totalProducts}`);
    console.log(`С grouping_id: ${withGroupingId}`);
    console.log(`Без grouping_id: ${totalProducts - withGroupingId}`);
    
    // Товары с одинаковым grouping_id
    const groupedProducts = await Product.aggregate([
      { $match: { grouping_id: { $ne: null } } },
      {
        $group: {
          _id: '$grouping_id',
          count: { $sum: 1 },
          products: { $push: { id: '$_id', name: '$name' } }
        }
      },
      { $match: { count: { $gt: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]).allowDiskUse(true);
    
    console.log(`\n📦 Топ-10 групп товаров с одинаковым grouping_id:\n`);
    
    for (const group of groupedProducts) {
      console.log(`\ngrouping_id: ${group._id}`);
      console.log(`  Товаров в группе: ${group.count}`);
      console.log(`  Примеры:`);
      for (const prod of group.products.slice(0, 3)) {
        console.log(`    - ${prod.name}`);
        
        // Проверим цены
        const prices = await Price.find({ product_id: prod.id })
          .populate('aggregator_id', 'name')
          .select('aggregator_id price');
        
        if (prices.length > 0) {
          const aggNames = prices.map(p => p.aggregator_id?.name || 'unknown').join(', ');
          console.log(`      Агрегаторы: ${aggNames}`);
        }
      }
    }
    
    await mongoose.disconnect();
    
  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

analyzeGrouping();
