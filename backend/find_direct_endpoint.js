const axios = require('axios');

const api = axios.create({
  baseURL: 'http://94.131.88.146:3000',
  headers: { 'Authorization': 'Bearer 7e248c0f2ddbe71f1d2339c731d0c5d5954e647a2c000e96d696c3f78acfb2d5' }
});

console.log('=== Checking for DIRECT mapping endpoint (not reverse) ===\n');

// Maybe there's a direct mapping endpoint that gives us raw Kaspi data
Promise.all([
  api.get('/api/magnum_almaty').catch(e => ({ error: e.response?.data || e.message })),
  api.get('/api/direct-mapping/magnum_almaty').catch(e => ({ error: e.response?.data || e.message })),
  api.get('/api/kaspi/magnum_almaty').catch(e => ({ error: e.response?.data || e.message })),
  api.get('/api/products-mapping/magnum_almaty').catch(e => ({ error: e.response?.data || e.message })),
]).then(results => {
  const endpoints = [
    '/api/magnum_almaty',
    '/api/direct-mapping/magnum_almaty', 
    '/api/kaspi/magnum_almaty',
    '/api/products-mapping/magnum_almaty'
  ];
  
  results.forEach((res, i) => {
    console.log(`\n${endpoints[i]}:`);
    if (res.error) {
      console.log(`  ❌ Error: ${JSON.stringify(res.error)}`);
    } else {
      const data = res.data;
      console.log(`  ✅ Success!`);
      console.log(`  Records: ${data.data?.length || 0}`);
      console.log(`  Format: ${data.format || 'unknown'}`);
      
      if (data.data?.[0]) {
        console.log(`  First record fields: ${Object.keys(data.data[0]).join(', ')}`);
        console.log(`  Sample record:`, JSON.stringify(data.data[0], null, 2).substring(0, 300));
      }
    }
  });
  
  process.exit(0);
});
