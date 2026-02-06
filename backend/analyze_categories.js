const mongoose = require('mongoose');
const axios = require('axios');
require('dotenv').config();

async function main() {
  await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB_NAME || 'scoutalgo' });
  
  const api = axios.create({
    baseURL: process.env.EXTERNAL_API_BASE,
    headers: { 'Authorization': `Bearer ${process.env.EXTERNAL_API_TOKEN}` },
    timeout: 120000
  });
  
  const files = [
    'airba_fresh_almaty_mapped',
    'airba_fresh_astana_mapped',
    'arbuz_kz_almaty_mapped',
    'arbuz_kz_astana_mapped',
    'magnum_almaty_mapped',
    'magnum_astana_mapped',
    'wolt_market_almaty_mapped',
    'wolt_market_astana_mapped',
    'yandex_lavka_almaty_mapped',
    'yandex_lavka_astana_mapped'
  ];
  
  for (const fileId of files) {
    try {
      const res = await api.get(`/api/csv-data/${fileId}`);
      const records = res.data.data || res.data || [];
      
      const cats = {};
      for (const r of records) {
        const catPath = r.category_full_path || r.category || '';
        if (!catPath) continue;
        if (!cats[catPath]) cats[catPath] = 0;
        cats[catPath]++;
      }
      
      const sorted = Object.entries(cats).sort((a, b) => b[1] - a[1]);
      console.log(`\n${'='.repeat(60)}`);
      console.log(`${fileId} — ${records.length} records, ${sorted.length} unique categories`);
      console.log('='.repeat(60));
      sorted.forEach(([cat, count]) => {
        console.log(`  ${count.toString().padStart(5)} | ${cat}`);
      });
    } catch (e) {
      console.log(`\n=== ${fileId} === ERROR:`, e.message);
    }
  }
  
  await mongoose.disconnect();
}

main().catch(console.error);
