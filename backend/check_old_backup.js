const mongoose = require('mongoose');

const MONGODB_URI = 'mongodb+srv://admin:2525123@scoutalgo.tfqg35b.mongodb.net/scoutalgo';

async function checkBackup() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');
    
    const db = mongoose.connection.db;
    
    // Проверим, есть ли коллекция с бэкапом
    const collections = await db.listCollections().toArray();
    console.log('📂 Доступные коллекции:');
    collections.forEach(c => console.log(`  - ${c.name}`));
    
    // Проверим старые цены если они где-то сохранены
    const pricesBackup = collections.find(c => c.name.includes('backup') || c.name.includes('old'));
    if (pricesBackup) {
      console.log(`\n✅ Найден бэкап: ${pricesBackup.name}`);
      const count = await db.collection(pricesBackup.name).countDocuments();
      console.log(`Записей в бэкапе: ${count}`);
    } else {
      console.log('\n⚠️  Бэкап цен не найден');
    }
    
    await mongoose.disconnect();
    
  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    process.exit(1);
  }
}

checkBackup();
