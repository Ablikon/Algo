const axios = require('axios');

const api = axios.create({
  baseURL: 'http://94.131.88.146:3000',
  headers: { 'Authorization': 'Bearer 7e248c0f2ddbe71f1d2339c731d0c5d5954e647a2c000e96d696c3f78acfb2d5' }
});

console.log('=== Checking available API endpoints ===\n');

// Try to get list of endpoints or swagger
Promise.all([
  api.get('/').catch(e => ({ error: e.message })),
  api.get('/api').catch(e => ({ error: e.message })),
  api.get('/docs').catch(e => ({ error: e.message })),
  api.get('/api-docs').catch(e => ({ error: e.message })),
  api.get('/swagger').catch(e => ({ error: e.message })),
]).then(results => {
  results.forEach((res, i) => {
    const endpoints = ['/', '/api', '/docs', '/api-docs', '/swagger'];
    console.log(`${endpoints[i]}: ${res.error || 'Success'}`);
    if (res.data && !res.error) {
      console.log(`  Response type: ${typeof res.data}`);
      if (typeof res.data === 'string') {
        console.log(`  Content preview: ${res.data.substring(0, 200)}...`);
      } else {
        console.log(`  Keys: ${Object.keys(res.data).join(', ')}`);
      }
    }
  });
  
  console.log('\n=== Now trying different data endpoints ===\n');
  
  // Try different endpoints for magnum data
  return Promise.all([
    api.get('/api/reverse-mapping/magnum_almaty').then(r => ({ name: '/api/reverse-mapping/magnum_almaty', data: r.data })).catch(e => ({ name: '/api/reverse-mapping/magnum_almaty', error: e.message })),
    api.get('/api/mapping/magnum_almaty').then(r => ({ name: '/api/mapping/magnum_almaty', data: r.data })).catch(e => ({ name: '/api/mapping/magnum_almaty', error: e.message })),
    api.get('/api/data/magnum_almaty').then(r => ({ name: '/api/data/magnum_almaty', data: r.data })).catch(e => ({ name: '/api/data/magnum_almaty', error: e.message })),
    api.get('/api/products/magnum_almaty').then(r => ({ name: '/api/products/magnum_almaty', data: r.data })).catch(e => ({ name: '/api/products/magnum_almaty', error: e.message })),
    api.get('/api/magnum_almaty').then(r => ({ name: '/api/magnum_almaty', data: r.data })).catch(e => ({ name: '/api/magnum_almaty', error: e.message })),
  ]);
}).then(results => {
  results.forEach(res => {
    console.log(`\n${res.name}:`);
    if (res.error) {
      console.log(`  Error: ${res.error}`);
    } else {
      const recordsCount = res.data?.recordsCount || res.data?.data?.length || 0;
      const format = res.data?.format || 'unknown';
      const hasUrl = res.data?.data?.[0]?.url ? 'YES' : 'NO';
      console.log(`  Records: ${recordsCount}`);
      console.log(`  Format: ${format}`);
      console.log(`  Has URL in first record: ${hasUrl}`);
      
      if (res.data?.data?.[0]) {
        console.log(`  First record fields: ${Object.keys(res.data.data[0]).join(', ')}`);
      }
    }
  });
  
  process.exit(0);
}).catch(e => {
  console.error('Error:', e.message);
  process.exit(1);
});
