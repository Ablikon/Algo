require('dotenv').config();
const mongoose = require('mongoose');

async function main() {
  await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB_NAME });
  
  const Price = require('./src/models/Price');
  const Aggregator = require('./src/models/Aggregator');
  const City = require('./src/models/City');
  
  const wolt = await Aggregator.findOne({ name: 'Wolt' });
  const airba = await Aggregator.findOne({ name: 'Airba Fresh' });
  
  // Sample Wolt URLs
  const woltPrices = await Price.find({ 
    aggregator: wolt._id, 
    product_url: { $ne: null, $regex: 'wolt.com' } 
  }).select('product_url city').limit(200).lean();
  
  const woltVenues = {};
  woltPrices.forEach(p => {
    const match = p.product_url.match(/venue\/([^\/]+)\//);
    if (match) {
      woltVenues[match[1]] = (woltVenues[match[1]] || 0) + 1;
    }
  });
  console.log('=== Wolt venues in URLs ===');
  Object.entries(woltVenues).sort((a,b) => b[1]-a[1]).forEach(([v, c]) => console.log(`  ${v}: ${c}`));
  
  // Sample Airba URLs
  const airbaPrices = await Price.find({ 
    aggregator: airba._id, 
    product_url: { $ne: null, $regex: 'wolt.com' } 
  }).select('product_url city').limit(200).lean();
  
  const airbaVenues = {};
  airbaPrices.forEach(p => {
    const match = p.product_url.match(/venue\/([^\/]+)\//);
    if (match) {
      airbaVenues[match[1]] = (airbaVenues[match[1]] || 0) + 1;
    }
  });
  console.log('\n=== Airba venues in URLs ===');
  Object.entries(airbaVenues).sort((a,b) => b[1]-a[1]).forEach(([v, c]) => console.log(`  ${v}: ${c}`));

  // Show city breakdown for Wolt
  console.log('\n=== Wolt URLs by city ===');
  const almaty = await City.findOne({ slug: 'almaty' });
  const astana = await City.findOne({ slug: 'astana' });
  
  if (almaty) {
    const sample = await Price.find({ aggregator: wolt._id, city: almaty._id, product_url: { $regex: 'wolt.com' } }).select('product_url').limit(3).lean();
    console.log('Almaty:');
    sample.forEach(p => console.log('  ', p.product_url));
  }
  if (astana) {
    const sample = await Price.find({ aggregator: wolt._id, city: astana._id, product_url: { $regex: 'wolt.com' } }).select('product_url').limit(3).lean();
    console.log('Astana:');
    sample.forEach(p => console.log('  ', p.product_url));
  }

  // Check the raw API data for a sample URL
  console.log('\n=== Raw API sample (wolt_market_almaty) ===');
  const axios = require('axios');
  const resp = await axios.get('http://94.131.88.146:3000/api/csv-data/wolt_market_almaty_mapped', {
    headers: { Authorization: 'Bearer 7e248c0f2ddbe71f1d2339c731d0c5d5954e647a2c000e96d696c3f78acfb2d5' }
  });
  const records = resp.data.data || [];
  console.log('Sample Wolt URLs from API:');
  records.slice(0, 5).forEach(r => console.log('  ', r.url));

  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
