const mongoose = require('mongoose');
const ImportJob = require('./src/models/ImportJob');

const MONGODB_URI = 'mongodb+srv://admin:2525123@scoutalgo.tfqg35b.mongodb.net/scoutalgo';

async function checkImportHistory() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');
    
    // Последние 20 импортов
    const imports = await ImportJob.find()
      .sort({ created_at: -1 })
      .limit(20);
    
    console.log('📜 История импортов (последние 20):\n');
    
    for (const imp of imports) {
      const date = new Date(imp.created_at).toLocaleString('ru-RU');
      console.log(`${date} | ${imp.file_id} | ${imp.status}`);
      console.log(`  Обработано: ${imp.processed_count}/${imp.total_count}`);
      console.log(`  Тип: ${imp.source_type || 'unknown'}`);
      if (imp.error_message) {
        console.log(`  Ошибка: ${imp.error_message}`);
      }
      console.log('');
    }
    
    await mongoose.disconnect();
    
  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    process.exit(1);
  }
}

checkImportHistory();
