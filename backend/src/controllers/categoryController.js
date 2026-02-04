const axios = require('axios');
const Category = require('../models/Category');
const CategoryMapping = require('../models/CategoryMapping');
const Aggregator = require('../models/Aggregator');
const categoryMatcher = require('../services/categoryMatcher');

// External API config
const externalApi = axios.create({
    baseURL: process.env.EXTERNAL_API_BASE,
    headers: { 'Authorization': `Bearer ${process.env.EXTERNAL_API_TOKEN}` },
    timeout: 60000
});

/**
 * Process categories from external API using GPT
 * POST /api/categories/process
 */
exports.processCategories = async (req, res) => {
    try {
        const { limit = 10, file_id } = req.body;
        
        console.log(`\n🚀 Starting category processing (limit: ${limit})...`);
        
        // Get available files from API
        const filesRes = await externalApi.get('/api/reverse-files');
        const files = filesRes.data.files || filesRes.data || [];
        
        if (files.length === 0) {
            return res.status(400).json({ error: 'No files available from API' });
        }

        const results = [];
        const filesToProcess = file_id 
            ? files.filter(f => f.id === file_id || f.id === file_id.replace('_mapped', ''))
            : files;

        for (const file of filesToProcess) {
            try {
                console.log(`\n📁 Processing file: ${file.id}`);
                
                // Fetch data for this file
                const dataRes = await externalApi.get(`/api/reverse-mapping/${file.id}`);
                const records = dataRes.data.data || dataRes.data || [];
                
                if (records.length === 0) {
                    console.log(`  ⚠️ No records found`);
                    continue;
                }

                // Extract aggregator name from first record
                const aggregatorName = records[0]?.market_name;
                if (!aggregatorName) {
                    console.log(`  ⚠️ No aggregator name found`);
                    continue;
                }

                // Process categories
                const result = await categoryMatcher.processCategories(records, aggregatorName, limit);
                results.push({
                    file: file.id,
                    aggregator: aggregatorName,
                    ...result
                });
            } catch (err) {
                console.log(`  ❌ Error processing ${file.id}: ${err.message}`);
                results.push({
                    file: file.id,
                    error: err.message
                });
            }
        }

        res.json({
            success: true,
            message: 'Category processing complete',
            results
        });
    } catch (err) {
        console.error('Category processing error:', err);
        res.status(500).json({ error: err.message });
    }
};

/**
 * Get category tree with unified categories
 * GET /api/categories/unified
 */
exports.getUnifiedCategories = async (req, res) => {
    try {
        // Get all parent categories with their children
        const categories = await Category.find({ parent: null })
            .populate({
                path: 'children',
                options: { sort: { name: 1 } }
            })
            .sort({ name: 1 })
            .lean();

        // Get mapping stats
        const mappingStats = await CategoryMapping.aggregate([
            {
                $group: {
                    _id: '$master_category',
                    count: { $sum: 1 },
                    aggregators: { $addToSet: '$aggregator' }
                }
            }
        ]);

        const statsMap = {};
        mappingStats.forEach(s => {
            if (s._id) {
                statsMap[s._id.toString()] = {
                    mapped_count: s.count,
                    aggregator_count: s.aggregators.length
                };
            }
        });

        // Add stats to categories
        const enriched = categories.map(cat => ({
            ...cat,
            stats: statsMap[cat._id.toString()] || { mapped_count: 0, aggregator_count: 0 },
            children: (cat.children || []).map(child => ({
                ...child,
                stats: statsMap[child._id.toString()] || { mapped_count: 0, aggregator_count: 0 }
            }))
        }));

        res.json(enriched);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

/**
 * Get category mappings
 * GET /api/categories/mappings
 */
exports.getCategoryMappings = async (req, res) => {
    try {
        const { aggregator_id, category_id } = req.query;
        
        const filter = {};
        if (aggregator_id) filter.aggregator = aggregator_id;
        if (category_id) filter.master_category = category_id;

        const mappings = await CategoryMapping.find(filter)
            .populate('aggregator', 'name')
            .populate('master_category', 'name')
            .sort({ raw_category: 1 })
            .lean();

        res.json(mappings);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

/**
 * Update category mapping manually
 * PUT /api/categories/mappings/:id
 */
exports.updateMapping = async (req, res) => {
    try {
        const { id } = req.params;
        const { master_category_id, is_verified } = req.body;

        const update = {};
        if (master_category_id !== undefined) update.master_category = master_category_id;
        if (is_verified !== undefined) update.is_verified = is_verified;

        const mapping = await CategoryMapping.findByIdAndUpdate(
            id,
            { $set: update },
            { new: true }
        ).populate('master_category', 'name');

        res.json(mapping);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

/**
 * Get processing status
 * GET /api/categories/status
 */
exports.getStatus = async (req, res) => {
    try {
        const [categoryCount, mappingCount, unverifiedCount, aggregatorMappings] = await Promise.all([
            Category.countDocuments(),
            CategoryMapping.countDocuments(),
            CategoryMapping.countDocuments({ is_verified: false }),
            CategoryMapping.aggregate([
                {
                    $group: {
                        _id: '$aggregator',
                        count: { $sum: 1 },
                        unmapped: {
                            $sum: { $cond: [{ $eq: ['$master_category', null] }, 1, 0] }
                        },
                        unverified: {
                            $sum: { $cond: [{ $eq: ['$is_verified', false] }, 1, 0] }
                        }
                    }
                },
                {
                    $lookup: {
                        from: 'aggregators',
                        localField: '_id',
                        foreignField: '_id',
                        as: 'agg'
                    }
                },
                { $unwind: '$agg' },
                {
                    $project: {
                        name: '$agg.name',
                        total: '$count',
                        unmapped: 1,
                        unverified: 1,
                        mapped: { $subtract: ['$count', '$unmapped'] }
                    }
                }
            ])
        ]);

        res.json({
            total_categories: categoryCount,
            total_mappings: mappingCount,
            unverified_count: unverifiedCount,
            by_aggregator: aggregatorMappings
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

/**
 * Get unverified mappings for manual review
 * GET /api/categories/unverified
 */
exports.getUnverifiedMappings = async (req, res) => {
    try {
        const { page = 1, page_size = 20 } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(page_size);

        const [mappings, total] = await Promise.all([
            CategoryMapping.find({ is_verified: false })
                .populate('aggregator', 'name')
                .populate('master_category', 'name parent')
                .sort({ confidence: 1, raw_category: 1 })
                .skip(skip)
                .limit(parseInt(page_size))
                .lean(),
            CategoryMapping.countDocuments({ is_verified: false })
        ]);

        // Get parent info for nested categories
        const parentIds = mappings
            .filter(m => m.master_category?.parent)
            .map(m => m.master_category.parent);
        
        const parents = await Category.find({ _id: { $in: parentIds } }).lean();
        const parentMap = {};
        parents.forEach(p => { parentMap[p._id.toString()] = p.name; });

        const enrichedMappings = mappings.map(m => ({
            ...m,
            parent_category_name: m.master_category?.parent 
                ? parentMap[m.master_category.parent.toString()] 
                : null
        }));

        res.json({
            mappings: enrichedMappings,
            total,
            page: parseInt(page),
            page_size: parseInt(page_size),
            total_pages: Math.ceil(total / parseInt(page_size))
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

/**
 * Get all master categories for dropdown
 * GET /api/categories/masters
 */
exports.getMasterCategories = async (req, res) => {
    try {
        // Get parent categories
        const parents = await Category.find({ parent: null }).sort({ name: 1 }).lean();
        
        // Get children for each parent
        const result = [];
        for (const parent of parents) {
            const children = await Category.find({ parent: parent._id }).sort({ name: 1 }).lean();
            result.push({
                ...parent,
                children: children.map(c => ({
                    _id: c._id,
                    name: c.name,
                    full_name: `${parent.name} > ${c.name}`
                }))
            });
        }

        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

/**
 * Verify a mapping (mark as verified)
 * POST /api/categories/mappings/:id/verify
 */
exports.verifyMapping = async (req, res) => {
    try {
        const { id } = req.params;
        const { new_master_id } = req.body;

        const update = { is_verified: true };
        if (new_master_id) {
            update.master_category = new_master_id;
            update.confidence = 100; // Manual verification = 100% confidence
        }

        const mapping = await CategoryMapping.findByIdAndUpdate(
            id,
            { $set: update },
            { new: true }
        )
            .populate('aggregator', 'name')
            .populate('master_category', 'name');

        if (!mapping) {
            return res.status(404).json({ error: 'Mapping not found' });
        }

        res.json(mapping);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
