const mongoose = require('mongoose');
const Product = require('./src/models/Product');
const Price = require('./src/models/Price');

const MONGODB_URI = 'mongodb+srv://admin:2525123@scoutalgo.tfqg35b.mongodb.net/scoutalgo';

async function mergeDuplicatesFast() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');
    
    console.log('🔍 Поиск дубликатов через агрегацию...\n');
    
    let mergedCount = 0;
    let pricesMoved = 0;
    let productsDeleted = 0;
    let processedGroups = 0;
    
    // Используем cursor для обработки по одной группе за раз
    const db = mongoose.connection.db;
    
    // Простой подход: обрабатываем товары с одинаковыми нормализованными именами
    // По 1000 товаров за раз
    const BATCH_SIZE = 1000;
    let skip = 0;
    let hasMore = true;
    
    while (hasMore) {
      const products = await Product.find({})
        .select('_id name category image_url brand')
        .skip(skip)
        .limit(BATCH_SIZE)
        .lean();
      
      if (products.length === 0) {
        hasMore = false;
        break;
      }
      
      // Группируем по нормализованному имени
      const normalized = new Map();
      for (const p of products) {
        const norm = p.name
          .toLowerCase()
          .replace(/[^\wа-яё]/g, '')
          .replace(/\s+/g, '');
        
        if (!normalized.has(norm)) {
          normalized.set(norm, []);
        }
        normalized.get(norm).push(p);
      }
      
      // Обрабатываем группы с дубликатами в этом batch
      for (const [norm, group] of normalized) {
        if (group.length <= 1) continue;
        
        // Выбираем "главный" товар
        let masterProduct = group[0];
        for (const p of group) {
          const masterScore = (masterProduct.category ? 1 : 0) + (masterProduct.image_url ? 1 : 0) + (masterProduct.brand ? 1 : 0);
          const pScore = (p.category ? 1 : 0) + (p.image_url ? 1 : 0) + (p.brand ? 1 : 0);
          if (pScore > masterScore) {
            masterProduct = p;
          }
        }
        
        const duplicateIds = group
          .filter(p => p._id.toString() !== masterProduct._id.toString())
          .map(p => p._id);
        
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
        processedGroups++;
        
        if (processedGroups % 100 === 0) {
          console.log(`  Обработано групп: ${processedGroups}, перемещено цен: ${pricesMoved}, удалено товаров: ${productsDeleted}`);
        }
      }
      
      skip += BATCH_SIZE;
      console.log(`📦 Обработано ${skip} товаров...`);
    }
    
    console.log(`\n✅ Объединение завершено!`);
    console.log(`\n📊 Статистика:`);
    console.log(`  Групп объединено: ${mergedCount}`);
    console.log(`  Цен перемещено: ${pricesMoved}`);
    console.log(`  Товаров удалено: ${productsDeleted}`);
    
    // Проверим результаты
    const finalProductCount = await Product.countDocuments();
    const finalPriceCount = await Price.countDocuments();
    
    console.log(`\n  Товаров в базе: ${finalProductCount}`);
    console.log(`  Цен в базе: ${finalPriceCount}`);
    
    // Проверим покрытие
    console.log('\n📊 Проверка покрытия...');
    const coverage = await Price.aggregate([
      { $group: { _id: '$product_id', count: { $sum: 1 } } },
      { $group: { _id: '$count', products: { $sum: 1 } } },
      { $sort: { _id: -1 } }
    ]);
    
    console.log('\n📊 Распределение товаров по количеству агрегаторов:');
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

mergeDuplicatesFast();
