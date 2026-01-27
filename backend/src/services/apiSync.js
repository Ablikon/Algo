const axios = require('axios');
const Aggregator = require('../models/Aggregator');
const Product = require('../models/Product');
const Price = require('../models/Price');
const Category = require('../models/Category');
const ImportJob = require('../models/ImportJob');

// Mapping of mercant_name / file patterns to proper aggregator names
const AGGREGATOR_MAPPING = {
    'mag-ala': 'Magnum',
    'mag-ast': 'Magnum',
    'magnum': 'Magnum',
    'air-ala': 'Airba Fresh',
    'air-ast': 'Airba Fresh',
    'airba': 'Airba Fresh',
    'airba_fresh': 'Airba Fresh',
    'arb-ala': 'Arbuz.kz',
    'arb-ast': 'Arbuz.kz',
    'arbuz': 'Arbuz.kz',
    'arbuz_kz': 'Arbuz.kz',
    'wolt': 'Wolt',
    'wolt_market': 'Wolt',
    'wolt_wolt': 'Wolt',
    'yandex': 'Yandex Lavka',
    'yandex_lavka': 'Yandex Lavka',
    'glovo': 'Glovo',
    'ryadom': 'Рядом'
};

// Aggregator colors
const AGGREGATOR_COLORS = {
    'Magnum': '#E31837',
    'Airba Fresh': '#78B833',
    'Arbuz.kz': '#00C2E8',
    'Wolt': '#00C2E8',
    'Yandex Lavka': '#FFCC00',
    'Glovo': '#00A082',
    'Рядом': '#FF7F00'
};

class ApiSyncService {
    constructor() {
        this.baseUrl = process.env.EXTERNAL_API_BASE || 'http://94.131.88.146';
        this.token = process.env.EXTERNAL_API_TOKEN;
        this.isSyncing = false;
        this.currentJob = null;
        this.progress = {
            status: 'idle',
            currentFile: null,
            filesProcessed: 0,
            totalFiles: 0,
            recordsProcessed: 0,
            totalRecords: 0
        };
        
        this.client = axios.create({
            baseURL: this.baseUrl,
            headers: { 'Authorization': `Bearer ${this.token}` },
            timeout: 120000 // 2 minutes timeout
        });
    }

    getProgress() {
        return this.progress;
    }

    resolveAggregatorName(mercantName, fileId) {
        // Try mercant_name first
        const lowerMercant = (mercantName || '').toLowerCase();
        for (const [key, value] of Object.entries(AGGREGATOR_MAPPING)) {
            if (lowerMercant.includes(key)) {
                return value;
            }
        }
        
        // Try file ID
        const lowerFileId = (fileId || '').toLowerCase();
        for (const [key, value] of Object.entries(AGGREGATOR_MAPPING)) {
            if (lowerFileId.includes(key)) {
                return value;
            }
        }
        
        // Default - extract from file name
        const parts = fileId.split('_');
        if (parts.length > 0) {
            return parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
        }
        
        return 'Unknown';
    }

    extractCity(fileId, record) {
        // Extract city from file ID or record
        const lowerFileId = (fileId || '').toLowerCase();
        if (lowerFileId.includes('almaty') || record?.city === 'almaty') {
            return 'almaty';
        }
        if (lowerFileId.includes('astana') || record?.city === 'astana') {
            return 'astana';
        }
        return null;
    }

    async syncAllFiles() {
        if (this.isSyncing) {
            console.log('Sync already in progress');
            return { status: 'already_running' };
        }

        this.isSyncing = true;
        this.progress = {
            status: 'starting',
            currentFile: null,
            filesProcessed: 0,
            totalFiles: 0,
            recordsProcessed: 0,
            totalRecords: 0
        };

        console.log('========================================');
        console.log('STARTING FULL SYNC FROM EXTERNAL API');
        console.log('========================================');

        // Create job record
        this.currentJob = await ImportJob.create({
            job_type: 'full_sync',
            status: 'processing',
            file_name: 'Full External API Sync'
        });

        try {
            // Get list of all files
            const filesResponse = await this.client.get('/api/csv-files');
            const files = filesResponse.data.files || [];
            
            // Filter only mapped files
            const mappedFiles = files.filter(f => f.id.endsWith('_mapped'));
            
            this.progress.totalFiles = mappedFiles.length;
            this.progress.status = 'fetching';
            
            console.log(`Found ${mappedFiles.length} mapped files to process`);

            let totalRecordsProcessed = 0;

            for (let i = 0; i < mappedFiles.length; i++) {
                const file = mappedFiles[i];
                this.progress.currentFile = file.id;
                this.progress.filesProcessed = i;
                
                console.log(`\n[${i + 1}/${mappedFiles.length}] Processing: ${file.id}`);
                
                const recordsCount = await this.processFile(file.id);
                totalRecordsProcessed += recordsCount;
                
                this.progress.recordsProcessed = totalRecordsProcessed;
                
                // Update job
                await ImportJob.findByIdAndUpdate(this.currentJob._id, {
                    processed_rows: totalRecordsProcessed,
                    error_details: `Processing ${file.id}`
                });
            }

            // Complete
            this.progress.status = 'completed';
            this.progress.filesProcessed = mappedFiles.length;
            
            await ImportJob.findByIdAndUpdate(this.currentJob._id, {
                status: 'completed',
                processed_rows: totalRecordsProcessed,
                completed_at: new Date()
            });

            console.log('\n========================================');
            console.log(`SYNC COMPLETE! Total records: ${totalRecordsProcessed}`);
            console.log('========================================');

            return {
                status: 'completed',
                totalFiles: mappedFiles.length,
                totalRecords: totalRecordsProcessed
            };

        } catch (err) {
            console.error('SYNC FAILED:', err.message);
            this.progress.status = 'failed';
            this.progress.error = err.message;
            
            await ImportJob.findByIdAndUpdate(this.currentJob._id, {
                status: 'failed',
                error_details: err.message
            });

            return { status: 'failed', error: err.message };
        } finally {
            this.isSyncing = false;
        }
    }

    async processFile(fileId) {
        try {
            console.log(`  Fetching ${fileId}...`);
            const response = await this.client.get(`/api/csv-data/${fileId}`);
            const records = response.data.data || [];
            
            if (records.length === 0) {
                console.log(`  No records in ${fileId}`);
                return 0;
            }

            console.log(`  Found ${records.length} records`);

            // Determine aggregator from first record
            const sampleRecord = records[0];
            const aggregatorName = this.resolveAggregatorName(sampleRecord.mercant_name, fileId);
            const city = this.extractCity(fileId, sampleRecord);
            
            console.log(`  Aggregator: ${aggregatorName}, City: ${city || 'all'}`);

            // Get or create aggregator
            const aggregator = await this.ensureAggregator(aggregatorName);

            // Process in batches for better performance
            const BATCH_SIZE = 500;
            let processedCount = 0;

            for (let i = 0; i < records.length; i += BATCH_SIZE) {
                const batch = records.slice(i, i + BATCH_SIZE);
                await this.processBatch(batch, aggregator, city);
                processedCount += batch.length;
                
                if (i % 2000 === 0 && i > 0) {
                    console.log(`    Processed ${processedCount}/${records.length}`);
                }
            }

            console.log(`  ✓ Completed: ${records.length} records for ${aggregatorName}`);
            return records.length;

        } catch (err) {
            console.error(`  ✗ Error processing ${fileId}:`, err.message);
            return 0;
        }
    }

    async processBatch(records, aggregator, city) {
        const productOps = [];
        const recordsMap = new Map(); // key -> record for price creation

        for (const record of records) {
            const title = record.title || record.name;
            if (!title) continue;

            const matchedUuid = record.matched_uuid || null;
            const key = matchedUuid || title;
            
            // Store for later price creation
            recordsMap.set(key, record);

            const productUpdate = {
                name: title,
                grouping_id: matchedUuid,
                brand: record.brand || null,
                image_url: record.url_picture || record.url || null,
                sku: record.product_id || record.id || null
            };

            productOps.push({
                updateOne: {
                    filter: matchedUuid ? { grouping_id: matchedUuid } : { name: title },
                    update: { $set: productUpdate },
                    upsert: true
                }
            });
        }

        // Execute product upserts
        if (productOps.length > 0) {
            await Product.bulkWrite(productOps, { ordered: false });
        }

        // Get all products we just upserted in ONE query
        const uuids = [...recordsMap.keys()].filter(k => k.includes('-')); // UUIDs contain dashes
        const names = [...recordsMap.keys()].filter(k => !k.includes('-'));
        
        const products = await Product.find({
            $or: [
                { grouping_id: { $in: uuids } },
                { name: { $in: names } }
            ]
        }).select('_id name grouping_id').lean();

        // Create lookup map
        const productLookup = new Map();
        products.forEach(p => {
            if (p.grouping_id) productLookup.set(p.grouping_id, p._id);
            productLookup.set(p.name, p._id);
        });

        // Create price operations
        const priceOps = [];
        for (const [key, record] of recordsMap) {
            const price = parseFloat(record.cost || record.price);
            if (!price || isNaN(price)) continue;

            const productId = productLookup.get(key) || productLookup.get(record.title || record.name);
            if (!productId) continue;

            priceOps.push({
                updateOne: {
                    filter: { product: productId, aggregator: aggregator._id },
                    update: {
                        $set: {
                            price: price,
                            is_available: record.available !== false,
                            last_updated: new Date(),
                            competitor_brand: record.brand || null
                        }
                    },
                    upsert: true
                }
            });
        }

        // Execute price upserts
        if (priceOps.length > 0) {
            await Price.bulkWrite(priceOps, { ordered: false });
        }
    }

    async ensureAggregator(name) {
        let aggregator = await Aggregator.findOne({ name });
        
        if (!aggregator) {
            aggregator = await Aggregator.create({
                name,
                color: AGGREGATOR_COLORS[name] || '#' + Math.floor(Math.random()*16777215).toString(16),
                is_our_company: name === 'Рядом' || name === process.env.OUR_COMPANY_AGGREGATOR
            });
            console.log(`    Created new aggregator: ${name}`);
        }
        
        return aggregator;
    }

    async ensureCategory(categoryPath) {
        try {
            // Parse category path like "Продукты питания > Молочные продукты, яйца > Молоко, сливки"
            const parts = categoryPath.split(' > ').map(p => p.trim());
            
            if (parts.length === 0) return null;

            // Use the last (most specific) category
            const categoryName = parts[parts.length - 1];
            
            let category = await Category.findOne({ name: categoryName });
            
            if (!category) {
                category = await Category.create({
                    name: categoryName,
                    icon: '📦'
                });
            }
            
            return category._id;
        } catch (err) {
            return null;
        }
    }

    // Legacy method name
    async syncMappedFiles() {
        return this.syncAllFiles();
    }
}

module.exports = new ApiSyncService();
