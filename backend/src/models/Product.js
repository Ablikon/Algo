const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        index: true
    },
    grouping_id: {
        type: String,
        index: true,
        default: null
    },
    category: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category',
        default: null
    },
    image_url: {
        type: String,
        default: null
    },
    brand: {
        type: String,
        default: null,
        index: true
    },
    manufacturer: {
        type: String,
        default: null
    },
    country_of_origin: {
        type: String,
        default: null
    },
    weight_value: {
        type: Number,
        default: null
    },
    weight_unit: {
        type: String,
        enum: ['kg', 'g', 'l', 'ml', 'pcs', null],
        default: null
    },
    sku: {
        type: String,
        default: null,
        index: true
    }
}, {
    timestamps: false
});

// Virtual for getting prices easily if needed, though we often do manual queries for performance
productSchema.virtual('prices', {
    ref: 'Price',
    localField: '_id',
    foreignField: 'product'
});

module.exports = mongoose.model('Product', productSchema);
