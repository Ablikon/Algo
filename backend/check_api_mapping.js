const axios = require('axios');

const api = axios.create({
  baseURL: 'http://94.131.88.146:3000',
  headers: { 'Authorization': 'Bearer 7e248c0f2ddbe71f1d2339c731d0c5d5954e647a2c000e96d696c3f78acfb2d5' }
});

console.log('=== Testing /api/mapping endpoint ===\n');

api.get('/api/mapping/magnum_almaty').then(res => {
  const records = res.data.data || res.data || [];
  
  console.log('Total records:', records.length);
  console.log('\nFirst 5 records:\n');
  
  records.slice(0, 5).forEach((r, i) => {
    console.log(`${i+1}. Title: ${r.title || r.name || 'NO TITLE'}`);
    console.log(`   url: "${r.url}"`);
    console.log(`   url type: ${typeof r.url}`);
    console.log(`   matched_uuid: ${r.matched_uuid || r.uuid || 'NO UUID'}`);
    console.log(`   match: ${r.match}`);
    console.log('');
  });
  
  // Check URL statistics
  const withUrl = records.filter(r => r.url && r.url.trim() !== '');
  const withKaspiUrl = records.filter(r => r.url && r.url.includes('kaspi.kz'));
  const emptyUrl = records.filter(r => !r.url || r.url.trim() === '');
  
  console.log('\n=== URL Statistics ===');
  console.log(`Total records: ${records.length}`);
  console.log(`With URL: ${withUrl.length}`);
  console.log(`With Kaspi URL: ${withKaspiUrl.length}`);
  console.log(`Without URL: ${emptyUrl.length}`);
  
  if (withKaspiUrl.length > 0) {
    console.log('\n=== Sample Kaspi URLs ===');
    withKaspiUrl.slice(0, 3).forEach((r, i) => {
      console.log(`\n${i+1}. ${r.title || r.name}`);
      console.log(`   ${r.url}`);
    });
  }
  
  process.exit(0);
}).catch(e => {
  console.error('Error:', e.message);
  if (e.response) {
    console.error('Status:', e.response.status);
    console.error('Data:', e.response.data);
  }
  process.exit(1);
});
