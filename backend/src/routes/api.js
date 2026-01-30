const express = require('express');
const router = express.Router();

const baseController = require('../controllers/baseController');
const productController = require('../controllers/productController');
const analyticsController = require('../controllers/analyticsController');
const importController = require('../controllers/importController');
const recommendationsController = require('../controllers/recommendationsController');
const verificationController = require('../controllers/verificationController');
const ryadomController = require('../controllers/ryadomController');

// Aggregators & Cities
router.get('/aggregators', baseController.getAggregators);
router.get('/aggregators/', baseController.getAggregators);
router.post('/aggregators/setup', baseController.setupAggregators);
router.get('/cities', baseController.getCities);

// Categories
router.get('/categories', baseController.getCategories);
router.get('/categories/', baseController.getCategories);
router.get('/categories/tree', baseController.getCategoryTree);
router.get('/categories/tree/', baseController.getCategoryTree);

// Products
router.get('/products', productController.getProducts);
router.get('/products/', productController.getProducts);
router.get('/products/comparison', productController.getProductComparison);
router.get('/products/comparison/', productController.getProductComparison);

// Recommendations
router.get('/recommendations', recommendationsController.getAll);
router.get('/recommendations/', recommendationsController.getAll);
router.post('/recommendations/:id/apply', recommendationsController.apply);
router.post('/recommendations/:id/apply/', recommendationsController.apply);
router.post('/recommendations/:id/reject', recommendationsController.reject);
router.post('/recommendations/:id/reject/', recommendationsController.reject);

// Dashboard & Analytics
router.get('/dashboard', analyticsController.getDashboardStats);
router.get('/dashboard/', analyticsController.getDashboardStats);
router.get('/dashboard/gaps', analyticsController.getGaps);
router.get('/dashboard/gaps/', analyticsController.getGaps);
router.get('/analytics/overlap', analyticsController.getAggregatorOverlap);
router.get('/analytics/overlap/', analyticsController.getAggregatorOverlap);

// Mapping Verification - support both GET and POST
router.get('/verification/mapping', verificationController.getMappingVerification);
router.post('/verification/mapping', verificationController.getMappingVerification);

// Algorithm
router.post('/algorithm/run', recommendationsController.runAlgorithm);
router.post('/algorithm/run/', recommendationsController.runAlgorithm);

// Imports & Sync
router.get('/sync/status', importController.getSyncStatus);
router.post('/sync/external-api', importController.syncExternalApi);
router.post('/sync/reset-and-sync', importController.resetAndSync);
router.post('/import/baseline', importController.importBaseline);

// Match legacy progress endpoints
router.get('/import/external/progress', importController.getSyncStatus);
router.get('/import/matching-progress', importController.getSyncStatus);

// Mapping Review - support both GET and POST for all endpoints
router.get('/import/mapped/api-files', importController.getMappedApiFiles);
router.get('/import/mapped/api-files/', importController.getMappedApiFiles);
router.get('/import/mapped/review-from-api', verificationController.reviewMappedFromApi);
router.get('/import/mapped/review-from-api/', verificationController.reviewMappedFromApi);
router.post('/import/mapped/review-from-api', verificationController.reviewMappedFromApi);
router.post('/import/mapped/review-from-api/', verificationController.reviewMappedFromApi);

// Mapping corrections (manual fixes)
router.get('/mapping/search-products', verificationController.searchProducts);
router.post('/mapping/correction', verificationController.saveCorrection);
router.post('/mapping/delete', verificationController.deleteMapping);
router.get('/mapping/corrections', verificationController.getCorrections);
router.get('/mapping/stats', verificationController.getCorrectionStats);

// Local file review (new format)
router.get('/import/local/review', verificationController.reviewLocalFile);
router.post('/import/local/review', verificationController.reviewLocalFile);

// Ryadom (our company) data management
router.get('/ryadom/status', ryadomController.getBqStatus);
router.post('/ryadom/load-bq', ryadomController.loadBqResults);
router.post('/ryadom/link', ryadomController.linkProductsToRyadom);
router.get('/ryadom/products', ryadomController.getRyadomProducts);

module.exports = router;
