const mongoose = require('mongoose');
require('./src/models/Price');
require('./src/models/Product');
require('./src/models/Aggregator');

mongoose.connect('mongodb+srv://admin:2525123@scoutalgo.tfqg35b.mongodb.net/scoutalgo').then(async () => {
  const Aggregator = mongoose.model('Aggregator');
  const Price = mongoose.model('Price');
  
  const aggregators = await Aggregator.find({});
  
  console.log('📊 Проверка URL для всех агрегаторов (обновлённые сегодня):\n');
  
  const today = new Date();
  const startOfDay = new Date(today.setUTCHours(0,0,0,0));
  
  for (const agg of aggregators) {
    const updatedToday = await Price.countDocuments({
      aggregator: agg._id,
      updated_at: { $gte: startOfDay }
    });
    
    if (updatedToday === 0) continue;
    
    const withUrlToday = await Price.countDocuments({
      aggregator: agg._id,
      updated_at: { $gte: startOfDay },
      product_url: { $exists: true, $ne: null, $ne: '' }
    });
    
    const pct = (withUrlToday/updatedToday*100).toFixed(1);
    const status = withUrlToday === updatedToday ? '✅' : '⚠️';
    
    console.log(`${status} ${agg.name.padEnd(20)} | Обновлено: ${updatedToday.toString().padStart(5)} | С URL: ${withUrlToday.toString().padStart(5)} (${pct}%)`);
  }
  
  mongoose.disconnect();
}).catch(e => { console.error('Ошибка:', e.message); process.exit(1); });
