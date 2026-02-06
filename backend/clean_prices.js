const mongoose = require('mongoose');

const MONGODB_URI = 'mongodb+srv://admin:2525123@scoutalgo.tfqg35b.mongodb.net/scoutalgo';

mongoose.set('bufferTimeoutMS', 120000);

async function main() {
  const conn = await mongoose.connect(MONGODB_URI, {
    serverSelectionTimeoutMS: 30000,
    socketTimeoutMS: 120000,
  });
  
  const db = conn.connection.db;
  
  // Найдем Рядом
  const aggs = await db.collection('aggregators').find({ name: 'Рядом' }).toArray();
  if (aggs.length === 0) {
    console.log('Рядом не найден, удаляем ВСЕ цены');
    const r = await db.collection('prices').deleteMany({});
    console.log('Удалено:', r.deletedCount);
  } else {
    console.log('Рядом ID:', aggs[0]._id);
    const r = await db.collection('prices').deleteMany({ aggregator_id: { $ne: aggs[0]._id } });
    console.log('Удалено цен (кроме Рядом):', r.deletedCount);
  }
  
  const left = await db.collection('prices').countDocuments();
  console.log('Осталось цен:', left);
  
  await mongoose.disconnect();
  process.exit(0);
}

main().catch(err => { console.error(err.message); process.exit(1); });
