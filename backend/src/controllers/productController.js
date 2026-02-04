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
        const categoryIds = req.query['category_ids[]'] || req.query.category_ids || [];
        const categoryIdArray = Array.isArray(categoryIds) ? categoryIds : (categoryIds ? [categoryIds] : []);

        // Get all aggregators first
        const allAggregators = await Aggregator.find().sort('name');
        const aggregatorMap = new Map(allAggregators.map(a => [a._id.toString(), a]));

        // Build product filter based on unified categories
        let productFilter = {};
        
        if (categoryIdArray.length > 0) {
            const CategoryMapping = require('../models/CategoryMapping');
            const Category = require('../models/Category');
            const mongoose = require('mongoose');
            
            // Convert string IDs to ObjectId
            const categoryObjectIds = categoryIdArray.map(id => {
                try { return new mongoose.Types.ObjectId(id); } 
                catch { return null; }
            }).filter(Boolean);
            
            // Get the selected unified categories AND their children
            const selectedCats = await Category.find({ _id: { $in: categoryObjectIds } }).lean();
            const childCats = await Category.find({ parent: { $in: categoryObjectIds } }).lean();
            const allCatIds = [...categoryObjectIds, ...childCats.map(c => c._id)];
            
            // Find all CategoryMappings that point to these unified categories
            const mappings = await CategoryMapping.find({ 
                master_category: { $in: allCatIds } 
            }).lean();
            
            // Get unified category names for keyword matching
            const unifiedCatNames = [...selectedCats, ...childCats].map(c => c.name);
            
            // Collect category names to search for
            const searchNames = new Set(unifiedCatNames);
            
            // Add raw category names from mappings (last segment of path)
            if (mappings.length > 0) {
                mappings.forEach(m => {
                    // Add full raw name
                    searchNames.add(m.raw_category);
                    // Extract last part of path like "Молочные смеси" from "Детские товары > ... > Молочные смеси"
                    const parts = m.raw_category.split('>').map(p => p.trim());
                    parts.forEach(p => {
                        if (p.length > 3) searchNames.add(p);
                    });
                });
            }
            
            // For "Детское питание" type categories, add common child patterns
            const categoryPatterns = [];
            unifiedCatNames.forEach(name => {
                // Add exact match
                categoryPatterns.push(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`);
                
                // If category contains "Детское", also match "Детские X"
                if (name.includes('Детское') || name.includes('Детски')) {
                    categoryPatterns.push(`^Детски[ейе]\\s`);
                    categoryPatterns.push(`детски[ейе]\\s`);
                }
            });
            
            // Add patterns for specific category names from mappings
            searchNames.forEach(name => {
                if (name.length > 5) {
                    categoryPatterns.push(name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
                }
            });
            
            const regexPattern = categoryPatterns.join('|');
            console.log(`Category filter patterns: ${categoryPatterns.slice(0, 5).join(', ')}...`);
            
            // Find categories in DB that match
            const matchingCategories = await Category.find({
                name: { $regex: regexPattern, $options: 'i' }
            }).lean();
            
            const matchingCategoryIds = matchingCategories.map(c => c._id);
            
            // Combine with unified category IDs
            const allMatchingIds = [...new Set([
                ...matchingCategoryIds.map(id => id.toString()),
                ...allCatIds.map(id => id.toString())
            ])].map(id => new mongoose.Types.ObjectId(id));
            
            productFilter = { category: { $in: allMatchingIds } };
            
            console.log(`Category filter: ${categoryIdArray.length} unified -> ${matchingCategories.length} matching categories`);
            console.log(`Matched categories: ${matchingCategories.slice(0, 10).map(c => c.name).join(', ')}`);
            
            if (allMatchingIds.length === 0) {
                // Fallback to direct category match
                productFilter = { category: { $in: categoryObjectIds } };
            }
        }

        // Build price match stage
        const priceMatchStage = { price: { $ne: null } };
        
        // If we have category filter, first get matching product IDs
        let productIdFilter = null;
        if (Object.keys(productFilter).length > 0) {
            const matchingProducts = await Product.find(productFilter).select('_id').lean();
            productIdFilter = matchingProducts.map(p => p._id);
            console.log(`Found ${productIdFilter.length} products matching category filter`);
            
            if (productIdFilter.length === 0) {
                return res.json({
                    count: 0,
                    results: [],
                    meta: { aggregators: allAggregators }
                });
            }
            priceMatchStage.product = { $in: productIdFilter };
        }
        
        // Apply search filter at product level if provided
        if (search) {
            const searchRegex = new RegExp(search, 'i');
            const searchProducts = await Product.find({
                name: searchRegex,
                ...(productIdFilter ? { _id: { $in: productIdFilter } } : {})
            }).select('_id').lean();
            
            if (searchProducts.length === 0) {
                return res.json({
                    count: 0,
                    results: [],
                    meta: { aggregators: allAggregators }
                });
            }
            priceMatchStage.product = { $in: searchProducts.map(p => p._id) };
        }

        // Get products with their price counts, sorted by count descending
        const productAggregation = await Price.aggregate([
            { $match: priceMatchStage },
            { $group: { 
                _id: '$product', 
                priceCount: { $sum: 1 }
            }},
            { $sort: { priceCount: -1 } },
            { $skip: skip },
            { $limit: limit }
        ]);

        // Get total count
        const totalAgg = await Price.aggregate([
            { $match: priceMatchStage },
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

        res.json({
            count: total,
            results: results,
            meta: { aggregators: allAggregators }
        });
    } catch (err) {
        console.error('Comparison error:', err);
        res.status(500).json({ message: err.message });
    }
};
