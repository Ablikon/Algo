const mongoose = require('mongoose');
const Product = require('./src/models/Product');
const Price = require('./src/models/Price');
const ProductLink = require('./src/models/ProductLink');

const MONGODB_URI = 'mongodb+srv://admin:2525123@scoutalgo.tfqg35b.mongodb.net/scoutalgo';

function scoreProduct(p) {
  return (p.category ? 1 : 0) + (p.image_url ? 1 : 0) + (p.brand ? 1 : 0) + (p.sku ? 1 : 0);
}

async function mergeGroup(products) {
  let master = products[0];
  for (const p of products) {
    if (scoreProduct(p) > scoreProduct(master)) master = p;
  }

  const dupes = products.filter(p => p._id.toString() !== master._id.toString());
  if (dupes.length === 0) return { merged: 0, pricesMoved: 0, linksMoved: 0, productsDeleted: 0 };

  let pricesMoved = 0;
  let linksMoved = 0;

  for (const dup of dupes) {
    const prices = await Price.find({ product: dup._id }).lean();
    for (const price of prices) {
      const { _id, product, ...priceData } = price;
      await Price.updateOne(
        { product: master._id, aggregator: price.aggregator, city: price.city || null },
        { $setOnInsert: { ...priceData, product: master._id } },
        { upsert: true }
      );
      await Price.deleteOne({ _id: price._id });
      pricesMoved++;
    }

    const links = await ProductLink.find({ product: dup._id }).lean();
    for (const link of links) {
      const { _id, product, ...linkData } = link;
      await ProductLink.updateOne(
        { product: master._id, aggregator: link.aggregator },
        { $setOnInsert: { ...linkData, product: master._id } },
        { upsert: true }
      );
      await ProductLink.deleteOne({ _id: link._id });
      linksMoved++;
    }
  }

  const dupIds = dupes.map(d => d._id);
  const deleteResult = await Product.deleteMany({ _id: { $in: dupIds } });

  return { merged: 1, pricesMoved, linksMoved, productsDeleted: deleteResult.deletedCount || 0 };
}

async function run() {
  await mongoose.connect(MONGODB_URI);
  console.log('✅ Connected to MongoDB');

  const pipeline = [
    { $match: { normalized_name: { $nin: [null, ''] } } },
    { $group: { _id: '$normalized_name', ids: { $push: '$_id' }, count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } }
  ];

  const groups = await Product.aggregate(pipeline).allowDiskUse(true);
  console.log(`Found ${groups.length} duplicate groups by normalized_name`);

  let mergedGroups = 0;
  let pricesMoved = 0;
  let linksMoved = 0;
  let productsDeleted = 0;

  for (let i = 0; i < groups.length; i++) {
    const group = groups[i];
    const products = await Product.find({ _id: { $in: group.ids } })
      .select('_id name normalized_name category image_url brand sku')
      .lean();

    const res = await mergeGroup(products);
    mergedGroups += res.merged;
    pricesMoved += res.pricesMoved;
    linksMoved += res.linksMoved;
    productsDeleted += res.productsDeleted;

    if ((i + 1) % 100 === 0) {
      console.log(`Processed ${i + 1}/${groups.length} groups...`);
    }
  }

  console.log('\n✅ Merge complete');
  console.log(`Groups merged: ${mergedGroups}`);
  console.log(`Prices moved: ${pricesMoved}`);
  console.log(`Links moved: ${linksMoved}`);
  console.log(`Products deleted: ${productsDeleted}`);

  await mongoose.disconnect();
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
