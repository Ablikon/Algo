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
        const onlyWithPrices = req.query.only_with_prices === 'true';
        const CategoryMapping = require('../models/CategoryMapping');
        
        // Get categories that have products WITH PRICES
        const categoriesWithPrices = await Price.aggregate([
            { $match: { price: { $ne: null } } },
            { $lookup: {
                from: 'products',
                localField: 'product',
                foreignField: '_id',
                as: 'product'
            }},
            { $unwind: '$product' },
            { $match: { 'product.category': { $ne: null } } },
            { $group: { 
                _id: '$product.category', 
                productCount: { $addToSet: '$product._id' }
            }},
            { $project: {
                _id: 1,
                productCount: { $size: '$productCount' }
            }}
        ]);
        
        // Map: raw category ID -> product count
        const rawCatProductCount = new Map(categoriesWithPrices.map(c => [
            c._id.toString(), 
            c.productCount
        ]));
        
        // Get all raw categories that have products with prices
        const rawCatIds = categoriesWithPrices.map(c => c._id);
        const rawCategories = await Category.find({ _id: { $in: rawCatIds } }).lean();
        
        // Get mappings for these raw categories to find their unified parents
        const rawCatNames = rawCategories.map(c => c.name);
        const mappings = await CategoryMapping.find({
            raw_category: { $in: rawCatNames }
        }).populate('master_category').lean();
        
        // Build unified category tree with product counts
        const unifiedCatMap = new Map(); // unified cat ID -> { name, parent, productCount, children }
        
        // First, add raw categories that have prices (as potential leaves)
        rawCategories.forEach(rawCat => {
            const count = rawCatProductCount.get(rawCat._id.toString()) || 0;
            if (count > 0) {
                unifiedCatMap.set(rawCat._id.toString(), {
                    _id: rawCat._id,
                    id: rawCat._id.toString(),
                    name: rawCat.name,
                    parent: rawCat.parent,
                    product_count: count,
                    children: [],
                    is_raw: true
                });
            }
        });
        
        // Now process mappings to find unified parents
        for (const mapping of mappings) {
            if (!mapping.master_category) continue;
            
            const masterId = mapping.master_category._id.toString();
            const masterName = mapping.master_category.name;
            const masterParent = mapping.master_category.parent;
            
            // Find raw category with products for this mapping
            const rawCat = rawCategories.find(c => c.name === mapping.raw_category);
            if (!rawCat) continue;
            
            const rawCount = rawCatProductCount.get(rawCat._id.toString()) || 0;
            if (rawCount === 0) continue;
            
            // Add or update unified category
            if (!unifiedCatMap.has(masterId)) {
                unifiedCatMap.set(masterId, {
                    _id: mapping.master_category._id,
                    id: masterId,
                    name: masterName,
                    parent: masterParent,
                    product_count: 0,
                    children: [],
                    is_unified: true
                });
            }
            
            // Add product count to unified category
            const unified = unifiedCatMap.get(masterId);
            unified.product_count += rawCount;
        }
        
        // Build tree - recursively get ALL parent categories up to root
        const allParentIds = new Set();
        const getParents = async (parentId) => {
            if (!parentId || allParentIds.has(parentId.toString())) return;
            allParentIds.add(parentId.toString());
            const parent = await Category.findById(parentId).lean();
            if (parent && parent.parent) {
                await getParents(parent.parent);
            }
        };
        
        for (const cat of unifiedCatMap.values()) {
            if (cat.parent) {
                await getParents(cat.parent);
            }
        }
        
        // Fetch all parent categories
        const parentCategories = await Category.find({ 
            _id: { $in: Array.from(allParentIds) } 
        }).lean();
        
        // Add parent categories to map
        parentCategories.forEach(parent => {
            const parentId = parent._id.toString();
            if (!unifiedCatMap.has(parentId)) {
                unifiedCatMap.set(parentId, {
                    _id: parent._id,
                    id: parentId,
                    name: parent.name,
                    parent: parent.parent,
                    product_count: 0,
                    children: [],
                    is_unified: true
                });
            }
        });
        
        // Build tree structure - handle multi-level hierarchy
        const roots = [];
        const processed = new Set();
        
        // First pass: link children to parents
        unifiedCatMap.forEach(cat => {
            if (cat.parent) {
                const parentId = cat.parent.toString();
                const parent = unifiedCatMap.get(parentId);
                if (parent && !parent.children.find(c => c.id === cat.id)) {
                    parent.children.push(cat);
                }
            }
        });
        
        // Second pass: propagate product counts up the tree
        const propagateCounts = (cat) => {
            if (processed.has(cat.id)) return cat.product_count;
            processed.add(cat.id);
            
            let totalCount = cat.product_count || 0;
            for (const child of cat.children) {
                totalCount += propagateCounts(child);
            }
            cat.product_count = totalCount;
            return totalCount;
        };
        
        // Find roots and propagate
        unifiedCatMap.forEach(cat => {
            if (!cat.parent) {
                roots.push(cat);
            }
        });
        
        roots.forEach(root => propagateCounts(root));
        
        // Recursive filter and sort
        const filterAndSort = (cats) => {
            return cats
                .filter(cat => cat.product_count > 0)
                .map(cat => ({
                    ...cat,
                    children: filterAndSort(cat.children || [])
                }))
                .sort((a, b) => (b.product_count || 0) - (a.product_count || 0));
        };
        
        const result = filterAndSort(roots);

        res.json(result);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};
