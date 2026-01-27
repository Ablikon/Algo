const Product = require('../models/Product');
const Price = require('../models/Price');
const Aggregator = require('../models/Aggregator');

exports.getProducts = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.page_size) || 50;
        const skip = (page - 1) * limit;

        const products = await Product.find()
            .populate('category')
            .skip(skip)
            .limit(limit);

        const total = await Product.countDocuments();

        res.json({
            count: total,
            next: total > skip + limit ? `?page=${page + 1}` : null,
            previous: page > 1 ? `?page=${page - 1}` : null,
            results: products.map(p => ({
                ...p.toObject(),
                id: p._id.toString(),
                category: p.category ? p.category.name : null,
                category_id: p.category ? p.category._id : null
            }))
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

exports.getProductComparison = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.page_size) || 50;
        const skip = (page - 1) * limit;
        const search = req.query.search || '';

        // Get all aggregators first
        const allAggregators = await Aggregator.find().sort('name');
        const aggregatorMap = new Map(allAggregators.map(a => [a._id.toString(), a]));

        // Use aggregation to get products sorted by price count
        const matchStage = { price: { $ne: null } };
        
        // Get products with their price counts, sorted by count descending
        const productAggregation = await Price.aggregate([
            { $match: matchStage },
            { $group: { 
                _id: '$product', 
                priceCount: { $sum: 1 }
            }},
            { $sort: { priceCount: -1 } }, // Sort by most aggregators first
            { $skip: skip },
            { $limit: limit }
        ]);

        // Get total count
        const totalAgg = await Price.aggregate([
            { $match: matchStage },
            { $group: { _id: '$product' }},
            { $count: 'total' }
        ]);
        const total = totalAgg[0]?.total || 0;

        if (productAggregation.length === 0) {
            return res.json({
                count: total,
                results: [],
                meta: { aggregators: allAggregators }
            });
        }

        // Get product IDs in order
        const productIds = productAggregation.map(p => p._id);
        const priceCountMap = new Map(productAggregation.map(p => [p._id.toString(), p.priceCount]));

        // Get product details
        const products = await Product.find({ _id: { $in: productIds } })
            .populate('category')
            .lean();

        // Create a map for quick lookup
        const productMap = new Map(products.map(p => [p._id.toString(), p]));

        // Get all prices for these products
        const allPrices = await Price.find({ product: { $in: productIds } }).lean();

        // Group prices by product
        const pricesByProduct = new Map();
        allPrices.forEach(price => {
            const pid = price.product.toString();
            if (!pricesByProduct.has(pid)) {
                pricesByProduct.set(pid, []);
            }
            pricesByProduct.get(pid).push(price);
        });

        // Build results in the same order as aggregation (sorted by price count)
        const results = productAggregation.map(agg => {
            const product = productMap.get(agg._id.toString());
            if (!product) return null;

            const productPrices = pricesByProduct.get(agg._id.toString()) || [];
            const priceMap = {};
            let minPrice = Infinity;
            let minPriceAggregator = null;

            productPrices.forEach(p => {
                const aggInfo = aggregatorMap.get(p.aggregator.toString());
                if (aggInfo) {
                    priceMap[aggInfo.name] = {
                        price: p.price,
                        is_available: p.is_available,
                        last_updated: p.last_updated,
                        is_our_company: aggInfo.is_our_company
                    };

                    if (p.price && p.price < minPrice) {
                        minPrice = p.price;
                        minPriceAggregator = aggInfo.name;
                    }
                }
            });

            return {
                id: product._id.toString(),
                name: product.name,
                category: product.category ? product.category.name : '',
                category_id: product.category ? product.category._id : null,
                brand: product.brand,
                image_url: product.image_url,
                weight_value: product.weight_value,
                weight_unit: product.weight_unit,
                prices: priceMap,
                verdict: minPriceAggregator,
                min_price: minPrice !== Infinity ? minPrice : null,
                aggregator_count: agg.priceCount
            };
        }).filter(Boolean);

        // Apply search filter if needed (post-filter since we already paginated)
        let filteredResults = results;
        if (search) {
            const searchLower = search.toLowerCase();
            filteredResults = results.filter(r => r.name.toLowerCase().includes(searchLower));
        }

        res.json({
            count: total,
            results: filteredResults,
            meta: { aggregators: allAggregators }
        });
    } catch (err) {
        console.error('Comparison error:', err);
        res.status(500).json({ message: err.message });
    }
};
