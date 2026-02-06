const mongoose = require('mongoose');
const Product = require('./src/models/Product');

const MONGODB_URI = 'mongodb+srv://admin:2525123@scoutalgo.tfqg35b.mongodb.net/scoutalgo';

function normalizeName(name) {
  return name
    .toLowerCase()
    .replace(/[^\wа-яё]/g, '') // Убираем всё кроме букв и цифр
    .replace(/\s+/g, ''); // Убираем пробелы
}

async function findDuplicates() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');
    
    console.log('Загрузка товаров...');
    const products = await Product.find({}).select('_id name').lean();
    console.log(`Загружено ${products.length} товаров\n`);
    
    // Группируем по нормализованному имени
    const normalized = new Map();
    for (const p of products) {
      const norm = normalizeName(p.name);
      if (!normalized.has(norm)) {
        normalized.set(norm, []);
      }
      normalized.get(norm).push(p);
    }
    
    // Находим группы с несколькими товарами
    const duplicates = [];
    for (const [norm, prods] of normalized) {
      if (prods.length > 1) {
        duplicates.push({ normalized: norm, products: prods });
      }
    }
    
    console.log(`📊 Найдено групп дубликатов: ${duplicates.length}\n`);
    
    // Сортируем по количеству дубликатов
    duplicates.sort((a, b) => b.products.length - a.products.length);
    
    // Показываем топ-20
    console.log('Топ-20 групп с наибольшим количеством дубликатов:\n');
    for (let i = 0; i < Math.min(20, duplicates.length); i++) {
      const group = duplicates[i];
      console.log(`\n${i + 1}. Товаров в группе: ${group.products.length}`);
      console.log(`   Нормализованное имя: ${group.normalized.substring(0, 50)}...`);
      console.log(`   Примеры:`);
      for (let j = 0; j < Math.min(5, group.products.length); j++) {
        console.log(`     - ${group.products[j].name}`);
      }
    }
    
    // Подсчитаем общее количество дубликатов
    let totalDuplicates = 0;
    for (const group of duplicates) {
      totalDuplicates += group.products.length - 1; // Минус 1, т.к. один оригинал
    }
    
    console.log(`\n\n📊 Статистика:`);
    console.log(`Всего товаров: ${products.length}`);
    console.log(`Уникальных нормализованных названий: ${normalized.size}`);
    console.log(`Групп с дубликатами: ${duplicates.length}`);
    console.log(`Всего дубликатов (лишних): ${totalDuplicates}`);
    
    await mongoose.disconnect();
    
  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    process.exit(1);
  }
}

findDuplicates();
