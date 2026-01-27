const mongoose = require('mongoose');

const recommendationSchema = new mongoose.Schema({
    product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        required: true
    },
    action_type: {
        type: String,
        enum: ['LOWER_PRICE', 'ADD_PRODUCT', 'NO_ACTION'],
        required: true
    },
    current_price: {
        type: Number,
        default: null
    },
    recommended_price: {
        type: Number,
        default: null
    },
    competitor_price: {
        type: Number,
        default: null
    },
    potential_savings: {
        type: Number,
        default: null
    },
    priority: {
        type: String,
        enum: ['HIGH', 'MEDIUM', 'LOW'],
        default: 'LOW'
    },
    status: {
        type: String,
        enum: ['PENDING', 'APPLIED', 'REJECTED'],
        default: 'PENDING'
    },
    city: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'City',
        default: null
    }
}, {
    timestamps: { createdAt: 'created_at', updatedAt: false }
});

module.exports = mongoose.model('Recommendation', recommendationSchema);
