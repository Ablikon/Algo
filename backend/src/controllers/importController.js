const ApiSync = require('../services/apiSync');
const ImportJob = require('../models/ImportJob');
const Product = require('../models/Product');
const Price = require('../models/Price');
const Category = require('../models/Category');
const Aggregator = require('../models/Aggregator');
const axios = require('axios');

// External API client
const externalApi = axios.create({
    baseURL: process.env.EXTERNAL_API_BASE || 'http://94.131.88.146',
    headers: { 'Authorization': `Bearer ${process.env.EXTERNAL_API_TOKEN}` },
    timeout: 60000
});

exports.importBaseline = async (req, res) => {
    try {
        res.json({ 
            status: 'deprecated', 
            message: 'Use /api/sync/external-api to sync from external API'
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

exports.syncExternalApi = async (req, res) => {
    try {
        // Start async sync
        ApiSync.syncAllFiles().catch(err => console.error('API Sync error:', err));
        
        res.json({ 
            status: 'started', 
            message: 'Syncing from external API. This may take several minutes.',
            hint: 'Check progress at GET /api/sync/status'
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

exports.getSyncStatus = async (req, res) => {
    try {
        // Get live progress
        const progress = ApiSync.getProgress();
        
        // Also get last job from DB
        const job = await ImportJob.findOne().sort({ created_at: -1 });
        
        // Get current stats
        const [totalProducts, totalPrices, aggregatorCount] = await Promise.all([
            Product.countDocuments(),
            Price.countDocuments(),
            Aggregator.countDocuments()
        ]);

        res.json({
            ...progress,
            last_job: job ? {
                id: job._id,
                status: job.status,
                processed_rows: job.processed_rows,
                created_at: job.created_at,
                completed_at: job.completed_at
            } : null,
            current_stats: {
                total_products: totalProducts,
                total_prices: totalPrices,
                total_aggregators: aggregatorCount
            }
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

exports.getMappedApiFiles = async (req, res) => {
    try {
        const response = await externalApi.get('/api/csv-files');
        const files = response.data.files || [];
        
        // Get record counts for each file
        const mappedFiles = files.filter(f => f.id.endsWith('_mapped'));
        
        // Enhance with additional info
        const enhancedFiles = mappedFiles.map(f => ({
            ...f,
            display_name: f.id.replace(/_mapped$/, '').replace(/_/g, ' ').toUpperCase()
        }));

        res.json({ 
            files: enhancedFiles,
            count: enhancedFiles.length,
            api_base: process.env.EXTERNAL_API_BASE
        });
    } catch (err) {
        console.error('Error fetching mapped files:', err.message);
        res.status(500).json({ 
            message: err.message,
            hint: 'Check if EXTERNAL_API_BASE and EXTERNAL_API_TOKEN are set correctly'
        });
    }
};

exports.getJsonInfo = async (req, res) => {
    try {
        res.json({ 
            data_path: '/Data',
            external_api: process.env.EXTERNAL_API_BASE,
            hint: 'Use /api/sync/external-api to sync data'
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

exports.resetCategories = async (req, res) => {
    try {
        await Category.deleteMany({});
        res.json({ status: 'success', message: 'Categories wiped' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// Clear all data and resync
exports.resetAndSync = async (req, res) => {
    try {
        console.log('Clearing all data...');
        
        await Promise.all([
            Product.deleteMany({}),
            Price.deleteMany({}),
            Category.deleteMany({}),
            Aggregator.deleteMany({}),
            ImportJob.deleteMany({})
        ]);
        
        console.log('All data cleared. Starting fresh sync...');
        
        // Start fresh sync
        ApiSync.syncAllFiles().catch(err => console.error('Sync error:', err));
        
        res.json({ 
            status: 'started',
            message: 'All data cleared. Starting fresh sync from external API.'
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};
