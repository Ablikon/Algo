#!/usr/bin/env node

// Health Check Script for ScoutAlgo Backend
const axios = require('axios');

const API_BASE = 'http://localhost:8000/api';

const checks = [
    { name: 'Aggregators', url: `${API_BASE}/aggregators/` },
    { name: 'Categories', url: `${API_BASE}/categories/` },
    { name: 'Products', url: `${API_BASE}/products/?page=1&page_size=1` },
    { name: 'Products Comparison', url: `${API_BASE}/products/comparison/?page=1&page_size=1` },
    { name: 'Recommendations', url: `${API_BASE}/recommendations/` },
    { name: 'Dashboard', url: `${API_BASE}/dashboard/` },
    { name: 'Sync Status', url: `${API_BASE}/sync/status` },
    { name: 'Mapped Files', url: `${API_BASE}/import/mapped/api-files/` }
];

console.log('🏥 ScoutAlgo Backend Health Check\n');
console.log('=' .repeat(60));

async function runChecks() {
    let passed = 0;
    let failed = 0;

    for (const check of checks) {
        try {
            const response = await axios.get(check.url, { timeout: 5000 });
            const status = response.status === 200 ? '✅' : '⚠️';
            console.log(`${status} ${check.name.padEnd(25)} [${response.status}]`);
            
            // Show data count if available
            if (response.data) {
                if (response.data.count !== undefined) {
                    console.log(`   └─ Count: ${response.data.count}`);
                } else if (response.data.results && Array.isArray(response.data.results)) {
                    console.log(`   └─ Results: ${response.data.results.length}`);
                } else if (response.data.total_products !== undefined) {
                    console.log(`   └─ Total Products: ${response.data.total_products}`);
                } else if (response.data.files && Array.isArray(response.data.files)) {
                    console.log(`   └─ Files: ${response.data.files.length}`);
                }
            }
            
            passed++;
        } catch (error) {
            failed++;
            const status = '❌';
            const errorMsg = error.response 
                ? `[${error.response.status}] ${error.response.statusText}`
                : error.code || error.message;
            console.log(`${status} ${check.name.padEnd(25)} ${errorMsg}`);
        }
    }

    console.log('=' .repeat(60));
    console.log(`\n📊 Summary: ${passed} passed, ${failed} failed\n`);
    
    if (failed > 0) {
        console.log('⚠️  Some checks failed. Please investigate the issues.');
        process.exit(1);
    } else {
        console.log('✅ All systems operational!');
        process.exit(0);
    }
}

runChecks().catch(error => {
    console.error('❌ Health check failed:', error.message);
    process.exit(1);
});
