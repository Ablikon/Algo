const Aggregator = require('../models/Aggregator');
const Category = require('../models/Category');
const Product = require('../models/Product');
const Price = require('../models/Price');

exports.getAggregators = async (req, res) => {
    try {
        const aggregators = await Aggregator.find().sort('name');
        
        // Add product counts for each aggregator
        const result = await Promise.all(aggregators.map(async (agg) => {
            const count = await Price.countDocuments({ aggregator: agg._id });
            return {
                ...agg.toObject(),
                id: agg._id.toString(),
                product_count: count
            };
        }));
        
        res.json(result);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// Setup default aggregators
exports.setupAggregators = async (req, res) => {
    try {
        const defaults = [
            { name: 'Рядом', color: '#FF7F00', is_our_company: true },
            { name: 'Glovo', color: '#00A082', is_our_company: false },
            { name: 'Magnum', color: '#E31837', is_our_company: false },
            { name: 'Arbuz.kz', color: '#00C2E8', is_our_company: false },
            { name: 'Airba Fresh', color: '#78B833', is_our_company: false },
            { name: 'Wolt', color: '#00C2E8', is_our_company: false },
            { name: 'Yandex Lavka', color: '#FFCC00', is_our_company: false }
        ];
        
        const created = [];
        for (const agg of defaults) {
            const existing = await Aggregator.findOne({ name: agg.name });
            if (!existing) {
                await Aggregator.create(agg);
                created.push(agg.name);
            }
        }
        
        const all = await Aggregator.find();
        res.json({ 
            created, 
            total: all.length,
            aggregators: all.map(a => ({ name: a.name, is_our_company: a.is_our_company }))
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

exports.getCities = async (req, res) => {
    try {
        // ID should be a 24-char hex string to avoid potential validation issues on some frontends
        res.json([
            { id: '000000000000000000000000', _id: '000000000000000000000000', name: 'Все города', slug: 'all' }
        ]);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

exports.getCategories = async (req, res) => {
    try {
        const categories = await Category.find();
        res.json(categories);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

exports.getCategoryTree = async (req, res) => {
    try {
        // Get all category product counts in ONE query
        const counts = await Product.aggregate([
            { $match: { category: { $ne: null } } },
            { $group: { _id: '$category', count: { $sum: 1 } } }
        ]);
        const countMap = new Map(counts.map(c => [c._id.toString(), c.count]));

        // Get categories
        const categories = await Category.find().lean();
        
        // Build tree structure
        const categoryMap = new Map();
        const roots = [];
        
        categories.forEach(cat => {
            cat.id = cat._id.toString();
            cat.product_count = countMap.get(cat.id) || 0;
            cat.children = [];
            categoryMap.set(cat.id, cat);
        });
        
        categories.forEach(cat => {
            if (cat.parent) {
                const parent = categoryMap.get(cat.parent.toString());
                if (parent) {
                    parent.children.push(cat);
                }
            } else {
                roots.push(cat);
            }
        });

        res.json(roots);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};
