const axios = require('axios');

const api = axios.create({
  baseURL: 'http://94.131.88.146:3000',
  headers: { 'Authorization': 'Bearer 7e248c0f2ddbe71f1d2339c731d0c5d5954e647a2c000e96d696c3f78acfb2d5' }
});

console.log('=== Getting list of available files ===\n');

// Try to get list of files
api.get('/api/files').then(res => {
  console.log('Available files:');
  const files = res.data.files || res.data || [];
  files.forEach(f => {
    console.log(`  - ${f.name || f}`);
  });
  console.log('');
  
  // Now let's try direct endpoint without reverse-mapping
  console.log('=== Trying /api/magnum/almaty (without reverse-mapping) ===\n');
  return api.get('/api/magnum/almaty');
}).then(res => {
  console.log('Success!');
  console.log('Records:', res.data.data?.length || 0);
  console.log('Format:', res.data.format || 'unknown');
  
  if (res.data.data?.[0]) {
    console.log('First record fields:', Object.keys(res.data.data[0]).join(', '));
    console.log('First record:', JSON.stringify(res.data.data[0], null, 2));
  }
  
  process.exit(0);
}).catch(e => {
  console.log('Error getting direct endpoint:', e.response?.data || e.message);
  
  // Try list files endpoint
  console.log('\n=== Trying /api/list ===');
  return api.get('/api/list');
}).then(res => {
  if (res?.data) {
    console.log('Files list:', res.data);
  }
  process.exit(0);
}).catch(e => {
  console.log('Error:', e.response?.data || e.message);
  process.exit(1);
});
