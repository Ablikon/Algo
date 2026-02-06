const data = require('./magnum_full_response.json');

// Let's check if match=false records have price/cost data
const withoutMatch = data.data.filter(r => r.match === false);

console.log('=== Analyzing match=false records more deeply ===\n');

// Check ALL fields in match=false records
const allFields = new Set();
withoutMatch.forEach(r => {
  Object.keys(r).forEach(k => allFields.add(k));
});

console.log('All unique fields in match=false records:');
console.log(Array.from(allFields).sort().join(', '));
console.log('');

// Check if any have prices
const withPrice = withoutMatch.filter(r => r.price || r.cost);
console.log(`Records with 'price' or 'cost' field: ${withPrice.length}`);

// Check all records structure
console.log('\n=== Full structure of first match=false record ===');
console.log(JSON.stringify(withoutMatch[0], null, 2));

console.log('\n=== Hypothesis ===');
console.log('If match=false records have NO url, title, cost fields,');
console.log('it means these are ONLY Magnum CSV data without Kaspi info.');
console.log('The API did NOT parse these from Kaspi - they are just Magnum catalog items.');
