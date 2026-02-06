const axios = require('axios');

const client = axios.create({
  baseURL: 'http://94.131.88.146:3000',
  headers: { 'Authorization': 'Bearer 7e248c0f2ddbe71f1d2339c731d0c5d5954e647a2c000e96d696c3f78acfb2d5' }
});

async function testNewEndpoint() {
  try {
    console.log('🔍 Тестируем новый эндпоинт /api/csv-data/magnum_almaty_mapped\n');
    
    const response = await client.get('/api/csv-data/magnum_almaty_mapped');
    const records = response.data.data || [];
    
    console.log(`✅ Получено записей: ${records.length}`);
    
    // Проверяем URL
    const withUrl = records.filter(r => r.url && r.url.trim() !== '');
    const withoutUrl = records.filter(r => !r.url || r.url.trim() === '');
    
    console.log(`\n📊 Статистика URL:`);
    console.log(`   С URL: ${withUrl.length} (${(withUrl.length/records.length*100).toFixed(1)}%)`);
    console.log(`   Без URL: ${withoutUrl.length} (${(withoutUrl.length/records.length*100).toFixed(1)}%)`);
    
    // Показываем примеры записей С URL
    console.log(`\n✅ Первые 5 записей С URL:`);
    withUrl.slice(0, 5).forEach((r, i) => {
      console.log(`\n${i+1}. ${r.title}`);
      console.log(`   URL: ${r.url.slice(0, 80)}...`);
      console.log(`   Цена: ${r.cost} тг`);
      console.log(`   Город: ${r.city || 'не указан'}`);
      console.log(`   Product ID: ${r.product_id || 'нет'}`);
    });
    
    // Проверяем поля
    console.log(`\n📋 Доступные поля в записях:`);
    const allFields = new Set();
    records.slice(0, 100).forEach(r => {
      Object.keys(r).forEach(k => allFields.add(k));
    });
    console.log(`   ${Array.from(allFields).sort().join(', ')}`);
    
  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    if (error.response) {
      console.error('   Статус:', error.response.status);
      console.error('   Ответ:', error.response.data);
    }
  }
}

testNewEndpoint();
