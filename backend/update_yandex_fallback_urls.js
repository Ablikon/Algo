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
  }).populate('product');
  
  console.log(`Найдено ${withoutUrl.length} цен Yandex Lavka без URL\n`);
  
  let updated = 0;
  
  // Создаём fallback URL для каждого товара
  for (const price of withoutUrl) {
    if (!price.product || !price.product.name) continue;
    
    const productName = price.product.name;
    // Создаём поисковую ссылку на Yandex Lavka
    const searchUrl = `https://lavka.yandex.kz/search?q=${encodeURIComponent(productName)}`;
    
    await Price.updateOne(
      { _id: price._id },
      { 
        $set: { 
          product_url: searchUrl,
          last_updated: new Date()
        }
      }
    );
    
    updated++;
    
    if (updated <= 10) {
      console.log(`${updated}. ${productName.slice(0, 60)}`);
      console.log(`   URL: ${searchUrl.slice(0, 80)}...`);
    }
  }
  
  console.log(`\n✅ Обновлено ${updated} цен с fallback URL`);
  
  mongoose.disconnect();
}).catch(e => { console.error('Ошибка:', e.message); process.exit(1); });
