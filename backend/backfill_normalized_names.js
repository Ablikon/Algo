const mongoose = require('mongoose');
const Product = require('./src/models/Product');

const MONGODB_URI = 'mongodb+srv://admin:2525123@scoutalgo.tfqg35b.mongodb.net/scoutalgo';

const normalizeName = (name) => {
  if (!name) return '';
  return name
    .toLowerCase()
    .replace(/[^\wа-яё\s]/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
};

async function run() {
  await mongoose.connect(MONGODB_URI);
  console.log('✅ Connected to MongoDB');

  const cursor = Product.find({ normalized_name: { $in: [null, ''] } })
    .select('_id name normalized_name')
    .cursor();

  let count = 0;
  let updated = 0;
  const ops = [];

  for await (const doc of cursor) {
    count++;
    const normalized = normalizeName(doc.name);
    if (!normalized) continue;
    ops.push({
      updateOne: {
        filter: { _id: doc._id },
        update: { $set: { normalized_name: normalized } }
      }
    });

    if (ops.length >= 1000) {
      const res = await Product.bulkWrite(ops, { ordered: false });
      updated += res.modifiedCount || 0;
      ops.length = 0;
      console.log(`Updated ${updated} products...`);
    }
  }

  if (ops.length > 0) {
    const res = await Product.bulkWrite(ops, { ordered: false });
    updated += res.modifiedCount || 0;
  }

  console.log(`\nTotal scanned: ${count}`);
  console.log(`Total updated: ${updated}`);

  await mongoose.disconnect();
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
