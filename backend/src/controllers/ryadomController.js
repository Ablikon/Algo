const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const Product = require('../models/Product');
const Price = require('../models/Price');
const Aggregator = require('../models/Aggregator');
const Category = require('../models/Category');

// Support both dev and Docker paths
const BQ_FILE_NAME = 'bq-results-20260120-103930-1768905602731.csv';
const BQ_FILE_PATH = process.env.NODE_ENV === 'production'
    ? path.join('/app/Data', BQ_FILE_NAME)
    : path.join(__dirname, '../../../Data', BQ_FILE_NAME);

// Load bq-results into database for "Рядом"
exports.loadBqResults = async (req, res) => {
    try {
        // Ensure "Рядом" aggregator exists
        let ryadom = await Aggregator.findOne({ name: 'Рядом' });
        if (!ryadom) {
            ryadom = await Aggregator.create({
                name: 'Рядом',
                is_our_company: true,
                color: '#10b981'
            });
            console.log('Created Рядом aggregator');
        }

        // Check if file exists
        if (!fs.existsSync(BQ_FILE_PATH)) {
            return res.status(404).json({
                error: 'bq-results file not found',
                path: BQ_FILE_PATH
            });
        }

        // Parse CSV and load products
        const products = [];
        
        await new Promise((resolve, reject) => {
            fs.createReadStream(BQ_FILE_PATH)
                .pipe(csv())
                .on('data', (row) => {
                    if (row.name) {
                        products.push({
                            name: row.name,
                            name_origin: row.name_origin,
                            brand: row.brand_name || null,
                            category_1: row.category_1 || null,
                            category_2: row.category_2 || null,
                            category_3: row.category_3 || null,
                            ntin: row.ntin || null,
                            weight: parseFloat(row.weight) || null,
                            slug: row.slug || null
                        });
                    }
                })
                .on('end', resolve)
                .on('error', reject);
        });

        console.log(`Parsed ${products.length} products from bq-results`);

        // Create category cache
        const categoryCache = new Map();

        // Pre-create all categories first
        const allCatNames = [...new Set(products.map(p => p.category_3 || p.category_2 || p.category_1).filter(Boolean))];
        console.log(`Pre-creating ${allCatNames.length} categories...`);
        
        // Fetch existing categories
        const existingCats = await Category.find({ name: { $in: allCatNames } });
        for (const cat of existingCats) {
            categoryCache.set(cat.name, cat._id);
        }
        
        // Create missing categories
        const missingCatNames = allCatNames.filter(name => !categoryCache.has(name));
        if (missingCatNames.length > 0) {
            const catOps = missingCatNames.map(name => ({
                insertOne: { document: { name } }
            }));
            await Category.bulkWrite(catOps, { ordered: false }).catch(() => {});
            
            // Fetch again
            const newCats = await Category.find({ name: { $in: missingCatNames } });
            for (const cat of newCats) {
                categoryCache.set(cat.name, cat._id);
            }
        }
        console.log(`Categories ready: ${categoryCache.size}`);

        // Process in batches
        const BATCH_SIZE = 1000;
        let created = 0;
        let updated = 0;
        let pricesCreated = 0;

        for (let i = 0; i < products.length; i += BATCH_SIZE) {
            const batch = products.slice(i, i + BATCH_SIZE);
            const productOps = [];

            for (const item of batch) {
                const catName = item.category_3 || item.category_2 || item.category_1;
                const categoryId = catName ? categoryCache.get(catName) : null;
                const groupingId = item.slug || item.ntin || null;

                productOps.push({
                    updateOne: {
                        filter: { name: item.name },
                        update: {
                            $set: {
                                name: item.name,
                                brand: item.brand,
                                category: categoryId,
                                sku: item.ntin,
                                weight_value: item.weight,
                                weight_unit: item.weight ? 'g' : null
                            },
                            $setOnInsert: {
                                grouping_id: groupingId
                            }
                        },
                        upsert: true
                    }
                });
            }

            // Execute product upserts
            if (productOps.length > 0) {
                const result = await Product.bulkWrite(productOps, { ordered: false });
                created += result.upsertedCount || 0;
                updated += result.modifiedCount || 0;
            }

            // Fetch products and create prices
            const productNames = batch.map(p => p.name);
            const dbProducts = await Product.find({ name: { $in: productNames } }).select('_id name');
            
            const priceOps = dbProducts.map(p => ({
                updateOne: {
                    filter: { product: p._id, aggregator: ryadom._id, city: null },
                    update: {
                        $set: {
                            product: p._id,
                            aggregator: ryadom._id,
                            price: null,
                            city: null,
                            last_updated: new Date()
                        }
                    },
                    upsert: true
                }
            }));

            if (priceOps.length > 0) {
                const priceResult = await Price.bulkWrite(priceOps, { ordered: false });
                pricesCreated += priceResult.upsertedCount || 0;
            }

            console.log(`Processed ${Math.min(i + BATCH_SIZE, products.length)}/${products.length} products`);
        }

        // Update aggregator product count
        const ryadomProductCount = await Price.countDocuments({ aggregator: ryadom._id });
        await Aggregator.updateOne({ _id: ryadom._id }, { $set: { product_count: ryadomProductCount } });

        res.json({
            success: true,
            message: 'bq-results loaded successfully',
            stats: {
                total_rows: products.length,
                products_created: created,
                products_updated: updated,
                prices_created: pricesCreated,
                aggregator: 'Рядом',
                aggregator_product_count: ryadomProductCount
            }
        });

    } catch (err) {
        console.error('Error loading bq-results:', err);
        res.status(500).json({ error: err.message });
    }
};

// Get Ryadom products for verification
exports.getRyadomProducts = async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 100;
        const page = parseInt(req.query.page) || 1;
        const skip = (page - 1) * limit;

        const ryadom = await Aggregator.findOne({ name: 'Рядом' });
        if (!ryadom) {
            return res.json({ products: [], total: 0 });
        }

        // Get products that have prices for Рядом
        const prices = await Price.find({ aggregator: ryadom._id })
            .populate('product')
            .skip(skip)
            .limit(limit);

        const total = await Price.countDocuments({ aggregator: ryadom._id });

        const products = prices
            .filter(p => p.product)
            .map(p => ({
                id: p.product._id.toString(),
                name: p.product.name,
                brand: p.product.brand,
                grouping_id: p.product.grouping_id,
                sku: p.product.sku
            }));

        res.json({
            products,
            total,
            page,
            pages: Math.ceil(total / limit)
        });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Link products to Ryadom aggregator by reading bq-results and matching by name
exports.linkProductsToRyadom = async (req, res) => {
    try {
        // Ensure "Рядом" aggregator exists
        let ryadom = await Aggregator.findOne({ name: 'Рядом' });
        if (!ryadom) {
            ryadom = await Aggregator.create({
                name: 'Рядом',
                is_our_company: true,
                color: '#10b981'
            });
        }

        // Check if file exists
        if (!fs.existsSync(BQ_FILE_PATH)) {
            return res.status(404).json({ error: 'bq-results file not found' });
        }

        // Parse CSV to get product names
        const bqProductNames = [];
        await new Promise((resolve, reject) => {
            fs.createReadStream(BQ_FILE_PATH)
                .pipe(csv())
                .on('data', (row) => {
                    if (row.name) {
                        bqProductNames.push(row.name);
                    }
                })
                .on('end', resolve)
                .on('error', reject);
        });

        console.log(`Found ${bqProductNames.length} product names in bq-results`);

        // Find products by name in DB
        const BATCH_SIZE = 1000;
        let linked = 0;
        let notFound = 0;

        for (let i = 0; i < bqProductNames.length; i += BATCH_SIZE) {
            const nameBatch = bqProductNames.slice(i, i + BATCH_SIZE);
            
            // Find products by exact name match
            const products = await Product.find({ name: { $in: nameBatch } }).select('_id name');
            const foundNames = new Set(products.map(p => p.name));
            notFound += nameBatch.filter(n => !foundNames.has(n)).length;

            if (products.length === 0) {
                console.log(`Batch ${i}: No products found`);
                continue;
            }

            // Create prices (city is null since it's an ObjectId reference)
            const priceOps = products.map(p => ({
                updateOne: {
                    filter: { product: p._id, aggregator: ryadom._id, city: null },
                    update: {
                        $setOnInsert: {
                            product: p._id,
                            aggregator: ryadom._id,
                            price: null,
                            city: null,
                            last_updated: new Date()
                        }
                    },
                    upsert: true
                }
            }));

            const result = await Price.bulkWrite(priceOps, { ordered: false });
            linked += result.upsertedCount || 0;
            console.log(`Linked batch ${Math.floor(i/BATCH_SIZE)+1}: ${products.length} products`);
        }

        // Update count
        const ryadomProductCount = await Price.countDocuments({ aggregator: ryadom._id });
        await Aggregator.updateOne({ _id: ryadom._id }, { $set: { product_count: ryadomProductCount } });

        res.json({
            success: true,
            linked,
            not_found_in_db: notFound,
            total_ryadom_products: ryadomProductCount
        });

    } catch (err) {
        console.error('Link error:', err);
        res.status(500).json({ error: err.message });
    }
};

// Get status of bq-results load
exports.getBqStatus = async (req, res) => {
    try {
        const ryadom = await Aggregator.findOne({ name: 'Рядом' });
        const productCount = ryadom ? await Price.countDocuments({ aggregator: ryadom._id }) : 0;

        const fileExists = fs.existsSync(BQ_FILE_PATH);

        res.json({
            file_exists: fileExists,
            file_path: BQ_FILE_PATH,
            aggregator: ryadom ? {
                id: ryadom._id.toString(),
                name: ryadom.name,
                product_count: productCount
            } : null,
            loaded: productCount > 0
        });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
