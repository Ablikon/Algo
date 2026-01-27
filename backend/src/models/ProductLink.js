const mongoose = require('mongoose');

const productLinkSchema = new mongoose.Schema({
    product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        required: true,
        index: true
    },
    aggregator: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Aggregator',
        required: true
    },
    url: {
        type: String,
        default: null
    },
    external_name: {
        type: String,
        default: null
    },
    is_verified: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: { createdAt: 'created_at', updatedAt: false }
});

// Compound index for unique link per product+aggregator
productLinkSchema.index({ product: 1, aggregator: 1 }, { unique: true });

module.exports = mongoose.model('ProductLink', productLinkSchema);
