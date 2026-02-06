const mongoose = require('mongoose');
const Price = require('./src/models/Price');
const Product = require('./src/models/Product');

mongoose.connect('mongodb+srv://admin:2525123@scoutalgo.tfqg35b.mongodb.net/scoutalgo').then(async () => {
  
  // Группируем товары по количеству агрегаторов
  const priceStats = await Price.aggregate([
    { $group: { 
      _id: '$product',
      aggregatorCount: { $sum: 1 }
    }},
    { $group: {
      _id: '$aggregatorCount',
      productCount: { $sum: 1 }
    }},
    { $sort: { _id: -1 } }
  ]);
  
  console.log('📊 Распределение товаров по количеству агрегаторов:\n');
  
  let totalProducts = 0;
  priceStats.forEach(stat => {
    totalProducts += stat.productCount;
    console.log(`${stat._id} агрегаторов: ${stat.productCount} товаров`);
  });
  
  console.log(`\nВсего товаров с ценами: ${totalProducts}`);
  
  // Проверяем товары с максимальным покрытием
  const maxAggregators = priceStats[0]?._id || 0;
  const productsWithMaxCoverage = priceStats[0]?.productCount || 0;
  
  console.log(`\n⚠️  Товаров со всеми агрегаторами (${maxAggregators}): ${productsWithMaxCoverage}`);
  console.log(`Раньше было несколько страниц товаров с 6-7 агрегаторами`);
  
  mongoose.disconnect();
}).catch(e => { console.error(e.message); process.exit(1); });
