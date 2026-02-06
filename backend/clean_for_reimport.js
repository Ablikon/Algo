const mongoose = require('mongoose');
const Price = require('./src/models/Price');
const Product = require('./src/models/Product');
const Aggregator = require('./src/models/Aggregator');

const MONGODB_URI = 'mongodb+srv://admin:2525123@scoutalgo.tfqg35b.mongodb.net/scoutalgo';

async function cleanForReimport() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');
    
    // Найдем агрегатор "Рядом"
    const ryadom = await Aggregator.findOne({ name: /Рядом/i });
    const ryadomId = ryadom ? ryadom._id : null;
    console.log('Рядом aggregator:', ryadomId ? ryadom.name : 'не найден');
    
    // Удалим ВСЕ цены кроме Рядом
    const priceFilter = ryadomId 
      ? { aggregator_id: { $ne: ryadomId } }
      : {};
    
    const deletedPrices = await Price.deleteMany(priceFilter);
    console.log(`\n🗑️  Удалено цен (кроме Рядом): ${deletedPrices.deletedCount}`);
    
    // Удалим ВСЕ товары без grouping_id и без цен от Рядом
    // Но сохраним товары с grouping_id (они нужны для связки)
    if (ryadomId) {
      // Найдем product_id которые имеют цены от Рядом
      const ryadomPrices = await Price.find({ aggregator_id: ryadomId }).select('product_id').lean();
      const ryadomProductIds = new Set(ryadomPrices.map(p => p.product_id.toString()));
      console.log(`Товаров с ценами Рядом: ${ryadomProductIds.size}`);
    }
    
    const remaining = await Price.countDocuments();
    const remainingProducts = await Product.countDocuments();
    console.log(`\n📊 После очистки:`);
    console.log(`  Цен: ${remaining}`);
    console.log(`  Товаров: ${remainingProducts}`);
    
    await mongoose.disconnect();
    console.log('\n✅ Очистка завершена. Запустите импорт: curl -X POST http://localhost:8000/api/sync/external-api -d \'{"force":true}\'');
    
  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    process.exit(1);
  }
}

cleanForReimport();
