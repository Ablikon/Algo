const mongoose = require('mongoose');
const Price = require('./src/models/Price');
const Product = require('./src/models/Product');
const Aggregator = require('./src/models/Aggregator');

async function checkYandexLavka() {
  try {
    await mongoose.connect('mongodb+srv://admin:2525123@scoutalgo.tfqg35b.mongodb.net/scoutalgo');
    
    const yandex = await Aggregator.findOne({ name: 'Yandex Lavka' });
    
    const withoutUrl = await Price.find({ 
      aggregator: yandex._id,
      $or: [
        { product_url: { $exists: false } },
        { product_url: null },
        { product_url: '' }
      ]
    })
    .limit(5)
    .populate('product');
    
    console.log('❌ Yandex Lavka - записи БЕЗ URL:\n');
    withoutUrl.forEach((p, i) => {
      console.log(`${i+1}. ${p.product?.name || 'NO NAME'}`);
      console.log(`   Цена: ${p.current_price} тг`);
      console.log(`   Обновлено: ${p.updated_at.toISOString().split('T')[0]}`);
      console.log(`   product_url: ${p.product_url}`);
      console.log('');
    });
    
    const withUrl = await Price.find({ 
      aggregator: yandex._id,
      product_url: { $exists: true, $ne: null, $ne: '' }
    })
    .sort({ updated_at: -1 })
    .limit(3)
    .populate('product');
    
    console.log('✅ Yandex Lavka - записи С URL (последние):\n');
    withUrl.forEach((p, i) => {
      console.log(`${i+1}. ${p.product?.name || 'NO NAME'}`);
      console.log(`   URL: ${p.product_url.slice(0, 70)}...`);
      console.log(`   Обновлено: ${p.updated_at.toISOString().split('T')[0]}`);
      console.log('');
    });
    
    mongoose.disconnect();
  } catch (err) {
    console.error('Ошибка:', err.message);
    process.exit(1);
  }
}

checkYandexLavka();
