const mongoose = require('mongoose');

const aggregatorSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true
    },
    logo_url: {
        type: String,
        default: null
    },
    color: {
        type: String,
        default: null
    },
    is_our_company: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: { createdAt: 'created_at', updatedAt: false }
});

module.exports = mongoose.model('Aggregator', aggregatorSchema);
