const mongoose = require('mongoose');
const Price = require('./src/models/Price');
const Aggregator = require('./src/models/Aggregator');

mongoose.connect('mongodb+srv://admin:2525123@scoutalgo.tfqg35b.mongodb.net/scoutalgo').then(async () => {
  const ryadom = await Aggregator.findOne({ name: 'Рядом' });
  
  if (!ryadom) {
    console.log('Рядом не найден');
    mongoose.disconnect();
    return;
  }
  
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  
  const allPrices = await Price.countDocuments({ aggregator: ryadom._id });
  const oldPrices = await Price.countDocuments({ aggregator: ryadom._id, last_updated: { $lt: today } });
  const newPrices = await Price.countDocuments({ aggregator: ryadom._id, last_updated: { $gte: today } });
  
  console.log('📊 Статистика цен Рядом:');
  console.log(`   Всего: ${allPrices}`);
  console.log(`   Старые (до сегодня): ${oldPrices}`);
  console.log(`   Новые (сегодня): ${newPrices}`);
  
  if (allPrices === 0) {
    console.log('\n⚠️  ВСЕ ЦЕНЫ РЯДОМ БЫЛИ УДАЛЕНЫ!');
    console.log('Они были старыми (от 27 января) и удалились вместе с остальными старыми ценами.');
    console.log('\nРядом не импортируется из внешнего API.');
    console.log('Нужно восстановить данные из файла Data/bq-results-20260120-103930-1768905602731.csv');
  }
  
  mongoose.disconnect();
}).catch(e => console.error(e.message));
