const mongoose = require('mongoose');
require('dotenv').config();

async function main() {
  await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB_NAME || 'scoutalgo' });
  const Category = require('./src/models/Category');
  const Product = require('./src/models/Product');
  
  const total = await Category.countDocuments();
  const withParent = await Category.countDocuments({ parent: { $ne: null } });
  const roots = await Category.countDocuments({ parent: null });
  console.log('Total categories:', total);
  console.log('Root categories (no parent):', roots);
  console.log('Child categories (have parent):', withParent);
  
  // Sample root categories
  const sampleRoots = await Category.find({ parent: null }).sort({ name: 1 }).limit(30).lean();
  console.log('\nSample root categories:');
  sampleRoots.forEach(c => console.log(' -', c.name));
  
  // Sample children
  const sampleChildren = await Category.find({ parent: { $ne: null } }).limit(20).populate('parent', 'name').lean();
  console.log('\nSample child categories:');
  sampleChildren.forEach(c => console.log(' -', c.name, '→ parent:', c.parent?.name));
  
  // Check what categories products actually use
  const catDistribution = await Product.aggregate([
    { $match: { category: { $ne: null } } },
    { $group: { _id: '$category', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 30 },
    { $lookup: { from: 'categories', localField: '_id', foreignField: '_id', as: 'cat' } },
    { $unwind: '$cat' },
    { $project: { name: '$cat.name', parent: '$cat.parent', count: 1 } }
  ]);
  
  console.log('\nTop categories by product count:');
  catDistribution.forEach(c => console.log(` ${c.count.toString().padStart(6)} - ${c.name} ${c.parent ? '(has parent)' : '(root)'}`));
  
  // Products without category
  const noCategory = await Product.countDocuments({ $or: [{ category: null }, { category: { $exists: false } }] });
  const withCategory = await Product.countDocuments({ category: { $ne: null } });
  console.log('\nProducts with category:', withCategory);
  console.log('Products without category:', noCategory);
  
  // Sample a few API records to see what categories look like
  const axios = require('axios');
  const api = axios.create({
    baseURL: process.env.EXTERNAL_API_BASE,
    headers: { 'Authorization': `Bearer ${process.env.EXTERNAL_API_TOKEN}` },
    timeout: 60000
  });
  
  const files = ['airba_fresh_almaty_mapped', 'arbuz_kz_almaty_mapped', 'magnum_almaty_mapped', 'wolt_market_almaty_mapped', 'yandex_lavka_almaty_mapped'];
  
  for (const fileId of files) {
    try {
      const res = await api.get(`/api/csv-data/${fileId}`);
      const records = res.data.data || res.data || [];
      const cats = new Set();
      const catPaths = new Set();
      records.slice(0, 500).forEach(r => {
        if (r.category) cats.add(r.category);
        if (r.category_full_path) catPaths.add(r.category_full_path);
      });
      console.log(`\n=== ${fileId} ===`);
      console.log(`Sample categories (${cats.size} unique from first 500):`);
      [...cats].slice(0, 10).forEach(c => console.log('  cat:', c));
      console.log(`Sample category_full_path (${catPaths.size} unique from first 500):`);
      [...catPaths].slice(0, 10).forEach(c => console.log('  path:', c));
    } catch (e) {
      console.log(`\n=== ${fileId} === ERROR:`, e.message);
    }
  }
  
  await mongoose.disconnect();
}

main().catch(console.error);
