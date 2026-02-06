const axios = require('axios');

const api = axios.create({
  baseURL: 'http://94.131.88.146:3000',
  headers: { 'Authorization': 'Bearer 7e248c0f2ddbe71f1d2339c731d0c5d5954e647a2c000e96d696c3f78acfb2d5' }
});

console.log('=== ИЩЕМ ПРАВИЛЬНЫЙ ЭНДПОИНТ С ПОЛНЫМИ ДАННЫМИ ===\n');

// Пробуем разные варианты
const endpoints = [
  '/api/kaspi/magnum_almaty',
  '/api/products/magnum_almaty',
  '/api/magnum_almaty',
  '/api/data/magnum_almaty',
  '/api/kaspi/magnum',
  '/api/products/magnum',
  '/api/scraped/magnum_almaty',
  '/api/parsed/magnum_almaty',
  '/api/raw/magnum_almaty',
  '/api/kaspi-products/magnum_almaty',
];

Promise.all(
  endpoints.map(ep => 
    api.get(ep)
      .then(res => ({ endpoint: ep, success: true, data: res.data }))
      .catch(e => ({ endpoint: ep, success: false, error: e.response?.status || e.message }))
  )
).then(results => {
  console.log('Результаты проверки эндпоинтов:\n');
  
  results.forEach(r => {
    if (r.success) {
      console.log(`✅ ${r.endpoint}`);
      console.log(`   Записей: ${r.data.data?.length || r.data.length || 'N/A'}`);
      
      if (r.data.data?.[0]) {
        const firstRecord = r.data.data[0];
        console.log(`   Поля: ${Object.keys(firstRecord).join(', ')}`);
        console.log(`   Есть url?: ${firstRecord.url ? 'ДА' : 'НЕТ'}`);
        console.log(`   Есть cost?: ${firstRecord.cost ? 'ДА' : 'НЕТ'}`);
        console.log(`   Есть match?: ${firstRecord.match !== undefined ? 'ДА' : 'НЕТ'}`);
        console.log(`\n   Пример записи:`);
        console.log(JSON.stringify(firstRecord, null, 2).substring(0, 500));
      }
      console.log('');
    } else {
      console.log(`❌ ${r.endpoint} - ${r.error}`);
    }
  });
  
  process.exit(0);
}).catch(e => {
  console.error('Ошибка:', e.message);
  process.exit(1);
});
