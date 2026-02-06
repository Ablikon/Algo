const axios = require('axios');

async function monitorImport() {
  console.log('🔄 Мониторинг импорта...\n');
  
  let isRunning = true;
  let lastStatus = '';
  
  while (isRunning) {
    try {
      const res = await axios.get('http://localhost:8000/api/import/external/progress');
      const data = res.data;
      
      const status = `${data.current_file || 'waiting'} - Products: ${data.total_products}, Prices: ${data.total_prices}`;
      
      if (status !== lastStatus) {
        console.log(`[${new Date().toLocaleTimeString()}] ${status}`);
        lastStatus = status;
      }
      
      if (data.status === 'completed' || data.status === 'failed') {
        console.log(`\n✅ Импорт завершён со статусом: ${data.status}`);
        isRunning = false;
        break;
      }
      
      await new Promise(resolve => setTimeout(resolve, 5000));
      
    } catch (err) {
      console.error('Ошибка:', err.message);
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
}

monitorImport();
