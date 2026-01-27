const mongoose = require('mongoose');
const Aggregator = require('../models/Aggregator');
const Price = require('../models/Price');
const Recommendation = require('../models/Recommendation');
const City = require('../models/City');

class ProductMatcher {
    constructor() {
        this.ourAggregator = null;
    }

    async init() {
        // Assuming 'Рядом' or similar is our company. 
        // Ideally this should be configurable or fetched by a specific flag.
        // In new model we have is_our_company flag.
        this.ourAggregator = await Aggregator.findOne({ is_our_company: true });
    }

    normalizePrice(product, priceValue) {
        if (!priceValue || !product.weight_value || !product.weight_unit) {
            return parseFloat(priceValue);
        }

        try {
            const val = parseFloat(priceValue);
            const weight = parseFloat(product.weight_value);
            const unit = product.weight_unit.toLowerCase();

            if (unit === 'kg' || unit === 'l') {
                return val / weight;
            } else if (unit === 'g' || unit === 'ml') {
                // Price for 1000 units (1kg/1l)
                return val / (weight / 1000.0);
            } else if (unit === 'pcs') {
                return val / weight;
            }
            return val;
        } catch (e) {
            return parseFloat(priceValue);
        }
    }

    denormalizePrice(product, normalizedPrice) {
        if (!normalizedPrice || !product.weight_value || !product.weight_unit) {
            return normalizedPrice;
        }

        try {
            const normVal = parseFloat(normalizedPrice);
            const weight = parseFloat(product.weight_value);
            const unit = product.weight_unit.toLowerCase();

            let itemPrice = normVal;
            if (unit === 'kg' || unit === 'l') {
                itemPrice = normVal * weight;
            } else if (unit === 'g' || unit === 'ml') {
                itemPrice = normVal * (weight / 1000.0);
            } else if (unit === 'pcs') {
                itemPrice = normVal * weight;
            }

            return parseFloat(itemPrice.toFixed(2));
        } catch (e) {
            return parseFloat(normalizedPrice);
        }
    }

    async run(product, citySlug = null) {
        if (!this.ourAggregator) await this.init();

        const query = { product: product._id };
        if (citySlug) {
            const city = await City.findOne({ slug: citySlug });
            if (city) query.city = city._id;
        }

        // Populate aggregator to access fields like name, is_our_company
        // IMPORTANT: .populate() works on the query, make sure schema refs are correct
        const prices = await Price.find(query).populate('aggregator');

        let ourPriceObj = null;
        let competitorPrices = [];

        for (const price of prices) {
            if (price.aggregator.is_our_company) {
                ourPriceObj = price;
            } else if (price.is_available && price.price) {
                competitorPrices.push({
                    raw_price: parseFloat(price.price),
                    normalized_price: this.normalizePrice(product, price.price),
                    aggregator: price.aggregator.name,
                    competitor_brand: price.competitor_brand,
                    competitor_country: price.competitor_country
                });
            }
        }

        if (competitorPrices.length === 0) return null;

        // Filter valid competitors
        const validCompetitors = [];
        for (const comp of competitorPrices) {
            let isBrandMismatch = false;
            if (product.brand && comp.competitor_brand) {
                if (product.brand.toLowerCase() !== comp.competitor_brand.toLowerCase()) {
                    isBrandMismatch = true;
                }
            }

            let isCountryMismatch = false;
            if (product.country_of_origin && comp.competitor_country) {
                if (product.country_of_origin.toLowerCase() !== comp.competitor_country.toLowerCase()) {
                    isCountryMismatch = true;
                }
            }

            if (!isBrandMismatch && !isCountryMismatch) {
                validCompetitors.push(comp);
            }
        }

        // If matches found, use them. If all filtered out but some existed, use strict logic (return null) or fallback?
        // Python code fell back to "strict respect" -> return None if mismatches found.
        // However, if we want to be aggressive, we might just look at the cheapest available.
        // Let's stick to Python logic: if no valid competitors after filtering, return null.
        if (validCompetitors.length === 0) return null;

        // Find best competitor by NORMALIZED price
        const bestCompetitor = validCompetitors.reduce((prev, curr) =>
            prev.normalized_price < curr.normalized_price ? prev : curr
        );

        const ourRaw = (ourPriceObj && ourPriceObj.price) ? parseFloat(ourPriceObj.price) : null;
        const ourNorm = ourRaw ? this.normalizePrice(product, ourRaw) : null;

        // Check for existing pending recommendation
        const existing = await Recommendation.findOne({
            product: product._id,
            status: 'PENDING'
        });

        if (existing) return null;

        // Target: 1% cheaper than best competitor (normalized)
        const targetNorm = bestCompetitor.normalized_price * 0.99;
        const targetRaw = this.denormalizePrice(product, targetNorm);

        // Get city object for recommendation
        let cityId = null;
        if (citySlug) {
            const city = await City.findOne({ slug: citySlug });
            if (city) cityId = city._id;
        }

        let recData = null;

        if (ourRaw === null) {
            // ADD PRODUCT
            recData = {
                product: product._id,
                action_type: 'ADD_PRODUCT',
                current_price: null,
                recommended_price: targetRaw,
                competitor_price: bestCompetitor.raw_price,
                priority: 'HIGH',
                status: 'PENDING',
                city: cityId
            };
        } else if (ourNorm > bestCompetitor.normalized_price) {
            // LOWER PRICE
            const savings = ourRaw - targetRaw;
            let priority = 'LOW';
            if (savings > 50) priority = 'HIGH';
            else if (savings > 10) priority = 'MEDIUM';

            recData = {
                product: product._id,
                action_type: 'LOWER_PRICE',
                current_price: ourRaw,
                recommended_price: targetRaw,
                competitor_price: bestCompetitor.raw_price,
                potential_savings: savings,
                priority: priority,
                status: 'PENDING',
                city: cityId
            };
        }

        if (recData) {
            return await Recommendation.create(recData);
        }

        return null;
    }
}

module.exports = new ProductMatcher();
