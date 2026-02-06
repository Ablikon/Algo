const mongoose = require('mongoose');

async function run() {
    await mongoose.connect('mongodb+srv://admin:2525123@scoutalgo.tfqg35b.mongodb.net/scoutalgo', {
        socketTimeoutMS: 120000,
        serverSelectionTimeoutMS: 30000
    });
    console.log('Connected to MongoDB');

    const Aggregator = require('./src/models/Aggregator');
    const Price = require('./src/models/Price');
    
    // List all aggregators
    const all = await Aggregator.find({}).lean();
    console.log(`\nTotal aggregators: ${all.length}`);
    
    // Valid aggregator names
    const validNames = ['Magnum', 'Arbuz.kz', 'Airba Fresh', 'Wolt', 'Yandex Lavka', 'Рядом'];
    
    const bogus = all.filter(a => !validNames.includes(a.name));
    const valid = all.filter(a => validNames.includes(a.name));
    
    console.log('\n✅ Valid aggregators:');
    valid.forEach(a => console.log(`   ${a.name} (${a._id})`));
    
    console.log(`\n❌ Bogus aggregators: ${bogus.length}`);
    if (bogus.length > 0) {
        bogus.slice(0, 10).forEach(a => console.log(`   "${a.name}" (${a._id})`));
        if (bogus.length > 10) console.log(`   ... and ${bogus.length - 10} more`);
    }
    
    if (bogus.length > 0) {
        const bogusIds = bogus.map(a => a._id);
        
        // Delete prices referencing bogus aggregators
        const priceResult = await Price.deleteMany({ aggregator: { $in: bogusIds } });
        console.log(`\n🗑️  Deleted ${priceResult.deletedCount} prices from bogus aggregators`);
        
        // Delete bogus aggregators
        const aggResult = await Aggregator.deleteMany({ _id: { $in: bogusIds } });
        console.log(`🗑️  Deleted ${aggResult.deletedCount} bogus aggregators`);
    }
    
    // Show remaining
    const remaining = await Aggregator.find({}).lean();
    console.log(`\n✅ Remaining aggregators: ${remaining.length}`);
    remaining.forEach(a => console.log(`   ${a.name} (${a._id})`));
    
    // Show current price count
    const priceCount = await Price.countDocuments({});
    console.log(`\n📊 Total prices in DB: ${priceCount}`);
    
    await mongoose.disconnect();
}

run().catch(e => { console.error(e); process.exit(1); });
