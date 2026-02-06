const axios = require('axios');

const api = axios.create({
  baseURL: 'http://94.131.88.146:3000',
  headers: { 'Authorization': 'Bearer 7e248c0f2ddbe71f1d2339c731d0c5d5954e647a2c000e96d696c3f78acfb2d5' }
});

console.log('=== Getting list of all available files ===\n');

api.get('/api/reverse-files').then(res => {
  const files = res.data.files || [];
  
  console.log(`Found ${files.length} files:\n`);
  
  files.forEach((f, i) => {
    console.log(`${i+1}. ${f.id || f.name || f}`);
  });
  
  // Check if there's a DIRECT Kaspi file (not reverse-mapped)
  console.log('\n=== Looking for direct Kaspi data files ===');
  
  const magnumFiles = files.filter(f => {
    const id = f.id || f.name || f;
    return id.toLowerCase().includes('magnum');
  });
  
  console.log(`\nMagnum-related files: ${magnumFiles.length}`);
  magnumFiles.forEach(f => {
    console.log(`  - ${f.id || f.name || f}`);
  });
  
  // Now let's try to get a KASPI file if it exists
  console.log('\n=== Trying to find pure Kaspi data endpoint ===');
  
  return Promise.all([
    api.get('/api/kaspi-files').catch(e => ({ error: 'not found' })),
    api.get('/api/files').catch(e => ({ error: 'not found' })),
    api.get('/api/products').catch(e => ({ error: 'not found' })),
  ]);
}).then(results => {
  const endpoints = ['/api/kaspi-files', '/api/files', '/api/products'];
  
  results.forEach((res, i) => {
    console.log(`\n${endpoints[i]}: ${res.error || 'Found!'}`);
    if (!res.error && res.data) {
      console.log(`  Data keys: ${Object.keys(res.data).join(', ')}`);
    }
  });
  
  process.exit(0);
}).catch(e => {
  console.error('Error:', e.message);
  process.exit(1);
});
