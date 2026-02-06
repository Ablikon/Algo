const axios = require('axios');

axios.create({
  baseURL: 'http://94.131.88.146:3000',
  headers: { 'Authorization': 'Bearer 7e248c0f2ddbe71f1d2339c731d0c5d5954e647a2c000e96d696c3f78acfb2d5' }
}).get('/api/reverse-mapping/magnum_almaty').then(res => {
  const records = res.data.data || [];
  
  console.log('Total Magnum records:', records.length);
  console.log('\n=== First 5 records ===\n');
  
  records.slice(0, 5).forEach((r, i) => {
    console.log(`${i+1}. Title: ${r.title}`);
    console.log(`   match: ${r.match}`);
    console.log(`   url: "${r.url}"`);
    console.log(`   url type: ${typeof r.url}`);
    console.log(`   matched_uuid: ${r.matched_uuid || 'NO UUID'}`);
    console.log('');
  });
  
  // Check for kaspi.kz URLs
  const withKaspiUrl = records.filter(r => r.url && r.url.includes('kaspi.kz'));
  console.log(`\nRecords with kaspi.kz URL: ${withKaspiUrl.length}`);
  
  if (withKaspiUrl.length > 0) {
    console.log('\n=== Kaspi URL examples ===');
    withKaspiUrl.slice(0, 3).forEach((r, i) => {
      console.log(`\n${i+1}. ${r.title}`);
      console.log(`   ${r.url}`);
    });
  }
  
  // Check empty URLs
  const emptyUrl = records.filter(r => !r.url || r.url.trim() === '');
  console.log(`\nRecords without URL: ${emptyUrl.length}`);
  
  process.exit(0);
}).catch(e => {
  console.error('Error:', e.message);
  process.exit(1);
});
