const axios = require('axios');
const fs = require('fs');

const api = axios.create({
  baseURL: 'http://94.131.88.146:3000',
  headers: { 'Authorization': 'Bearer 7e248c0f2ddbe71f1d2339c731d0c5d5954e647a2c000e96d696c3f78acfb2d5' }
});

console.log('=== Downloading full Magnum data ===\n');

api.get('/api/reverse-mapping/magnum_almaty').then(res => {
  const records = res.data.data || res.data || [];
  
  // Save to file for inspection
  fs.writeFileSync('magnum_full_response.json', JSON.stringify(res.data, null, 2));
  console.log(`Saved full response to magnum_full_response.json`);
  console.log(`Total records: ${records.length}`);
  
  // Detailed statistics
  console.log('\n=== Detailed Analysis ===');
  
  const allFields = records.length > 0 ? Object.keys(records[0]) : [];
  console.log(`\nFields in records: ${allFields.join(', ')}`);
  
  // Check different URL patterns
  const urlStats = {
    total: records.length,
    withUrl: 0,
    withKaspi: 0,
    withMagnum: 0,
    withWolt: 0,
    empty: 0,
    undefined: 0
  };
  
  records.forEach(r => {
    if (r.url === undefined) {
      urlStats.undefined++;
    } else if (!r.url || r.url.trim() === '') {
      urlStats.empty++;
    } else {
      urlStats.withUrl++;
      if (r.url.includes('kaspi.kz')) urlStats.withKaspi++;
      if (r.url.includes('magnum.kz')) urlStats.withMagnum++;
      if (r.url.includes('wolt.com')) urlStats.withWolt++;
    }
  });
  
  console.log('\n=== URL Statistics ===');
  console.log(`Total records: ${urlStats.total}`);
  console.log(`With URL field set: ${urlStats.withUrl}`);
  console.log(`  - Kaspi URLs: ${urlStats.withKaspi}`);
  console.log(`  - Magnum URLs: ${urlStats.withMagnum}`);
  console.log(`  - Wolt URLs: ${urlStats.withWolt}`);
  console.log(`Empty URL: ${urlStats.empty}`);
  console.log(`URL field undefined: ${urlStats.undefined}`);
  
  // Show records WITH URLs
  const withUrls = records.filter(r => r.url && r.url.trim() !== '');
  console.log(`\n=== First 10 records WITH URLs ===`);
  withUrls.slice(0, 10).forEach((r, i) => {
    console.log(`\n${i+1}. ${r.title}`);
    console.log(`   URL: ${r.url.substring(0, 100)}${r.url.length > 100 ? '...' : ''}`);
    console.log(`   UUID: ${r.matched_uuid || 'NO UUID'}`);
  });
  
  process.exit(0);
}).catch(e => {
  console.error('Error:', e.message);
  process.exit(1);
});
