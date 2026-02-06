const mongoose = require('mongoose');
const Price = require('./src/models/Price');
const Aggregator = require('./src/models/Aggregator');

async function checkAllUrls() {
  try {
    await mongoose.connect('mongodb+srv://admin:2525123@scoutalgo.tfqg35b.mongodb.net/scoutalgo');
    
    const aggregators = await Aggregator.find({});
    
    console.log('📊 Статистика URL для всех агрегаторов:\n');
    console.log('='.repeat(80));
    
    for (const agg of aggregators) {
      const total = await Price.countDocuments({ aggregator: agg._id });
      const withUrl = await Price.countDocuments({ 
        aggregator: agg._id, 
        product_url: { $exists: true, $ne: null, $ne: '' }
      });
      const withoutUrl = total - withUrl;
      
      const pct = total > 0 ? (withUrl/total*100).toFixed(1) : '0.0';
      const status = withUrl === total ? '✅' : withUrl > 0 ? '⚠️' : '❌';
      
      console.log(`${status} ${agg.name.padEnd(20)} | Всего: ${total.toString().padStart(6)} | С URL: ${withUrl.toString().padStart(6)} (${pct}%) | Без URL: ${withoutUrl.toString().padStart(6)}`);
      
      // Показываем примеры для агрегаторов с неполными URL
      if (withoutUrl > 0) {
        const samples = await Price.find({ 
          aggregator: agg._id,
          product_url: { $exists: false }
        })
        .limit(3)
        .populate('product');
        
        if (samples.length > 0) {
          console.log(`   └─ Примеры без URL:`);
          samples.forEach((p, i) => {
            console.log(`      ${i+1}. ${(p.product?.name || 'NO NAME').slice(0, 50)}`);
          });
        }
      }
    }
    
    console.log('='.repeat(80));
    
    // Общая статистика
    const totalPrices = await Price.countDocuments({});
    const totalWithUrl = await Price.countDocuments({ 
      product_url: { $exists: true, $ne: null, $ne: '' }
    });
    
    console.log(`\n📈 ИТОГО:`);
    console.log(`   Всего цен: ${totalPrices}`);
    console.log(`   С URL: ${totalWithUrl} (${(totalWithUrl/totalPrices*100).toFixed(1)}%)`);
    console.log(`   Без URL: ${totalPrices - totalWithUrl} (${((totalPrices-totalWithUrl)/totalPrices*100).toFixed(1)}%)`);
    
    mongoose.disconnect();
  } catch (err) {
    console.error('Ошибка:', err.message);
    process.exit(1);
  }
}

checkAllUrls();
