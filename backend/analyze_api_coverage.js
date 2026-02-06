const axios = require('axios');

const API_URL = 'http://94.131.88.146:3000';
const API_TOKEN = '7e248c0f2ddbe71f1d2339c731d0c5d5954e647a2c000e96d696c3f78acfb2d5';

const aggregators = [
  { name: 'Airba Fresh', fileId: 'airba_fresh_almaty' },
  { name: 'Arbuz.kz', fileId: 'arbuz_kz_almaty' },
  { name: 'Magnum', fileId: 'magnum_almaty' },
  { name: 'Wolt', fileId: 'wolt_almaty' },
  { name: 'Yandex Lavka', fileId: 'yandex_lavka_almaty' }
];

async function checkApiCoverage() {
  console.log('🔍 Проверка покрытия товаров во внешнем API:\n');
  
  const productsByAggregator = new Map();
  
  for (const agg of aggregators) {
    try {
      const response = await axios.get(`${API_URL}/api/csv-data/${agg.fileId}_mapped`, {
        headers: { Authorization: `Bearer ${API_TOKEN}` }
      });
      
      const records = response.data;
      const uniqueTitles = new Set();
      
      // API возвращает объект объектов: { uuid: { aggregator_name: { title, price, ... } } }
      for (const [uuid, aggregatorRecords] of Object.entries(records)) {
        for (const [aggName, record] of Object.entries(aggregatorRecords)) {
          if (record && record.title) {
            // Нормализуем название для сравнения
            const normalized = record.title.trim().toLowerCase();
            uniqueTitles.add(normalized);
          }
        }
      }
      
      productsByAggregator.set(agg.name, uniqueTitles);
      console.log(`${agg.name}: ${uniqueTitles.size} уникальных товаров`);
      
    } catch (error) {
      console.error(`❌ Ошибка для ${agg.name}:`, error.message);
    }
  }
  
  // Найдем пересечения
  console.log('\n📊 Анализ пересечений:\n');
  
  // Товары, которые есть во ВСЕХ агрегаторах
  const allAggregators = Array.from(productsByAggregator.values());
  if (allAggregators.length > 0) {
    let commonProducts = new Set(allAggregators[0]);
    for (let i = 1; i < allAggregators.length; i++) {
      commonProducts = new Set(
        [...commonProducts].filter(x => allAggregators[i].has(x))
      );
    }
    
    console.log(`Товаров во ВСЕХ агрегаторах: ${commonProducts.size}`);
    
    if (commonProducts.size > 0 && commonProducts.size < 20) {
      console.log('\nЭти товары:');
      [...commonProducts].slice(0, 10).forEach(title => console.log(`  - ${title}`));
    }
  }
  
  // Товары минимум в 3 агрегаторах
  const productCounts = new Map();
  for (const [aggName, products] of productsByAggregator) {
    for (const product of products) {
      productCounts.set(product, (productCounts.get(product) || 0) + 1);
    }
  }
  
  const productsIn3Plus = [...productCounts.entries()]
    .filter(([, count]) => count >= 3)
    .length;
  const productsIn4Plus = [...productCounts.entries()]
    .filter(([, count]) => count >= 4)
    .length;
  const productsIn5 = [...productCounts.entries()]
    .filter(([, count]) => count === 5)
    .length;
  
  console.log(`\nТоваров минимум в 3 агрегаторах: ${productsIn3Plus}`);
  console.log(`Товаров минимум в 4 агрегаторах: ${productsIn4Plus}`);
  console.log(`Товаров во всех 5 агрегаторах: ${productsIn5}`);
}

checkApiCoverage().catch(console.error);
