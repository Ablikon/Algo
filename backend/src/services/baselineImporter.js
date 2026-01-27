const fs = require('fs');
const path = require('path');
const csv = require('fast-csv');
const Product = require('../models/Product');
const Aggregator = require('../models/Aggregator');
const Category = require('../models/Category');

class BaselineImporter {
    constructor() {
        this.csvPath = path.join(__dirname, '../../../Data/bq-results-20260120-103930-1768905602731.csv');
        this.ourAggregator = null;
    }

    async init() {
        this.ourAggregator = await Aggregator.findOne({ name: 'Рядом' });
        if (!this.ourAggregator) {
            this.ourAggregator = await Aggregator.create({
                name: 'Рядом',
                color: '#E31837',
                is_our_company: true
            });
        }
    }

    async ensureCategory(c1, c2, c3) {
        if (!c1) return null;

        const getOrCreate = async (name, parentId = null) => {
            try {
                let cat = await Category.findOne({ name, parent: parentId });
                if (!cat) {
                    cat = await Category.create({ name, parent: parentId });
                }
                return cat._id;
            } catch (err) {
                if (err.code === 11000) {
                    const cat = await Category.findOne({ name, parent: parentId });
                    return cat ? cat._id : null;
                }
                throw err;
            }
        };

        const id1 = await getOrCreate(c1);
        const id2 = c2 ? await getOrCreate(c2, id1) : id1;
        const id3 = c3 ? await getOrCreate(c3, id2) : id2;

        return id3;
    }

    async run() {
        await this.init();
        console.log(`Starting baseline import from ${this.csvPath}...`);

        let count = 0;
        const stream = fs.createReadStream(this.csvPath);

        return new Promise((resolve, reject) => {
            csv.parseStream(stream, { headers: true })
                .on('data', async (row) => {
                    stream.pause();
                    try {
                        const name = row.name || row.name_short;
                        if (!name) {
                            stream.resume();
                            return;
                        }

                        const categoryId = await this.ensureCategory(row.category_1, row.category_2, row.category_3);

                        await Product.findOneAndUpdate(
                            { name: name },
                            {
                                category: categoryId,
                                brand: row.brand_name,
                                weight_value: parseFloat(row.weight) || null,
                                weight_unit: 'g',
                                sku: row.ntin || null
                            },
                            { upsert: true, new: true }
                        );

                        count++;
                        if (count % 1000 === 0) console.log(`Baseline Product Progress: ${count}`);
                    } catch (err) {
                        console.error(`Error importing baseline row: ${err.message}`);
                    }
                    stream.resume();
                })
                .on('end', () => {
                    console.log(`Baseline import completed. Total: ${count}`);
                    resolve(count);
                })
                .on('error', (err) => {
                    console.error(`Baseline CSV error: ${err.message}`);
                    reject(err);
                });
        });
    }
}

module.exports = new BaselineImporter();
