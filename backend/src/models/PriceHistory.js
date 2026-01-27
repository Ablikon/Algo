const mongoose = require('mongoose');

const priceHistorySchema = new mongoose.Schema({
    product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        required: true
    },
    aggregator: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Aggregator',
        required: true
    },
    old_price: {
        type: Number,
        default: null
    },
    new_price: {
        type: Number,
        default: null
    },
    changed_at: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: false
});

module.exports = mongoose.model('PriceHistory', priceHistorySchema);
