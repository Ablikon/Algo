const mongoose = require('mongoose');
const Price = require('./src/models/Price');

mongoose.connect('mongodb+srv://admin:2525123@scoutalgo.tfqg35b.mongodb.net/scoutalgo').then(async () => {
  
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  
  console.log('🗑️  Удаление старых цен (до сегодня)...\n');
  
  const result = await Price.deleteMany({
    last_updated: { $lt: today }
  });
  
  console.log(`✅ Удалено ${result.deletedCount} старых цен`);
  
  mongoose.disconnect();
}).catch(e => { console.error('Ошибка:', e.message); process.exit(1); });
