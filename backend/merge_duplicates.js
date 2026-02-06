const mongoose = require('mongoose');
const Product = require('./src/models/Product');
const Price = require('./src/models/Price');

const MONGODB_URI = 'mongodb+srv://admin:2525123@scoutalgo.tfqg35b.mongodb.net/scoutalgo';

function normalizeName(name) {
  return name
    .toLowerCase()
    .replace(/[^\wа-яё]/g, '')
    .replace(/\s+/g, '');
}

async function mergeDuplicates() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');
    
    // Обрабатываем товары небольшими порциями
    const BATCH_SIZE = 5000;
    const totalCount = await Product.countDocuments();
    console.log(`📦 Всего товаров: ${totalCount}`);
    console.log(`Обработка batch по ${BATCH_SIZE}...\n`);
    
    const normalized = new Map();
    let processed = 0;
    
    // Загружаем и обрабатываем товары порциями
    for (let skip = 0; skip < totalCount; skip += BATCH_SIZE) {
      const batch = await Product.find({})
        .select('_id name category image_url brand')
        .skip(skip)
        .limit(BATCH_SIZE)
        .lean();
      
      for (const p of batch) {
        const norm = normalizeName(p.name);
        if (!normalized.has(norm)) {
          normalized.set(norm, []);
        }
        normalized.get(norm).push(p);
      }
      
      processed += batch.length;
      console.log(`  Загружено ${processed}/${totalCount} товаров...`);
    }
    
    // Находим группы с дубликатами
    console.log('\n🔄 Поиск дубликатов...');
    const duplicateGroups = [];
    for (const [norm, prods] of normalized) {
      if (prods.length > 1) {
        duplicateGroups.push(prods);
      }
    }
    
    console.log(`\n📊 Найдено ${duplicateGroups.length} групп дубликатов`);
    
    if (duplicateGroups.length === 0) {
      console.log('Нет дубликатов для объединения');
      await mongoose.disconnect();
      return;
    }
    
    const totalDuplicates = duplicateGroups.reduce((sum, g) => sum + g.length - 1, 0);
    console.log(`Будет объединено ${totalDuplicates} товаров\n`);
    
    let mergedCount = 0;
    let pricesMoved = 0;
    let productsDeleted = 0;
    
    console.log('🔧 Начинаем объединение...\n');
    
    // Обрабатываем по 500 групп за раз для скорости
    const MERGE_BATCH = 500;
    
    for (let i = 0; i < duplicateGroups.length; i += MERGE_BATCH) {
      const batch = duplicateGroups.slice(i, i + MERGE_BATCH);
      
      for (const group of batch) {
        // Выбираем "главный" товар
        let masterProduct = group[0];
        for (const p of group) {
          const masterScore = (masterProduct.category ? 1 : 0) + (masterProduct.image_url ? 1 : 0) + (masterProduct.brand ? 1 : 0);
          const pScore = (p.category ? 1 : 0) + (p.image_url ? 1 : 0) + (p.brand ? 1 : 0);
          if (pScore > masterScore) {
            masterProduct = p;
          }
        }
        
        const duplicateIds = group.filter(p => p._id.toString() !== masterProduct._id.toString()).map(p => p._id);
        
        if (duplicateIds.length === 0) continue;
        
        // Перемещаем цены
        const result = await Price.updateMany(
          { product_id: { $in: duplicateIds } },
          { $set: { product_id: masterProduct._id } }
        );
        
        pricesMoved += result.modifiedCount;
        
        // Удаляем дубликаты
        await Product.deleteMany({ _id: { $in: duplicateIds } });
        productsDeleted += duplicateIds.length;
        
        mergedCount++;
      }
      
      console.log(`  Обработано ${Math.min(i + MERGE_BATCH, duplicateGroups.length)}/${duplicateGroups.length} групп...`);
    }
    
    console.log(`\n✅ Объединение завершено!`);
    console.log(`\n📊 Статистика:`);
    console.log(`  Групп объединено: ${mergedCount}`);
    console.log(`  Цен перемещено: ${pricesMoved}`);
    console.log(`  Товаров удалено: ${productsDeleted}`);
    
    // Проверим результаты
    const finalProductCount = await Product.countDocuments();
    const finalPriceCount = await Price.countDocuments();
    
    console.log(`\n  Товаров осталось: ${finalProductCount} (было ${products.length})`);
    console.log(`  Цен в базе: ${finalPriceCount}`);
    
    // Проверим покрытие
    const coverage = await Price.aggregate([
      { $group: { _id: '$product_id', count: { $sum: 1 } } },
      { $group: { _id: '$count', products: { $sum: 1 } } },
      { $sort: { _id: -1 } }
    ]);
    
    console.log(`\n📊 Распределение по количеству агрегаторов:`);
    coverage.forEach(c => {
      console.log(`  ${c._id} агрегаторов: ${c.products} товаров`);
    });
    
    await mongoose.disconnect();
    
  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

mergeDuplicates();
