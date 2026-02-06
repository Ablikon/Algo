const mongoose = require('mongoose');
const Product = require('./src/models/Product');
const Price = require('./src/models/Price');

const MONGODB_URI = 'mongodb+srv://admin:2525123@scoutalgo.tfqg35b.mongodb.net/scoutalgo';

async function analyzeProducts() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');
    
    // Найдем товары с множественными именами от разных агрегаторов
    const productsWithNames = await Product.aggregate([
      {
        $project: {
          name: 1,
          nameVariantsCount: { $size: { $ifNull: ['$name_variants', []] } },
          name_variants: 1
        }
      },
      { $sort: { nameVariantsCount: -1 } },
      { $limit: 20 }
    ]);
    
    console.log('📦 Топ-20 товаров с множественными вариантами названий:\n');
    
    for (const product of productsWithNames) {
      console.log(`\n${product.name}`);
      console.log(`  Вариантов названий: ${product.nameVariantsCount}`);
      
      if (product.name_variants && product.name_variants.length > 0) {
        console.log('  Варианты:');
        product.name_variants.slice(0, 5).forEach(v => {
          console.log(`    - [${v.aggregator}] ${v.name}`);
        });
      }
      
      // Проверим цены для этого товара
      const prices = await Price.find({ product_id: product._id }).select('aggregator_id price');
      if (prices.length > 0) {
        console.log(`  Цены: ${prices.length} агрегаторов`);
      }
    }
    
    // Статистика
    const totalProducts = await Product.countDocuments();
    const productsWithVariants = await Product.countDocuments({
      name_variants: { $exists: true, $ne: [] }
    });
    
    console.log(`\n\n📊 Статистика:`);
    console.log(`Всего товаров: ${totalProducts}`);
    console.log(`Товаров с вариантами названий: ${productsWithVariants}`);
    console.log(`Товаров без вариантов: ${totalProducts - productsWithVariants}`);
    
    await mongoose.disconnect();
    
  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

analyzeProducts();
