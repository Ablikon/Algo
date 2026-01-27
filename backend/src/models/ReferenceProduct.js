const mongoose = require('mongoose');

const referenceProductSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        index: true
    },
    category_1: String,
    category_2: String,
    category_3: String,
    brand_name: String,
    slug: String,
    ntin: {
        type: String,
        index: true
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('ReferenceProduct', referenceProductSchema);
