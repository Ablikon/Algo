const mongoose = require('mongoose');

/**
 * Model to store manual mapping corrections
 * When user fixes an incorrect match or removes it
 */
const MappingCorrectionSchema = new mongoose.Schema({
    // Original data from API file
    file_id: {
        type: String,
        required: true,
        index: true
    },
    ntin: {
        type: String,
        index: true
    },
    csv_name: {
        type: String,
        required: true
    },
    csv_brand: String,
    csv_weight: String,
    market_name: String,
    
    // Original match from API (before correction)
    original_match: {
        title: String,
        brand: String,
        product_id: String,
        confidence: Number
    },
    
    // Corrected match (null if deleted)
    corrected_match: {
        product_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Product'
        },
        product_name: String,
        product_brand: String,
        // null means match was deleted (no correct product exists)
        is_deleted: {
            type: Boolean,
            default: false
        }
    },
    
    // Status after correction
    status: {
        type: String,
        enum: ['corrected', 'deleted', 'pending'],
        default: 'pending'
    },
    
    // Metadata
    corrected_by: String,
    corrected_at: {
        type: Date,
        default: Date.now
    },
    notes: String
}, {
    timestamps: true
});

// Compound index for fast lookup
MappingCorrectionSchema.index({ file_id: 1, csv_name: 1 });
MappingCorrectionSchema.index({ file_id: 1, ntin: 1 });

module.exports = mongoose.model('MappingCorrection', MappingCorrectionSchema);
