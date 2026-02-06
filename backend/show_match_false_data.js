const axios = require('axios');

const api = axios.create({
  baseURL: 'http://94.131.88.146:3000',
  headers: { 'Authorization': 'Bearer 7e248c0f2ddbe71f1d2339c731d0c5d5954e647a2c000e96d696c3f78acfb2d5' }
});

console.log('=== ПОЛУЧАЕМ ДАННЫЕ ОТ API ===\n');

api.get('/api/reverse-mapping/magnum_almaty').then(res => {
  const records = res.data.data || [];
  
  console.log(`Всего записей: ${records.length}`);
  console.log('');
  
  // Разделим на match=true и match=false
  const withMatch = records.filter(r => r.match === true);
  const withoutMatch = records.filter(r => r.match === false);
  
  console.log(`✅ С match=true: ${withMatch.length} записей`);
  console.log(`❌ С match=false: ${withoutMatch.length} записей`);
  console.log('');
  
  console.log('='.repeat(80));
  console.log('ПРИМЕРЫ ЗАПИСЕЙ С match=false (то, что вы спрашиваете):');
  console.log('='.repeat(80));
  
  withoutMatch.slice(0, 10).forEach((r, i) => {
    console.log(`\n${i+1}. ЗАПИСЬ С match=false:`);
    console.log(JSON.stringify(r, null, 2));
  });
  
  console.log('\n' + '='.repeat(80));
  console.log('ДЛЯ СРАВНЕНИЯ - ПРИМЕРЫ ЗАПИСЕЙ С match=true:');
  console.log('='.repeat(80));
  
  withMatch.slice(0, 3).forEach((r, i) => {
    console.log(`\n${i+1}. ЗАПИСЬ С match=true:`);
    console.log(JSON.stringify(r, null, 2));
  });
  
  console.log('\n' + '='.repeat(80));
  console.log('ВЫВОДЫ:');
  console.log('='.repeat(80));
  console.log(`
1. match=false записи имеют только:
   - csv_name (название из Magnum)
   - csv_brand (бренд из Magnum)
   - csv_weight (вес из Magnum)
   - market_name (MAGNUM ALMATY)
   - ntin (штрихкод)
   
   НЕТ полей: title, url, cost, price, product_id
   
2. match=true записи имеют:
   - ВСЕ поля из match=false +
   - title (название товара на Kaspi)
   - url (ссылка на Kaspi)
   - cost (цена на Kaspi)
   - product_id (ID товара на Kaspi)
   - url_picture (картинка с Kaspi)
   
3. Это значит:
   - match=false = товары только из каталога Magnum (нет на Kaspi)
   - match=true = товары которые НАЙДЕНЫ на Kaspi (есть ссылка)
  `);
  
  process.exit(0);
}).catch(e => {
  console.error('Ошибка:', e.message);
  process.exit(1);
});
