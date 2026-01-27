const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const Category = require('../models/Category');
const Product = require('../models/Product');
const Price = require('../models/Price');
const Aggregator = require('../models/Aggregator');
const ProductLink = require('../models/ProductLink');
const City = require('../models/City');
const ImportJob = require('../models/ImportJob');

const CATEGORY_PATTERNS = {
    'eggs': {
        'name': 'Яйца',
        'patterns': ['яйц', 'egg', 'яйко', 'eggs'],
        'subcategories': {
            'Куриные яйца': ['куриные', 'chicken', 'c0', 'c1', 'обычные'],
            'Перепелиные яйца': ['перепел', 'quail'],
            'Яйца эко': ['эко', 'органик', 'organic', 'фермерские', 'farm'],
        }
    },
    'sodas': {
        'name': 'Газировки',
        'patterns': ['газир', 'soda', 'кола', 'cola', 'pepsi', 'fanta', 'sprite', '7up', 'лимонад'],
        'subcategories': {
            'Fanta': ['fanta', 'фанта'],
            'Sprite': ['sprite', 'спрайт'],
            'Pepsi': ['pepsi', 'пепси'],
            '7UP': ['7up', '7-up', 'seven up', 'севен ап'],
            'Coca-Cola': ['coca-cola', 'coca cola', 'кока-кола', 'кока кола'],
            'Другие колы': ['cola', 'кола'],
            'Другие газировки': [],
        }
    },
    'chocolates': {
        'name': 'Шоколадки',
        'patterns': ['шоколад', 'chocolate', 'snickers', 'mars', 'twix', 'bounty', 'milka', 'kitkat', 'kit kat'],
        'subcategories': {
            'Snickers': ['snickers', 'сникерс'],
            'Mars': ['mars', 'марс'],
            'Twix': ['twix', 'твикс'],
            'Bounty': ['bounty', 'баунти'],
            'KitKat': ['kitkat', 'kit kat', 'кит кат', 'киткат'],
            'Milka': ['milka', 'милка'],
            'Alpen Gold': ['alpen gold', 'альпен голд'],
            'Alenka': ['аленка', 'alenka'],
            'Другой шоколад': [],
        }
    },
    'salads_herbs': {
        'name': 'Салаты и зелень',
        'patterns': ['салат', 'зелень', 'рукола', 'шпинат', 'базилик', 'укроп', 'петрушка'],
        'subcategories': { 'Зелень': [] }
    },
    'household': {
        'name': 'Хозтовары',
        'patterns': ['шампунь', 'гель для душа', 'мыло', 'паста', 'крем-краска', 'краска для волос', 'порошок'],
        'subcategories': { 'Уход': [] }
    }
};

const AGGREGATOR_FILES = {
    'glovo': 'glovo.glovo_products.json',
    'arbuz': 'arbuz_kz.arbuz_products.json',
    'wolt': 'wolt.wolt_products.json',
    'yandex': 'yandex_lavka.products.json',
    'magnum_almaty': 'magnum_almaty.json',
    'magnum_astana': 'magnum_astana.json',
    'airba': 'airba_fresh.airba_products.json',
};

class Importer {
    constructor(jobId = null) {
        this.jobId = jobId;
        this.stats = {
            matched: 0,
            imported: 0,
            errors: 0,
            skipped: 0
        };
        this.errors = [];
        this.dataPath = path.join(__dirname, '../../../Data');
    }

    async ensureCategories() {
        const created = {};
        const slugs = Object.keys(CATEGORY_PATTERNS);

        for (let i = 0; i < slugs.length; i++) {
            const slug = slugs[i];
            const info = CATEGORY_PATTERNS[slug];

            let parent = await Category.findOne({ name: info.name });
            if (!parent) {
                parent = await Category.create({
                    name: info.name,
                    parent: null,
                    sort_order: i
                });
            }
            created[info.name] = parent;

            const subKeys = Object.keys(info.subcategories);
            for (let j = 0; j < subKeys.length; j++) {
                const subName = subKeys[j];
                let child = await Category.findOne({ name: subName });
                if (!child) {
                    child = await Category.create({
                        name: subName,
                        parent: parent._id,
                        sort_order: j
                    });
                }
                created[subName] = child;
            }
        }
        return created;
    }

    async ensureAggregator(name) {
        const colors = {
            'glovo': '#00A082',
            'arbuz': '#1DB954',
            'wolt': '#009DE0',
            'yandex': '#FFCC00',
            'magnum_almaty': '#E31837',
            'magnum_astana': '#E31837',
            'airba': '#FF6B00',
        };

        const displayNames = {
            'glovo': 'Glovo',
            'arbuz': 'Arbuz.kz',
            'wolt': 'Wolt',
            'yandex': 'Yandex Lavka',
            'magnum_almaty': 'Magnum',
            'magnum_astana': 'Magnum',
            'airba': 'Airba Fresh',
        };

        const displayName = displayNames[name] || name.charAt(0).toUpperCase() + name.slice(1);

        let agg = await Aggregator.findOne({ name: displayName });
        if (!agg) {
            agg = await Aggregator.create({
                name: displayName,
                color: colors[name] || '#666666',
                is_our_company: false // Manual override needed if one of them is ours
            });
        }
        return agg;
    }

    async ensureCity(slug) {
        if (!slug) return null;
        slug = slug.toLowerCase().trim();
        if (slug.includes('almaty') || slug.includes('ala')) slug = 'almaty';
        else if (slug.includes('astana') || slug.includes('nqz')) slug = 'astana';

        const names = {
            'almaty': 'Алматы',
            'astana': 'Астана',
            'shymkent': 'Шымкент'
        };

        let city = await City.findOne({ slug });
        if (!city) {
            city = await City.create({
                slug,
                name: names[slug] || slug.charAt(0).toUpperCase() + slug.slice(1)
            });
        }
        return city;
    }

    extractWeight(data) {
        const title = data.title || data.name || data.product_name || "";
        let multiplier = 1;

        const mulMatch = title.match(/(?:^|\s)(\d+)\s*[xхXХ]\s+/);
        if (mulMatch) {
            multiplier = parseFloat(mulMatch[1]);
        }

        const fields = ['title', 'name', 'product_name', 'measure', 'weight', 'volume', 'unitInfo', 'unit_info'];

        for (const field of fields) {
            const val = data[field];
            if (val) {
                // Regex for "500g", "1l", "1 pcs" - standardized units
                const match = String(val).toLowerCase().match(/(\d+[.,]?\d*)\s*(г|кг|л|мл|g|kg|l|ml|шт|pcs)\b/);
                if (match) {
                    let value = parseFloat(match[1].replace(',', '.'));
                    let unit = match[2];

                    const unitMap = { 'г': 'g', 'кг': 'kg', 'л': 'l', 'мл': 'ml', 'шт': 'pcs' };
                    unit = unitMap[unit] || unit;

                    return { value: value * multiplier, unit };
                }
            }
        }
        return { value: null, unit: null };
    }

    normalizeText(text) {
        return text ? text.toLowerCase().trim() : "";
    }

    detectCategory(data) {
        const fields = [
            { text: data.title || data.name || data.product_name, weight: 10 },
            { text: data.brand, weight: 2 },
            { text: data.categoryName || data.sub_category || data.category_full_path, weight: 5 }
        ];

        const catScores = {};

        for (const [slug, info] of Object.entries(CATEGORY_PATTERNS)) {
            let score = 0;
            for (const field of fields) {
                if (!field.text) continue;
                const text = this.normalizeText(field.text);

                for (const pattern of info.patterns) {
                    try {
                        // Regex to match whole word or suffix for cyrillic
                        const isAscii = /^[\x00-\x7F]*$/.test(pattern);
                        let regex;
                        if (isAscii) {
                            regex = new RegExp(`\\b${pattern}\\b`, 'i');
                        } else {
                            regex = new RegExp(`\\b${pattern}[а-яё]*\\b`, 'i');
                        }

                        if (regex.test(text)) {
                            if ((pattern === 'cola' || pattern === 'кола') &&
                                (text.includes('шоколад') || text.includes('рукола'))) {
                                continue;
                            }
                            score += field.weight;
                            break;
                        }
                    } catch (e) {
                        // Ignore invalid regex
                    }
                }
            }
            if (score > 0) catScores[slug] = score;
        }

        if (Object.keys(catScores).length === 0) return null;

        const detectedSlug = Object.keys(catScores).reduce((a, b) => catScores[a] > catScores[b] ? a : b);
        const info = CATEGORY_PATTERNS[detectedSlug];

        // Subcategory detection
        const subScores = {};
        for (const [subName, patterns] of Object.entries(info.subcategories)) {
            if (!patterns || patterns.length === 0) continue;
            let score = 0;

            for (const field of fields) {
                if (!field.text) continue;
                const text = this.normalizeText(field.text);

                for (const pattern of patterns) {
                    try {
                        const isAscii = /^[\x00-\x7F]*$/.test(pattern);
                        let regex;
                        if (isAscii) {
                            regex = new RegExp(`\\b${pattern}\\b`, 'i');
                        } else {
                            regex = new RegExp(`\\b${pattern}[а-яё]*\\b`, 'i');
                        }

                        if (regex.test(text)) {
                            if ((pattern === 'cola' || pattern === 'кола') &&
                                (text.includes('шоколад') || text.includes('рукола'))) {
                                continue;
                            }
                            score += field.weight;
                            break;
                        }
                    } catch (e) { }
                }
            }
            if (score > 0) subScores[subName] = score;
        }

        let subcategory = info.name; // Default to parent name if no sub match
        if (Object.keys(subScores).length > 0) {
            subcategory = Object.keys(subScores).reduce((a, b) => subScores[a] > subScores[b] ? a : b);
        } else {
            // Use default subcategory (empty pattern one)
            const defaults = Object.keys(info.subcategories).filter(k => info.subcategories[k].length === 0);
            if (defaults.length > 0) subcategory = defaults[0];
        }

        return { slug: detectedSlug, parentName: info.name, subName: subcategory };
    }

    async run(jobId) {
        if (jobId) {
            this.jobId = jobId;
            await ImportJob.findByIdAndUpdate(jobId, { status: 'processing' });
        }

        const categoryObjects = await this.ensureCategories();

        for (const [aggSlug, filename] of Object.entries(AGGREGATOR_FILES)) {
            const filePath = path.join(this.dataPath, filename);
            if (!fs.existsSync(filePath)) {
                this.errors.push(`File not found: ${filename}`);
                continue;
            }

            const aggregator = await this.ensureAggregator(aggSlug);
            console.log(`Processing ${filename}...`);

            try {
                const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                const items = Array.isArray(data) ? data : [data];

                for (const item of items) {
                    const detection = this.detectCategory(item);
                    if (!detection) {
                        this.stats.skipped++;
                        continue;
                    }

                    this.stats.matched++;

                    // Parse Product
                    const title = item.title || item.name || item.product_name;
                    if (!title) continue;

                    const brand = item.brand;
                    const { value: weightValue, unit: weightUnit } = this.extractWeight(item);

                    const imageUrl = item.url_picture || item.image || item.imageUrl || (item.images && item.images[0]?.url);
                    const externalUrl = item.url || item.productUrl;
                    const citySlug = item.city;

                    const priceVal = item.cost || item.price || item.priceActual;
                    const isAvailable = item.available ?? item.inStock ?? true;

                    // Categories
                    const category = categoryObjects[detection.subName] || categoryObjects[detection.parentName];

                    // DB Upsert Product
                    // We match products by Name mainly. 
                    let product = await Product.findOne({ name: title });
                    if (!product) {
                        product = await Product.create({
                            name: title,
                            category: category._id,
                            brand: brand,
                            weight_value: weightValue,
                            weight_unit: weightUnit,
                            image_url: imageUrl
                        });
                    } else {
                        // Update existing if needed?
                        if (!product.category) {
                            product.category = category._id;
                            await product.save();
                        }
                    }

                    // DB Upsert Price
                    const city = await this.ensureCity(citySlug);
                    if (priceVal) {
                        await Price.findOneAndUpdate(
                            { product: product._id, aggregator: aggregator._id, city: city ? city._id : null },
                            {
                                price: parseFloat(priceVal),
                                is_available: isAvailable,
                                last_updated: new Date()
                            },
                            { upsert: true, new: true }
                        );
                    }

                    // DB Upsert Link
                    if (externalUrl) {
                        await ProductLink.findOneAndUpdate(
                            { product: product._id, aggregator: aggregator._id },
                            { url: externalUrl, external_name: title, is_verified: true },
                            { upsert: true }
                        );
                    }

                    this.stats.imported++;
                }

            } catch (e) {
                this.stats.errors++;
                this.errors.push(`Error processing ${filename}: ${e.message}`);
                console.error(e);
            }
        }

        if (this.jobId) {
            await ImportJob.findByIdAndUpdate(this.jobId, {
                status: this.errors.length > 0 ? 'completed_with_errors' : 'completed',
                processed_rows: this.stats.imported + this.stats.skipped,
                success_count: this.stats.imported,
                error_count: this.stats.errors,
                error_details: this.errors,
                completed_at: new Date()
            });
        }

        return { stats: this.stats, errors: this.errors };
    }
}

module.exports = new Importer();
