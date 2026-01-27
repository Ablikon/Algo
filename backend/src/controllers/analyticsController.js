const Product = require('../models/Product');
const Price = require('../models/Price');
const Aggregator = require('../models/Aggregator');

exports.getDashboardStats = async (req, res) => {
    try {
        // Get prices with price values (for competitor analysis)
        const priceMatch = { is_available: true, price: { $ne: null } };

        const records = await Price.aggregate([
            { $match: priceMatch },
            {
                $lookup: {
                    from: 'aggregators',
                    localField: 'aggregator',
                    foreignField: '_id',
                    as: 'agg'
                }
            },
            { $unwind: '$agg' }
        ]);

        const productMap = {};
        const aggregatorWins = {};
        const aggregatorTotals = {};

        records.forEach(r => {
            const pid = r.product.toString();
            if (!productMap[pid]) productMap[pid] = [];
            productMap[pid].push({ name: r.agg.name, price: r.price, is_our: r.agg.is_our_company });
            aggregatorTotals[r.agg.name] = (aggregatorTotals[r.agg.name] || 0) + 1;
        });

        const products = Object.values(productMap);
        
        // Calculate overlaps - products that have prices from multiple aggregators
        const aggregatorOverlaps = {};

        products.forEach(prices => {
            const minPrice = Math.min(...prices.map(p => p.price));
            prices.forEach(p => {
                if (p.price === minPrice) {
                    aggregatorWins[p.name] = (aggregatorWins[p.name] || 0) + 1;
                }
            });
            
            // Count overlaps - for each aggregator, count products where we also have that product
            if (prices.length > 1) {
                prices.forEach(p => {
                    aggregatorOverlaps[p.name] = (aggregatorOverlaps[p.name] || 0) + 1;
                });
            }
        });

        const totalProductCount = await Product.countDocuments();

        // Find market leader
        let leaderName = 'N/A';
        let maxWins = 0;
        Object.entries(aggregatorWins).forEach(([name, wins]) => {
            if (wins > maxWins) {
                maxWins = wins;
                leaderName = name;
            }
        });

        const allAggregators = await Aggregator.find().sort('name');
        const aggregatorStats = {};
        
        for (const agg of allAggregators) {
            let count = aggregatorTotals[agg.name] || 0;
            
            // For our company (Рядом), count all products regardless of price
            if (agg.is_our_company) {
                count = await Price.countDocuments({ aggregator: agg._id });
            }
            
            // overlap_count = products where this aggregator competes with others
            const overlapCount = aggregatorOverlaps[agg.name] || 0;
            
            aggregatorStats[agg.name] = {
                count,
                percent: products.length > 0 ? Math.round((count / products.length) * 100) : 0,
                best_price_count: aggregatorWins[agg.name] || 0,
                overlap_count: overlapCount
            };
        }

        res.json({
            total_products: totalProductCount,
            total_mapped: products.length,
            products_at_top: maxWins,
            products_need_action: products.length - maxWins,
            missing_products: totalProductCount - products.length,
            market_leader: leaderName,
            aggregator_stats: aggregatorStats
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

exports.getGaps = async (req, res) => {
    try {
        const limit = parseInt(req.query.page_size) || 5;
        
        // Get products that appear in multiple aggregators (popular products)
        const productPrices = await Price.aggregate([
            { $match: { is_available: true, price: { $ne: null } } },
            {
                $group: {
                    _id: '$product',
                    aggregators: { $addToSet: '$aggregator' },
                    prices: { $push: { aggregator: '$aggregator', price: '$price' } },
                    min_price: { $min: '$price' }
                }
            },
            { $match: { 'aggregators.1': { $exists: true } } }, // At least 2 aggregators
            { $sort: { 'aggregators': -1 } },
            { $limit: limit }
        ]);

        // Get product details
        const productIds = productPrices.map(p => p._id);
        const products = await Product.find({ _id: { $in: productIds } }).lean();
        const productMap = {};
        products.forEach(p => { productMap[p._id.toString()] = p; });

        const results = productPrices.map(pp => {
            const product = productMap[pp._id.toString()];
            return {
                product_name: product?.name || 'Unknown',
                category: product?.category || null,
                competitor_count: pp.aggregators.length,
                min_competitor_price: pp.min_price
            };
        });

        res.json({ results, total: results.length });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// Get aggregator overlap stats for analytics page
exports.getAggregatorOverlap = async (req, res) => {
    try {
        const aggregators = await Aggregator.find().sort('name');
        
        const result = await Promise.all(aggregators.map(async (agg) => {
            const productCount = await Price.distinct('product', { aggregator: agg._id });
            return {
                id: agg._id.toString(),
                name: agg.name,
                color: agg.color,
                is_our_company: agg.is_our_company,
                product_count: productCount.length
            };
        }));

        res.json({ aggregators: result });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};
