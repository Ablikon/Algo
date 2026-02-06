const express = require('express');
const router = express.Router();
const apiSync = require('../services/apiSync');

// External API import - run full sync
router.post('/external/run', async (req, res) => {
    try {
        console.log('🚀 Starting external API import...');
        
        // Check if already running
        const currentProgress = apiSync.getProgress();
        if (currentProgress.status === 'processing' || currentProgress.status === 'starting') {
            return res.json({ 
                status: 'already_running',
                message: 'Import is already in progress',
                progress: currentProgress
            });
        }
        
        // Start the import in background (don't await)
        apiSync.syncAllFiles().then(() => {
            console.log('✅ External API import completed');
        }).catch(err => {
            console.error('❌ External API import failed:', err);
        });
        
        res.json({ 
            status: 'started',
            message: 'External API import started successfully in background. Check /api/import/external/progress for updates.'
        });
    } catch (error) {
        console.error('Error starting external import:', error);
        res.status(500).json({ 
            error: 'Failed to start import',
            details: error.message 
        });
    }
});

// Get external import progress
router.get('/external/progress', (req, res) => {
    try {
        const progress = apiSync.getProgress();
        res.json(progress);
    } catch (error) {
        console.error('Error getting import progress:', error);
        res.status(500).json({ 
            error: 'Failed to get progress',
            details: error.message 
        });
    }
});

module.exports = router;