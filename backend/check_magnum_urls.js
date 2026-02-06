const mongoose = require('mongoose');
const Price = require('./src/models/Price');
const Aggregator = require('./src/models/Aggregator');

async function checkMagnumUrls() {
  try {
    await mongoose.connect('mongodb+srv://admin:2525123@scoutalgo.tfqg35b.mongodb.net/scoutalgo');
    
    const magnum = await Aggregator.findOne({ name: 'Magnum' });
    
    if (!magnum) {
      console.log('Magnum не найден');
      return;
    }
    
    const total = await Price.countDocuments({ aggregator: magnum._id });
    const withUrl = await Price.countDocuments({ 
      aggregator: magnum._id, 
      product_url: { $exists: true, $ne: null, $ne: '' }
    });
    const withoutUrl = total - withUrl;
    
    console.log('📊 Статистика Magnum в базе данных:');
    console.log(`   Всего цен: ${total}`);
    console.log(`   С URL: ${withUrl} (${(withUrl/total*100).toFixed(1)}%)`);
    console.log(`   Без URL: ${withoutUrl} (${(withoutUrl/total*100).toFixed(1)}%)`);
    
    // Показываем примеры последних обновлённых
    const recent = await Price.find({ 
      aggregator: magnum._id,
      product_url: { $exists: true, $ne: null }
    })
    .sort({ updated_at: -1 })
    .limit(5)
    .populate('product');
    
    console.log('\n✅ Последние 5 обновлённых товаров с URL:');
    recent.forEach((p, i) => {
      console.log(`\n${i+1}. ${p.product?.name || 'NO NAME'}`);
      console.log(`   URL: ${p.product_url.slice(0, 70)}...`);
      console.log(`   Цена: ${p.current_price} тг`);
      console.log(`   Обновлено: ${p.updated_at.toISOString().split('T')[0]}`);
    });
    
    mongoose.disconnect();
  } catch (err) {
    console.error('Ошибка:', err.message);
    process.exit(1);
  }
}

checkMagnumUrls();
