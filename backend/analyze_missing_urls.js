const mongoose = require('mongoose');
const Price = require('./src/models/Price');
const Aggregator = require('./src/models/Aggregator');
const Product = require('./src/models/Product');

mongoose.connect('mongodb+srv://admin:2525123@scoutalgo.tfqg35b.mongodb.net/scoutalgo').then(async () => {
  const yandex = await Aggregator.findOne({ name: 'Yandex Lavka' });
  
  // Находим записи без URL
  const withoutUrl = await Price.find({ 
    aggregator: yandex._id,
    $or: [
      { product_url: { $exists: false } },
      { product_url: null },
      { product_url: '' }
    ]
  })
  .sort({ last_updated: -1 })
  .limit(10)
  .populate('product');
  
  console.log('❌ Yandex Lavka - записи БЕЗ URL:\n');
  withoutUrl.forEach((p, i) => {
    console.log(`${i+1}. ${p.product?.name || 'NO NAME'}`);
    console.log(`   Цена: ${p.price} тг`);
    console.log(`   Обновлено: ${p.last_updated.toISOString().split('T')[0]}`);
    console.log('');
  });
  
  // Проверяем - есть ли эти товары в свежих данных
  console.log('\n🔍 Проверяем наличие в API...\n');
  const axios = require('axios');
  const client = axios.create({
    baseURL: 'http://94.131.88.146:3000',
    headers: { 'Authorization': 'Bearer 7e248c0f2ddbe71f1d2339c731d0c5d5954e647a2c000e96d696c3f78acfb2d5' }
  });
  
  try {
    const almaty = await client.get('/api/csv-data/yandex_lavka_almaty_mapped');
    const astana = await client.get('/api/csv-data/yandex_lavka_astana_mapped');
    const allRecords = [...almaty.data.data, ...astana.data.data];
    
    console.log(`Всего записей в API: ${allRecords.length}`);
    console.log(`С URL в API: ${allRecords.filter(r => r.url).length}\n`);
    
    // Проверяем каждый товар без URL - есть ли он в API
    for (const p of withoutUrl.slice(0, 5)) {
      const productName = p.product?.name;
      if (!productName) continue;
      
      const found = allRecords.find(r => r.title === productName);
      if (found) {
        console.log(`✅ "${productName.slice(0, 50)}"`);
        console.log(`   В API: есть, URL: ${found.url ? 'есть' : 'НЕТ'}`);
      } else {
        console.log(`❌ "${productName.slice(0, 50)}"`);
        console.log(`   В API: НЕТ`);
      }
    }
    
  } catch (error) {
    console.error('Ошибка при проверке API:', error.message);
  }
  
  mongoose.disconnect();
}).catch(e => { console.error('Ошибка:', e.message); process.exit(1); });
