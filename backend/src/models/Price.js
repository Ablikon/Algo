const mongoose = require('mongoose');

const priceSchema = new mongoose.Schema({
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
    price: {
        type: Number,
        default: null
    },
    is_available: {
        type: Boolean,
        default: true
    },
    competitor_brand: {
        type: String,
        default: null
    },
    competitor_country: {
        type: String,
        default: null
    },
    city: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'City',
        default: null
    },
    last_updated: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: false
});

// Compound index for unique price per product+aggregator+city
priceSchema.index({ product: 1, aggregator: 1, city: 1 }, { unique: true });

module.exports = mongoose.model('Price', priceSchema);
