require('dotenv').config();
const mongoose = require('mongoose');

async function main() {
  await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB_NAME });
  
  const Price = require('./src/models/Price');
  const Aggregator = require('./src/models/Aggregator');
  const City = require('./src/models/City');
  
  const wolt = await Aggregator.findOne({ name: 'Wolt' });
  const airba = await Aggregator.findOne({ name: 'Airba Fresh' });
  const almaty = await City.findOne({ slug: 'almaty' });
  const astana = await City.findOne({ slug: 'astana' });
  
  console.log('=== WOLT ALMATY ===');
  const woltAlmaty = await Price.find({ aggregator: wolt._id, city: almaty._id, product_url: { $regex: 'wolt.com' } }).select('product_url').limit(5).lean();
  woltAlmaty.forEach(p => console.log(p.product_url));
  
  console.log('\n=== WOLT ASTANA ===');
  const woltAstana = await Price.find({ aggregator: wolt._id, city: astana._id, product_url: { $regex: 'wolt.com' } }).select('product_url').limit(5).lean();
  woltAstana.forEach(p => console.log(p.product_url));
  
  console.log('\n=== AIRBA ALMATY ===');
  const airbaAlmaty = await Price.find({ aggregator: airba._id, city: almaty._id, product_url: { $regex: 'wolt.com' } }).select('product_url').limit(5).lean();
  airbaAlmaty.forEach(p => console.log(p.product_url));
  
  console.log('\n=== AIRBA ASTANA ===');
  const airbaAstana = await Price.find({ aggregator: airba._id, city: astana._id, product_url: { $regex: 'wolt.com' } }).select('product_url').limit(5).lean();
  airbaAstana.forEach(p => console.log(p.product_url));

  // Check total counts
  const woltAlmatyCount = await Price.countDocuments({ aggregator: wolt._id, city: almaty._id });
  const woltAstanaCount = await Price.countDocuments({ aggregator: wolt._id, city: astana._id });
  console.log('\n=== COUNTS ===');
  console.log('Wolt Almaty prices:', woltAlmatyCount);
  console.log('Wolt Astana prices:', woltAstanaCount);

  // Try to fetch one Wolt URL and see what happens
  const testUrl = woltAlmaty[0]?.product_url;
  if (testUrl) {
    console.log('\n=== HTTP TEST ===');
    console.log('Testing:', testUrl);
    try {
      const resp = await fetch(testUrl, { redirect: 'manual' });
      console.log('Status:', resp.status);
      console.log('Location:', resp.headers.get('location'));
    } catch (e) {
      console.log('Error:', e.message);
    }
  }

  await mongoose.disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
