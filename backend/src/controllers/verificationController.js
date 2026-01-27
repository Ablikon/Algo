const axios = require('axios');
const Product = require('../models/Product');
const Price = require('../models/Price');
const Aggregator = require('../models/Aggregator');

// External API client
const externalApi = axios.create({
    baseURL: process.env.EXTERNAL_API_BASE || 'http://94.131.88.146',
    headers: { 'Authorization': `Bearer ${process.env.EXTERNAL_API_TOKEN}` },
    timeout: 60000
});

/**
 * Review mapping from external API file
 * 
 * Logic:
 * 1. Load our products from DB (Рядом aggregator)
 * 2. Load records from external API file
 * 3. For each API record with matched_uuid:
 *    - Find if our DB has a product matching that name/uuid
 *    - Determine verdict based on match quality
 */
exports.reviewMappedFromApi = async (req, res) => {
    try {
        const fileId = req.query.file_id;
        const limit = parseInt(req.query.limit) || 30;

        if (!fileId) {
            return res.status(400).json({ 
                error: 'file_id is required',
                available_files: await getAvailableFiles()
            });
        }

        console.log(`Reviewing mapped file: ${fileId}, limit: ${limit}`);

        // Get Рядом aggregator
        const ryadom = await Aggregator.findOne({ name: 'Рядом' });
        
        // Load our products from DB (Рядом products)
        let ourProducts = [];
        if (ryadom) {
            const ourPrices = await Price.find({ aggregator: ryadom._id })
                .populate('product')
                .limit(50000); // Load up to 50k for matching
            
            ourProducts = ourPrices
                .filter(p => p.product)
                .map(p => ({
                    id: p.product._id.toString(),
                    name: p.product.name,
                    name_lower: p.product.name.toLowerCase(),
                    brand: p.product.brand,
                    grouping_id: p.product.grouping_id,
                    sku: p.product.sku
                }));
        }

        console.log(`Loaded ${ourProducts.length} our products from DB`);

        // Fetch data from external API
        const response = await externalApi.get(`/api/csv-data/${fileId}`);
        const records = response.data.data || [];

        if (records.length === 0) {
            return res.json({
                summary: { total: 0, correct: 0, unmapped: 0, not_found: 0, needs_review: 0, likely_wrong: 0 },
                results: [],
                file_info: { id: fileId, records_count: 0 }
            });
        }

        // Create lookup maps
        const ourProductsByName = new Map();
        const ourProductsBySku = new Map();
        
        for (const p of ourProducts) {
            ourProductsByName.set(p.name_lower, p);
            if (p.sku) {
                ourProductsBySku.set(p.sku, p);
            }
        }

        // Analyze records
        const results = [];
        let correct = 0, unmapped = 0, not_found = 0, needs_review = 0, likely_wrong = 0;

        // Process limited records for review
        const recordsToProcess = records.slice(0, limit);

        for (const record of recordsToProcess) {
            const title = record.title || record.name || '';
            const matchedUuid = record.matched_uuid;
            const price = parseFloat(record.cost || record.price) || null;
            const brand = record.brand || '';
            const category = record.category || record.category_1 || '';

            let verdict = 'not_found';
            let matchedProduct = null;
            let reason = '';

            // Try to find in our products
            const titleLower = title.toLowerCase();
            
            // 1. Try exact name match first
            if (ourProductsByName.has(titleLower)) {
                matchedProduct = ourProductsByName.get(titleLower);
                
                if (matchedUuid) {
                    verdict = 'correct';
                    correct++;
                    reason = 'Точное совпадение по названию, есть UUID';
                } else {
                    verdict = 'unmapped';
                    unmapped++;
                    reason = 'Найден в нашей базе, но нет UUID маппинга в API';
                }
            }
            // 2. Try partial name match
            else {
                let found = false;
                for (const [name, p] of ourProductsByName) {
                    // Check if names are similar (one contains the other)
                    if (name.includes(titleLower.substring(0, 20)) || 
                        titleLower.includes(name.substring(0, 20))) {
                        matchedProduct = p;
                        found = true;
                        break;
                    }
                }

                if (found && matchedProduct) {
                    if (matchedUuid) {
                        verdict = 'needs_review';
                        needs_review++;
                        reason = `Похожее название: "${matchedProduct.name}"`;
                    } else {
                        verdict = 'unmapped';
                        unmapped++;
                        reason = `Похожий товар без маппинга: "${matchedProduct.name}"`;
                    }
                } else {
                    // Not found in our database
                    if (matchedUuid) {
                        verdict = 'not_found';
                        not_found++;
                        reason = 'Товар с UUID не найден в нашей базе';
                    } else {
                        verdict = 'not_found';
                        not_found++;
                        reason = 'Товар отсутствует в нашем ассортименте';
                    }
                }
            }

            results.push({
                source: {
                    title,
                    brand,
                    category,
                    price,
                    matched_uuid: matchedUuid || null,
                    image_url: record.url_picture || record.image_url || null
                },
                matched: matchedProduct ? {
                    id: matchedProduct.id,
                    name: matchedProduct.name,
                    brand: matchedProduct.brand,
                    grouping_id: matchedProduct.grouping_id
                } : null,
                verdict,
                reason
            });
        }

        res.json({
            summary: {
                total: records.length,
                processed: recordsToProcess.length,
                correct,
                unmapped,
                not_found,
                needs_review,
                likely_wrong,
                our_products_loaded: ourProducts.length
            },
            results,
            file_info: {
                id: fileId,
                records_count: records.length,
                filename: response.data.filename
            }
        });

    } catch (err) {
        console.error('Review error:', err.message);
        res.status(500).json({ 
            error: err.message,
            hint: 'Check if external API is accessible and bq-results is loaded'
        });
    }
};

// Legacy endpoint - same as reviewMappedFromApi
exports.getMappingVerification = async (req, res) => {
    // If file_id is provided, use the API review
    if (req.query.file_id) {
        return exports.reviewMappedFromApi(req, res);
    }

    // Otherwise return basic stats
    try {
        const ryadom = await Aggregator.findOne({ name: 'Рядом' });
        const totalProducts = await Product.countDocuments();
        const ryadomProducts = ryadom ? await Price.countDocuments({ aggregator: ryadom._id }) : 0;
        const totalPrices = await Price.countDocuments();

        res.json({
            summary: {
                total: totalProducts,
                correct: ryadomProducts,
                unmapped: totalProducts - ryadomProducts,
                not_found: 0,
                needs_review: 0,
                likely_wrong: 0
            },
            stats: {
                total_products: totalProducts,
                ryadom_products: ryadomProducts,
                total_price_records: totalPrices
            },
            results: []
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

async function getAvailableFiles() {
    try {
        const response = await externalApi.get('/api/csv-files');
        return response.data.files?.map(f => f.id) || [];
    } catch (err) {
        return [];
    }
}
