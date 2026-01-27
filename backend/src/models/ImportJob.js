const mongoose = require('mongoose');

const importJobSchema = new mongoose.Schema({
    job_type: {
        type: String,
        enum: ['products', 'prices', 'categories', 'links', 'json_import', 'custom_json', 'full_sync', 'api_sync'],
        required: true
    },
    file_name: {
        type: String,
        default: null
    },
    status: {
        type: String,
        enum: ['pending', 'processing', 'completed', 'failed'],
        default: 'pending'
    },
    total_rows: {
        type: Number,
        default: null
    },
    processed_rows: {
        type: Number,
        default: 0
    },
    success_count: {
        type: Number,
        default: 0
    },
    error_count: {
        type: Number,
        default: 0
    },
    error_details: {
        type: mongoose.Schema.Types.Mixed,
        default: null
    },
    completed_at: {
        type: Date,
        default: null
    }
}, {
    timestamps: { createdAt: 'created_at', updatedAt: false }
});

module.exports = mongoose.model('ImportJob', importJobSchema);
