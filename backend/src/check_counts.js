const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const checkCounts = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI, {
            dbName: process.env.MONGO_DB_NAME,
        });
        const collections = ['products', 'prices', 'categories', 'aggregators', 'cities', 'referenceproducts'];

        for (const col of collections) {
            const count = await mongoose.connection.db.collection(col).countDocuments();
            console.log(`${col}: ${count}`);
        }
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

checkCounts();
