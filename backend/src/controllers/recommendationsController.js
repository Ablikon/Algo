const Recommendation = require('../models/Recommendation');
const Product = require('../models/Product');
const ProductMatcher = require('../services/matching');

exports.getAll = async (req, res) => {
    try {
        const citySlug = req.query.city || null;
        
        const query = {};
        if (citySlug && citySlug !== 'all') {
            const City = require('../models/City');
            const city = await City.findOne({ slug: citySlug });
            if (city) query.city = city._id;
        }

        const recommendations = await Recommendation.find(query)
            .populate('product')
            .sort({ priority: -1, created_at: -1 });

        const results = recommendations.map(rec => ({
            id: rec._id.toString(),
            product_name: rec.product ? rec.product.name : 'Unknown',
            action_type: rec.action_type,
            current_price: rec.current_price,
            recommended_price: rec.recommended_price,
            competitor_price: rec.competitor_price,
            potential_savings: rec.potential_savings,
            priority: rec.priority,
            status: rec.status,
            created_at: rec.created_at
        }));

        res.json({ results, count: results.length });
    } catch (err) {
        console.error('Error fetching recommendations:', err);
        res.status(500).json({ message: err.message });
    }
};

exports.apply = async (req, res) => {
    try {
        const recommendation = await Recommendation.findById(req.params.id);
        if (!recommendation) {
            return res.status(404).json({ message: 'Recommendation not found' });
        }

        recommendation.status = 'APPLIED';
        await recommendation.save();

        res.json({ 
            status: 'success', 
            message: 'Recommendation applied',
            recommendation: {
                id: recommendation._id.toString(),
                status: recommendation.status
            }
        });
    } catch (err) {
        console.error('Error applying recommendation:', err);
        res.status(500).json({ message: err.message });
    }
};

exports.reject = async (req, res) => {
    try {
        const recommendation = await Recommendation.findById(req.params.id);
        if (!recommendation) {
            return res.status(404).json({ message: 'Recommendation not found' });
        }

        recommendation.status = 'REJECTED';
        await recommendation.save();

        res.json({ 
            status: 'success', 
            message: 'Recommendation rejected',
            recommendation: {
                id: recommendation._id.toString(),
                status: recommendation.status
            }
        });
    } catch (err) {
        console.error('Error rejecting recommendation:', err);
        res.status(500).json({ message: err.message });
    }
};

exports.runAlgorithm = async (req, res) => {
    try {
        const citySlug = req.query.city || null;
        
        // Get all products
        const products = await Product.find().limit(100); // Limit for performance
        
        let newRecommendations = 0;
        for (const product of products) {
            const recommendation = await ProductMatcher.run(product, citySlug);
            if (recommendation) {
                newRecommendations++;
            }
        }

        res.json({
            status: 'success',
            new_recommendations: newRecommendations,
            message: `Generated ${newRecommendations} new recommendations`
        });
    } catch (err) {
        console.error('Error running algorithm:', err);
        res.status(500).json({ message: err.message });
    }
};
