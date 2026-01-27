const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const Aggregator = require('./models/Aggregator');

dotenv.config({ path: path.join(__dirname, '../.env') });

const setupAggregators = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI, {
            dbName: process.env.MONGO_DB_NAME,
        });
        console.log('Connected to MongoDB for configuration...');

        // 1. Reset all aggregators is_our_company flag
        await Aggregator.updateMany({}, { is_our_company: false });

        // 2. Ensure 'Рядом' is the our company
        const ourAggregatorName = process.env.OUR_COMPANY_AGGREGATOR || 'Рядом';

        let ourAgg = await Aggregator.findOne({ name: ourAggregatorName });
        if (!ourAgg) {
            ourAgg = await Aggregator.create({
                name: ourAggregatorName,
                color: '#E31837',
                is_our_company: true
            });
        } else {
            ourAgg.is_our_company = true;
            await ourAgg.save();
        }

        console.log(`Aggregator '${ourAggregatorName}' set as the primary aggregator (our company).`);
        process.exit(0);
    } catch (error) {
        console.error('Error configuring aggregators:', error);
        process.exit(1);
    }
};

setupAggregators();
