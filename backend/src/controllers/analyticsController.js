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
        const page = parseInt(req.query.page) || 1;
        const pageSize = parseInt(req.query.page_size) || 50;
        const skip = (page - 1) * pageSize;
        
        // Get products that appear in multiple aggregators (popular products)
        // First, get total count
        const countResult = await Price.aggregate([
            { $match: { is_available: true, price: { $ne: null } } },
            {
                $group: {
                    _id: '$product',
                    aggregators: { $addToSet: '$aggregator' }
                }
            },
            { $match: { 'aggregators.1': { $exists: true } } },
            { $count: 'total' }
        ]);
        const total = countResult[0]?.total || 0;

        // Get paginated data
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
            { $match: { 'aggregators.1': { $exists: true } } },
            { $sort: { aggregators: -1 } },
            { $skip: skip },
            { $limit: pageSize }
        ]);

        // Get product details
        const productIds = productPrices.map(p => p._id);
        const products = await Product.find({ _id: { $in: productIds } }).lean();
        const productMap = {};
        products.forEach(p => { productMap[p._id.toString()] = p; });

        // Get product links (URLs) if available
        const ProductLink = require('../models/ProductLink');
        const productLinks = await ProductLink.find({ 
            product: { $in: productIds },
            url: { $ne: null, $exists: true }
        }).lean();
        const linkMap = {};
        productLinks.forEach(link => {
            const key = link.product.toString();
            if (!linkMap[key] && link.url) {
                linkMap[key] = link.url;
            }
        });

        const results = productPrices.map(pp => {
            const product = productMap[pp._id.toString()];
            const productId = pp._id.toString();
            return {
                product_id: productId,
                product_name: product?.name || 'Unknown',
                category: product?.category_name || null,
                aggregator_count: pp.aggregators.length,
                min_competitor_price: pp.min_price,
                suggested_price: Math.round(pp.min_price - 1),
                product_url: linkMap[productId] || null,
                image_url: product?.image_url || null
            };
        });

        // Sort by aggregator_count descending (most popular first)
        results.sort((a, b) => b.aggregator_count - a.aggregator_count);

        res.json({
            results,
            total,
            page,
            page_size: pageSize,
            total_pages: Math.ceil(total / pageSize)
        });
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
