const data = require('./magnum_full_response.json');
const all = data.data;

// Get records with match=false
const withoutMatch = all.filter(r => r.match === false);

console.log('=== Records with match=false ===');
console.log(`Total: ${withoutMatch.length}`);
console.log('');

// Show first 5
console.log('First 5 records with match=false:');
withoutMatch.slice(0, 5).forEach((r, i) => {
  console.log(`\n${i+1}.`);
  console.log(`   csv_name: ${r.csv_name}`);
  console.log(`   csv_brand: ${r.csv_brand}`);
  console.log(`   csv_weight: ${r.csv_weight}`);
  console.log(`   Fields: ${Object.keys(r).join(', ')}`);
  console.log(`   Has 'title'?: ${r.title !== undefined}`);
  console.log(`   Has 'url'?: ${r.url !== undefined}`);
  console.log(`   Has 'cost'?: ${r.cost !== undefined}`);
});

console.log('\n\n=== Question: Are these CSV products without Kaspi matching? ===');
console.log('It looks like match=false means "not matched to Kaspi product"');
console.log('These are pure Magnum CSV data without Kaspi URL.');
console.log('');
console.log('So the API returns:');
console.log('- match=true: Magnum product matched to Kaspi (has URL)');
console.log('- match=false: Magnum product not found on Kaspi (no URL)');
