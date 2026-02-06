const data = require('./magnum_full_response.json');
const all = data.data;
const withMatch = all.filter(r => r.match === true);
const withUrl = all.filter(r => r.url && r.url.trim() !== '');

console.log('Total records:', all.length);
console.log('With match=true:', withMatch.length);
console.log('With url field (non-empty):', withUrl.length);
console.log('');

// Check if ALL records with match=true have URLs
const matchedWithoutUrl = withMatch.filter(r => !r.url || r.url.trim() === '');
console.log('Records with match=true BUT no URL:', matchedWithoutUrl.length);

if (matchedWithoutUrl.length > 0) {
  console.log('\nExamples of matched records without URL:');
  matchedWithoutUrl.slice(0, 5).forEach((r, i) => {
    console.log(`\n${i+1}. Title: ${r.title}`);
    console.log(`   url field: ${r.url}`);
    console.log(`   match_confidence: ${r.match_confidence}`);
    console.log(`   Fields: ${Object.keys(r).join(', ')}`);
  });
} else {
  console.log('\n✅ ALL records with match=true have URLs!');
}

// Show statistics
console.log('\n=== Statistics ===');
console.log(`match=true records: ${withMatch.length} (${(withMatch.length/all.length*100).toFixed(1)}%)`);
console.log(`match=false records: ${all.length - withMatch.length} (${((all.length - withMatch.length)/all.length*100).toFixed(1)}%)`);
console.log(`\nRecords with URLs: ${withUrl.length}`);
console.log(`All matched records have URLs: ${matchedWithoutUrl.length === 0 ? 'YES' : 'NO'}`);
