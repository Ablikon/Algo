const axios = require('axios');
const Aggregator = require('../models/Aggregator');
const Product = require('../models/Product');
const Price = require('../models/Price');
const Category = require('../models/Category');
const ImportJob = require('../models/ImportJob');

// Mapping of mercant_name / file patterns to proper aggregator names
const AGGREGATOR_MAPPING = {
    'mag-ala': 'Magnum',
    'mag-ast': 'Magnum',
    'magnum': 'Magnum',
    'air-ala': 'Airba Fresh',
    'air-ast': 'Airba Fresh',
    'airba': 'Airba Fresh',
    'airba_fresh': 'Airba Fresh',
    'arb-ala': 'Arbuz.kz',
    'arb-ast': 'Arbuz.kz',
    'arbuz': 'Arbuz.kz',
    'arbuz_kz': 'Arbuz.kz',
    'wolt': 'Wolt',
    'wolt_market': 'Wolt',
    'wolt_wolt': 'Wolt',
    'yandex': 'Yandex Lavka',
    'yandex_lavka': 'Yandex Lavka',
    'glovo': 'Glovo',
    'ryadom': 'Рядом'
};

// Yandex Lavka category slug → human-readable name
const YANDEX_CATEGORY_MAP = {
    'all_ready_meals': 'Готовая еда',
    'appetizers_and_pates': 'Закуски и паштеты',
    'baked_products': 'Выпечка',
    'batteries_and_bulbs': 'Батарейки и лампочки',
    'beer': 'Пиво',
    'bread': 'Хлеб',
    'breakfast_cereals_and_porridges': 'Каши и хлопья',
    'cakes_cookies_waffles': 'Торты, печенье, вафли',
    'candy_and_gum': 'Конфеты и жвачка',
    'cashback_and_discounts': 'Скидки',
    'cheeses': 'Сыры',
    'chocolates_candies': 'Шоколад и конфеты',
    'coffee_and_cocoa': 'Кофе и какао',
    'coffee_and_pastries': 'Кофе и выпечка',
    'cooking_and_storing': 'Для готовки и хранения',
    'dairy_national': 'Молочные продукты',
    'desserts': 'Десерты',
    'dried_fruits_and_nuts': 'Сухофрукты и орехи',
    'dumplings': 'Пельмени и вареники',
    'eggs': 'Яйца',
    'energy_drinks': 'Энергетики',
    'fish_and_seafood': 'Рыба и морепродукты',
    'fresh_vegetables': 'Свежие овощи',
    'fresh_fruits': 'Свежие фрукты',
    'frozen_fruits_and_berries': 'Замороженные фрукты и ягоды',
    'frozen_vegetables': 'Замороженные овощи',
    'grain_and_pasta': 'Крупы и макароны',
    'greenery': 'Зелень',
    'healthy_food': 'Здоровое питание',
    'household_chemicals': 'Бытовая химия',
    'ice_cream': 'Мороженое',
    'juices_and_drinks': 'Соки и напитки',
    'ketchup_and_sauces': 'Кетчуп и соусы',
    'marshmallows_marmalade': 'Зефир и мармелад',
    'meat': 'Мясо',
    'milk_and_cream': 'Молоко и сливки',
    'mushrooms': 'Грибы',
    'oil_and_vinegar': 'Масло и уксус',
    'paper_products': 'Бумажная продукция',
    'personal_hygiene': 'Личная гигиена',
    'pet_food': 'Товары для животных',
    'pickled_and_canned': 'Соленья и консервы',
    'pizza': 'Пицца',
    'poultry': 'Птица',
    'ready_to_eat': 'Готовая еда',
    'sausages_and_deli': 'Колбасы и деликатесы',
    'snacks': 'Снеки',
    'sour_cream': 'Сметана',
    'sweet_spreads': 'Сладкие намазки',
    'tea': 'Чай',
    'water': 'Вода',
    'yogurt_and_cottage_cheese': 'Йогурты и творог',
    'baby_food': 'Детское питание',
    'butter_and_margarine': 'Масло и маргарин',
    'canned_food': 'Консервы',
    'chips_and_crackers': 'Чипсы и крекеры',
    'cleaning_products': 'Чистящие средства',
    'condiments': 'Приправы',
    'detergents': 'Моющие средства',
    'flour_and_baking': 'Мука и для выпечки',
    'honey_and_jam': 'Мёд и варенье',
    'kvass_and_kombucha': 'Квас и комбуча',
    'lemonade': 'Лимонады',
    'non_alcoholic_beer': 'Безалкогольное пиво',
    'soda': 'Газированные напитки',
    'sugar_and_salt': 'Сахар и соль',
    'wine': 'Вино'
};

// Aggregator colors
const AGGREGATOR_COLORS = {
    'Magnum': '#E31837',
    'Airba Fresh': '#78B833',
    'Arbuz.kz': '#00C2E8',
    'Wolt': '#00C2E8',
    'Yandex Lavka': '#FFCC00',
    'Glovo': '#00A082',
    'Рядом': '#FF7F00'
};

class ApiSyncService {
    constructor() {
        this.baseUrl = process.env.EXTERNAL_API_BASE;
        this.token = process.env.EXTERNAL_API_TOKEN;
        this.isSyncing = false;
        this.currentJob = null;
        this.progress = {
            status: 'idle',
            currentFile: null,
            filesProcessed: 0,
            totalFiles: 0,
            recordsProcessed: 0,
            totalRecords: 0
        };
        
        this.client = axios.create({
            baseURL: this.baseUrl,
            headers: { 'Authorization': `Bearer ${this.token}` },
            timeout: 120000 // 2 minutes timeout
        });
    }

    getProgress() {
        return this.progress;
    }

    resolveAggregatorName(mercantName, fileId) {
        // Try mercant_name first
        const lowerMercant = (mercantName || '').toLowerCase();
        for (const [key, value] of Object.entries(AGGREGATOR_MAPPING)) {
            if (lowerMercant.includes(key)) {
                return value;
            }
        }
        
        // Try file ID
        const lowerFileId = (fileId || '').toLowerCase();
        for (const [key, value] of Object.entries(AGGREGATOR_MAPPING)) {
            if (lowerFileId.includes(key)) {
                return value;
            }
        }
        
        // Default - extract from file name
        const parts = fileId.split('_');
        if (parts.length > 0) {
            return parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
        }
        
        return 'Unknown';
    }

    extractCity(fileId, record) {
        // Extract city from file ID or record
        const lowerFileId = (fileId || '').toLowerCase();
        if (lowerFileId.includes('almaty') || record?.city === 'almaty') {
            return 'almaty';
        }
        if (lowerFileId.includes('astana') || record?.city === 'astana') {
            return 'astana';
        }
        return null;
    }

    async syncAllFiles() {
        if (this.isSyncing) {
            console.log('Sync already in progress');
            return { status: 'already_running' };
        }

        this.isSyncing = true;
        this.progress = {
            status: 'starting',
            currentFile: null,
            filesProcessed: 0,
            totalFiles: 0,
            recordsProcessed: 0,
            totalRecords: 0
        };

        console.log('========================================');
        console.log('STARTING FULL SYNC FROM EXTERNAL API');
        console.log('========================================');

        // Create job record
        this.currentJob = await ImportJob.create({
            job_type: 'full_sync',
            status: 'processing',
            file_name: 'Full External API Sync'
        });

        try {
            // Get list of all files
            const filesResponse = await this.client.get('/api/reverse-files');
            const files = filesResponse.data.files || [];
            
            // Новый API: все файлы из reverse-files (id без _mapped)
            const mappedFiles = files;
            
            this.progress.totalFiles = mappedFiles.length;
            this.progress.status = 'fetching';
            
            console.log(`Found ${mappedFiles.length} mapped files to process`);

            let totalRecordsProcessed = 0;

            for (let i = 0; i < mappedFiles.length; i++) {
                const file = mappedFiles[i];
                this.progress.currentFile = file.id;
                this.progress.filesProcessed = i;
                
                console.log(`\n[${i + 1}/${mappedFiles.length}] Processing: ${file.id}`);
                
                const recordsCount = await this.processFile(file.id);
                totalRecordsProcessed += recordsCount;
                
                this.progress.recordsProcessed = totalRecordsProcessed;
                
                // Update job
                await ImportJob.findByIdAndUpdate(this.currentJob._id, {
                    processed_rows: totalRecordsProcessed,
                    error_details: `Processing ${file.id}`
                });
            }

            // Complete
            this.progress.status = 'completed';
            this.progress.filesProcessed = mappedFiles.length;
            
            await ImportJob.findByIdAndUpdate(this.currentJob._id, {
                status: 'completed',
                processed_rows: totalRecordsProcessed,
                completed_at: new Date()
            });

            console.log('\n========================================');
            console.log(`SYNC COMPLETE! Total records: ${totalRecordsProcessed}`);
            console.log('========================================');

            return {
                status: 'completed',
                totalFiles: mappedFiles.length,
                totalRecords: totalRecordsProcessed
            };

        } catch (err) {
            console.error('SYNC FAILED:', err.message);
            this.progress.status = 'failed';
            this.progress.error = err.message;
            
            await ImportJob.findByIdAndUpdate(this.currentJob._id, {
                status: 'failed',
                error_details: err.message
            });

            return { status: 'failed', error: err.message };
        } finally {
            this.isSyncing = false;
        }
    }

    async processFile(fileId) {
        try {
            console.log(`  Fetching ${fileId}...`);
            // API: GET /api/csv-data/:filename → { success, data: [...] }
            const response = await this.client.get(`/api/csv-data/${fileId}_mapped`);
            const records = response.data.data || [];
            
            if (records.length === 0) {
                console.log(`  No records in ${fileId}`);
                return 0;
            }

            console.log(`  Found ${records.length} records`);
            
            // Логирование образцов
            console.log('  📝 Sample records:');
            records.slice(0, 3).forEach((rec, idx) => {
                console.log(`    ${idx + 1}. Title: ${rec.title || 'NO TITLE'}, URL: ${rec.url ? 'YES' : 'NO'}, Cost: ${rec.cost || rec.price || 'NO PRICE'}`);
            });

            // Один файл = один агрегатор + город
            const sampleRecord = records[0];
            const aggregatorName = this.resolveAggregatorName(
                sampleRecord.mercant_name || sampleRecord.market_name, 
                fileId
            );
            const citySlug = this.extractCity(fileId, sampleRecord);
            
            // Resolve city to ObjectId
            let city = null;
            if (citySlug) {
                const City = require('../models/City');
                city = await City.findOne({ slug: citySlug });
                if (!city) {
                    city = await City.create({ name: citySlug.charAt(0).toUpperCase() + citySlug.slice(1), slug: citySlug });
                    console.log(`    Created city: ${city.name} (${city._id})`);
                }
            }
            
            console.log(`  Aggregator: ${aggregatorName}, City: ${city ? city.name : 'all'}`);

            // Get or create aggregator
            const aggregator = await this.ensureAggregator(aggregatorName);

            // Process in batches
            const BATCH_SIZE = 500;
            let processedCount = 0;

            for (let i = 0; i < records.length; i += BATCH_SIZE) {
                const batch = records.slice(i, i + BATCH_SIZE);
                await this.processBatch(batch, aggregator, city ? city._id : null);
                processedCount += batch.length;
                
                if (i % 2000 === 0 && i > 0) {
                    console.log(`    Processed ${processedCount}/${records.length}`);
                }
            }

            console.log(`  ✓ Completed: ${records.length} records for ${aggregatorName}`);
            return records.length;

        } catch (err) {
            console.error(`  ✗ Error processing ${fileId}:`, err.message);
            return 0;
        }
    }

    async processBatch(records, aggregator, city) {
        const validRecords = [];

        // Helper to normalize names for matching (fallback for unmatched records)
        const normalizeName = (name) => {
            if (!name) return '';
            let s = name.toLowerCase();
            s = s.replace(/<[^>]+>/g, '');
            s = s.replace(/[«»""'']/g, '').replace(/[–—]/g, '-');
            s = s.replace(/(\d),(\d)/g, '$1.$2');
            s = s.replace(/\b\d+[.,]?\d*\s*(кг|г|гр|мл|л|шт|штук|упак|пак|уп)\b/gi, '');
            s = s.replace(/\b(кг|шт|штук|штука)\b/gi, '');
            s = s.replace(/~?\d+[.,]?\d*\s*(g|kg|ml|l|мл|г|кг|л|oz|lb)\b/gi, '');
            s = s.replace(/[^\wа-яёa-z0-9\s]/gi, '');
            s = s.replace(/\s+/g, ' ').trim();
            return s;
        };

        // Resolve category name helper
        const resolveCategory = (catName) => {
            if (!catName) return null;
            if (catName.startsWith('Publication ') || /^[a-f0-9]{20,}$/i.test(catName)) return null;
            if (catName.includes(' > ')) {
                const parts = catName.split(' > ').map(p => p.trim()).filter(Boolean);
                return parts[parts.length - 1] || null;
            }
            if (YANDEX_CATEGORY_MAP[catName]) return YANDEX_CATEGORY_MAP[catName];
            if (/^[a-z_]+$/.test(catName)) return catName.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
            return catName;
        };

        // First pass: validate records, collect categories and grouping keys
        const categoryNames = new Set();
        const csvNames = new Set();         // csv_name values for matched records
        const normalizedNames = new Set();  // fallback for unmatched records
        
        for (const record of records) {
            const title = record.title;
            if (!title) continue;
            
            const price = parseFloat(record.cost || record.price);
            if (!price || isNaN(price)) continue;
            
            validRecords.push(record);
            
            // Collect grouping keys
            const isMatched = record.match === true && record.csv_name && record.csv_name.trim() !== '';
            if (isMatched) {
                csvNames.add(record.csv_name.trim());
            } else {
                const norm = normalizeName(title);
                if (norm) normalizedNames.add(norm);
            }
            
            const catResolved = resolveCategory(record.category_full_path || record.category || '');
            if (catResolved) categoryNames.add(catResolved);
        }

        if (validRecords.length === 0) return;

        // Batch load/create categories
        const categoryMap = new Map();
        if (categoryNames.size > 0) {
            const catArr = [...categoryNames];
            const existingCats = await Category.find({ name: { $in: catArr } }).lean();
            existingCats.forEach(c => categoryMap.set(c.name, c._id));
            
            const missing = catArr.filter(n => !categoryMap.has(n));
            if (missing.length > 0) {
                const newCats = await Category.insertMany(
                    missing.map(n => ({ name: n, icon: '📦' })),
                    { ordered: false }
                ).catch(() => []);
                for (const c of newCats) categoryMap.set(c.name, c._id);
                if (newCats.length < missing.length) {
                    const refetched = await Category.find({ name: { $in: missing } }).lean();
                    refetched.forEach(c => categoryMap.set(c.name, c._id));
                }
            }
        }

        // Load existing products by grouping_id (csv_name) AND by normalized_name (fallback)
        const csvNameArr = [...csvNames];
        const normalizedArr = [...normalizedNames];
        
        const [productsByCsvName, productsByNorm] = await Promise.all([
            csvNameArr.length > 0
                ? Product.find({ grouping_id: { $in: csvNameArr } }).select('_id grouping_id').lean()
                : [],
            normalizedArr.length > 0
                ? Product.find({ normalized_name: { $in: normalizedArr } }).select('_id normalized_name').lean()
                : []
        ]);
        
        const groupingIdToProduct = new Map();
        productsByCsvName.forEach(p => { if (p.grouping_id) groupingIdToProduct.set(p.grouping_id, p._id); });
        
        const normNameToProduct = new Map();
        productsByNorm.forEach(p => { if (p.normalized_name) normNameToProduct.set(p.normalized_name, p._id); });

        // Upsert products: matched records use grouping_id=csv_name, unmatched use normalized_name
        const productOps = [];
        const seenGroupingIds = new Set();
        const seenNormNames = new Set();
        
        for (const record of validRecords) {
            const title = record.title;
            const isMatched = record.match === true && record.csv_name && record.csv_name.trim() !== '';
            const catResolved = resolveCategory(record.category_full_path || record.category || '');
            const categoryId = catResolved ? categoryMap.get(catResolved) : null;

            if (isMatched) {
                const csvName = record.csv_name.trim();
                // Only one upsert per csv_name per batch (the first one sets the name)
                if (seenGroupingIds.has(csvName)) continue;
                seenGroupingIds.add(csvName);

                const productUpdate = {
                    name: csvName,  // Use csv_name as canonical product name
                    grouping_id: csvName,
                    normalized_name: normalizeName(csvName),
                    brand: record.csv_brand || record.brand || null,
                    image_url: record.url_picture || null
                };
                if (categoryId) productUpdate.category = categoryId;

                productOps.push({
                    updateOne: {
                        filter: { grouping_id: csvName },
                        update: { $set: productUpdate },
                        upsert: true
                    }
                });
            } else {
                const normalizedTitle = normalizeName(title);
                if (!normalizedTitle) continue;
                if (seenNormNames.has(normalizedTitle)) continue;
                seenNormNames.add(normalizedTitle);

                const productUpdate = {
                    name: title,
                    normalized_name: normalizedTitle,
                    brand: record.brand || null,
                    image_url: record.url_picture || null,
                    sku: record.product_id || record.id || null
                };
                if (categoryId) productUpdate.category = categoryId;

                productOps.push({
                    updateOne: {
                        filter: { normalized_name: normalizedTitle },
                        update: { $set: productUpdate },
                        upsert: true
                    }
                });
            }
        }

        if (productOps.length > 0) {
            await Product.bulkWrite(productOps, { ordered: false });
        }

        // Reload products after upsert
        const [reloadedByCsv, reloadedByNorm] = await Promise.all([
            csvNameArr.length > 0
                ? Product.find({ grouping_id: { $in: csvNameArr } }).select('_id grouping_id').lean()
                : [],
            normalizedArr.length > 0
                ? Product.find({ normalized_name: { $in: normalizedArr } }).select('_id normalized_name').lean()
                : []
        ]);
        
        const productLookupByCsv = new Map();
        reloadedByCsv.forEach(p => { if (p.grouping_id) productLookupByCsv.set(p.grouping_id, p._id); });
        
        const productLookupByNorm = new Map();
        reloadedByNorm.forEach(p => { if (p.normalized_name) productLookupByNorm.set(p.normalized_name, p._id); });

        // Create price operations — each record gets its own price
        const priceOps = [];
        let urlStats = { withUrl: 0, withoutUrl: 0 };
        let matchStats = { matched: 0, unmatched: 0, notFound: 0 };
        
        for (const record of validRecords) {
            const price = parseFloat(record.cost || record.price);
            const isMatched = record.match === true && record.csv_name && record.csv_name.trim() !== '';
            
            let productId = null;
            if (isMatched) {
                productId = productLookupByCsv.get(record.csv_name.trim());
                if (productId) matchStats.matched++;
            } else {
                productId = productLookupByNorm.get(normalizeName(record.title));
                if (productId) matchStats.unmatched++;
            }
            
            if (!productId) {
                matchStats.notFound++;
                continue;
            }

            // Build URL
            let productUrl = null;
            if (record.url && typeof record.url === 'string' && record.url.trim() !== '') {
                productUrl = record.url.trim();
                urlStats.withUrl++;
            } else {
                urlStats.withoutUrl++;
                const aggName = aggregator.name;
                const title = record.title || '';
                if (title && aggName !== 'Magnum') {
                    if (aggName === 'Airba Fresh' || aggName === 'Wolt') {
                        productUrl = `https://wolt.com/kz/kaz/search?q=${encodeURIComponent(title)}`;
                    } else if (aggName === 'Arbuz.kz') {
                        productUrl = `https://arbuz.kz/ru/search?q=${encodeURIComponent(title)}`;
                    }
                }
            }

            priceOps.push({
                updateOne: {
                    filter: { product: productId, aggregator: aggregator._id, city: city || null },
                    update: {
                        $set: {
                            price: price,
                            is_available: record.available !== false,
                            competitor_brand: record.brand || null,
                            product_url: productUrl
                        },
                        $currentDate: { last_updated: true }
                    },
                    upsert: true
                }
            });
        }

        // Execute price upserts
        if (priceOps.length > 0) {
            const result = await Price.bulkWrite(priceOps, { ordered: false });
            const modified = result.modifiedCount || 0;
            const inserted = result.upsertedCount || 0;
            console.log(`  💾 Price: ${modified} modified, ${inserted} inserted (ops: ${priceOps.length})`);
        }
        
        console.log(`  🔗 URLs: ${urlStats.withUrl} with, ${urlStats.withoutUrl} without`);
        console.log(`  🏷️  Mapped (csv_name): ${matchStats.matched}, Unmapped: ${matchStats.unmatched}, Not found: ${matchStats.notFound}`);
        
        // Save product links (per aggregator — keeps the original name and URL)
        const ProductLink = require('../models/ProductLink');
        const linkOps = [];
        for (const record of validRecords) {
            if (!record.url || record.url === '') continue;
            
            const isMatched = record.match === true && record.csv_name && record.csv_name.trim() !== '';
            let productId = isMatched
                ? productLookupByCsv.get(record.csv_name.trim())
                : productLookupByNorm.get(normalizeName(record.title));
            if (!productId) continue;

            linkOps.push({
                updateOne: {
                    filter: { product: productId, aggregator: aggregator._id },
                    update: {
                        $set: {
                            url: record.url,
                            external_name: record.title || null
                        }
                    },
                    upsert: true
                }
            });
        }

        if (linkOps.length > 0) {
            await ProductLink.bulkWrite(linkOps, { ordered: false });
            console.log(`    Saved ${linkOps.length} product links`);
        }
    }

    async ensureAggregator(name) {
        let aggregator = await Aggregator.findOne({ name });
        
        if (!aggregator) {
            aggregator = await Aggregator.create({
                name,
                color: AGGREGATOR_COLORS[name] || '#' + Math.floor(Math.random()*16777215).toString(16),
                is_our_company: name === 'Рядом' || name === process.env.OUR_COMPANY_AGGREGATOR
            });
            console.log(`    Created new aggregator: ${name}`);
        }
        
        return aggregator;
    }

    async ensureCategory(categoryPath) {
        try {
            // Parse category path like "Продукты питания > Молочные продукты, яйца > Молоко, сливки"
            const parts = categoryPath.split(' > ').map(p => p.trim()).filter(p => p.length > 0);
            
            if (parts.length === 0) return null;

            // Use the last (most specific) category
            const categoryName = parts[parts.length - 1];
            
            // Skip technical categories
            if (/^Publication \d+$/.test(categoryName) || /^[a-f0-9]{20,}$/i.test(categoryName)) {
                return null;
            }
            
            // First try to find existing category (case-insensitive)
            let category = await Category.findOne({ 
                name: { $regex: new RegExp(`^${categoryName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
            });
            
            if (!category) {
                // Try to find a parent category based on the path
                let parentId = null;
                
                // Map common category paths to parent categories
                const categoryMappings = {
                    'Газированные напитки': 'Напитки',
                    'Соки': 'Напитки',
                    'Вода': 'Напитки',
                    'Холодные чаи': 'Напитки',
                    'Энергетики': 'Напитки',
                    'Молоко': 'Молочные продукты',
                    'Йогурт': 'Молочные продукты',
                    'Кефир': 'Молочные продукты',
                    'Сыр': 'Сыры',
                    'Чипсы': 'Снеки',
                    'Сухарики': 'Снеки',
                    'Орехи': 'Бакалея',
                    'Шоколад': 'Кондитерские изделия',
                    'Печенье': 'Кондитерские изделия',
                    'Конфеты': 'Кондитерские изделия',
                    'Колбаса': 'Мясные изделия',
                    'Сосиски': 'Мясные изделия'
                };
                
                // Try to find parent based on category name keywords
                for (const [keyword, parentName] of Object.entries(categoryMappings)) {
                    if (categoryName.toLowerCase().includes(keyword.toLowerCase())) {
                        const parent = await Category.findOne({ name: parentName, parent: null });
                        if (parent) {
                            parentId = parent._id;
                            break;
                        }
                    }
                }
                
                // Create the category
                category = await Category.create({
                    name: categoryName,
                    parent: parentId,
                    icon: '📦'
                });
            }
            
            return category._id;
        } catch (err) {
            console.error('ensureCategory error:', err.message);
            return null;
        }
    }

    // Legacy method name
    async syncMappedFiles() {
        return this.syncAllFiles();
    }
}

module.exports = new ApiSyncService();
