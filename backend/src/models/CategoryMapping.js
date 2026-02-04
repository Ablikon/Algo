const mongoose = require('mongoose');

// Stores mapping between raw aggregator categories and unified master categories
const categoryMappingSchema = new mongoose.Schema({
    // Raw category name from aggregator (e.g., "Молоко, сыр и яйца", "dairy_national")
    raw_category: {
        type: String,
        required: true,
        index: true
    },
    // Which aggregator this raw category came from
    aggregator: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Aggregator',
        required: true
    },
    // Reference to unified master category
    master_category: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category',
        default: null
    },
    // Confidence score from GPT matching (0-100)
    confidence: {
        type: Number,
        default: 0
    },
    // Whether this mapping was verified by a human
    is_verified: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true
});

// Compound index for unique raw category per aggregator
categoryMappingSchema.index({ raw_category: 1, aggregator: 1 }, { unique: true });

module.exports = mongoose.model('CategoryMapping', categoryMappingSchema);
