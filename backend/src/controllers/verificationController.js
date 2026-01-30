const axios = require('axios');
const Product = require('../models/Product');
const Price = require('../models/Price');
const Aggregator = require('../models/Aggregator');

// External API client
const externalApi = axios.create({
    baseURL: process.env.EXTERNAL_API_BASE || 'http://94.131.88.146',
    headers: { 'Authorization': `Bearer ${process.env.EXTERNAL_API_TOKEN}` },
    timeout: 60000
});

// OpenAI client
const openaiApi = axios.create({
    baseURL: 'https://api.openai.com/v1',
    headers: { 
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
    },
    timeout: 60000
});

const STOP_WORDS = new Set([
    'и', 'с', 'по', 'для', 'от', 'на', 'в', 'из', 'the', 'and', 'with', 'for'
]);
const MAX_CANDIDATES = 12;
const GPT_BATCH_SIZE = 10;
const GPT_PARALLEL_LIMIT = 2;

// Transliteration map EN ↔ RU (common brand names)
const TRANSLIT_MAP = {
    'a': 'а', 'b': 'б', 'c': 'к', 'd': 'д', 'e': 'е', 'f': 'ф', 'g': 'г',
    'h': 'х', 'i': 'и', 'j': 'дж', 'k': 'к', 'l': 'л', 'm': 'м', 'n': 'н',
    'o': 'о', 'p': 'п', 'q': 'к', 'r': 'р', 's': 'с', 't': 'т', 'u': 'у',
    'v': 'в', 'w': 'в', 'x': 'кс', 'y': 'й', 'z': 'з'
};

// Kazakh ↔ Russian letter mapping
const KZ_RU_MAP = {
    'ә': 'а', 'ғ': 'г', 'қ': 'к', 'ң': 'н', 'ө': 'о', 'ұ': 'у', 'ү': 'у', 'һ': 'х', 'і': 'и'
};

// Known brand transliterations (EN: RU)
const BRAND_TRANSLATIONS = {
    'amiran': 'амиран',
    'alsad': 'алсад',
    'borjomi': 'боржоми',
    'lactel': 'лактель',
    'danone': 'данон',
    'nestle': 'нестле',
    'nescafe': 'нескафе',
    'coca-cola': 'кока-кола',
    'pepsi': 'пепси',
    'lipton': 'липтон',
    'ahmad': 'ахмад',
    'heinz': 'хайнц',
    'barilla': 'барилла',
    'president': 'президент',
    'activia': 'активиа',
    'actimel': 'актимель',
    'bonduelle': 'бондюэль',
    'foodmaster': 'фудмастер',
    'food master': 'фудмастер',
    'ritter sport': 'риттер спорт',
    'makarena': 'макарена',
    'yokosun': 'йокосан',
    'adal': 'адаль'
};

// Product type words that should be stripped from brand names
const PRODUCT_WORDS = new Set([
    'молоко', 'кефир', 'сливки', 'сметана', 'творог', 'йогурт', 'масло',
    'сыр', 'хлеб', 'вода', 'сок', 'чай', 'кофе', 'пиво', 'вино',
    'мясо', 'колбаса', 'рыба', 'яйца', 'яйцо', 'шоколад', 'конфеты',
    'печенье', 'торт', 'мука', 'крупа', 'рис', 'макароны', 'соус'
]);

/**
 * Mapping verification for API files (NEW FORMAT)
 * 
 * New API format:
 * - csv_name, csv_brand, csv_weight: OUR product (Рядом)
 * - title, brand, cost: AGGREGATOR product (only when match=true)
 * - match, match_confidence: existing mapping status
 * 
 * Modes:
 * - verify_existing (default): Verify existing matches (csv_name vs title)
 * - find_new: Find matches for unmatched records using GPT
 */
exports.reviewMappedFromApi = async (req, res) => {
    try {
        const fileId = req.query.file_id;
        const limit = Math.min(parseInt(req.query.limit) || 50, 500);
        const offset = parseInt(req.query.offset) || 0;
        const mode = req.query.mode || 'verify_existing';

        if (!fileId) {
            return res.status(400).json({ 
                error: 'file_id is required',
                available_files: await getAvailableFiles()
            });
        }

        console.log(`[Mapping Review] Starting: file=${fileId}, limit=${limit}, offset=${offset}, mode=${mode}`);
        const startTime = Date.now();

        // Fetch API file data
        const response = await externalApi.get(`/api/csv-data/${fileId}`);
        const apiRecords = response.data.data || [];

        if (apiRecords.length === 0) {
            return res.json({
                summary: { total: 0, correct: 0, needs_review: 0, likely_wrong: 0, not_found: 0 },
                results: [],
                file_info: { id: fileId, records_count: 0 }
            });
        }

        console.log(`[Mapping Review] API file has ${apiRecords.length} records`);

        let results = [];
        let summary = {};

        if (mode === 'verify_existing') {
            // Mode 1: Verify existing matches (csv_name vs title)
            const matchedRecords = apiRecords.filter(r => r.match && r.title);
            const totalMatched = matchedRecords.length;
            const recordsToVerify = matchedRecords.slice(offset, offset + limit);
            
            console.log(`[Mapping Review] Verifying ${recordsToVerify.length} existing matches (total: ${totalMatched})`);
            
            for (const record of recordsToVerify) {
                const csvName = record.csv_name || '';
                const csvBrand = record.csv_brand || '';
                const aggTitle = record.title || '';
                const aggBrand = record.brand || '';
                const confidence = record.match_confidence || 0;
                
                const result = verifyExistingMatch(csvName, csvBrand, aggTitle, aggBrand, confidence);
                
                results.push({
                    source: {
                        title: csvName,
                        brand: csvBrand,
                        weight: record.csv_weight,
                        ntin: record.ntin
                    },
                    matched: {
                        name: aggTitle,
                        brand: aggBrand,
                        cost: record.cost,
                        category: record.category_full_path
                    },
                    verdict: result.verdict,
                    reason: result.reason,
                    original_confidence: confidence,
                    market_name: record.market_name
                });
            }
            
            summary = {
                total: apiRecords.length,
                total_matched: totalMatched,
                total_unmatched: apiRecords.length - totalMatched,
                processed: results.length,
                offset: offset,
                correct: results.filter(r => r.verdict === 'correct').length,
                needs_review: results.filter(r => r.verdict === 'needs_review').length,
                likely_wrong: results.filter(r => r.verdict === 'likely_wrong').length
            };
        } else {
            // Mode 2: Find new matches for unmatched records
            const ryadom = await Aggregator.findOne({ name: 'Рядом' });
            if (!ryadom) {
                return res.status(400).json({ error: 'Рядом aggregator not found. Load bq-results first.' });
            }

            const ourPrices = await Price.find({ aggregator: ryadom._id })
                .populate('product')
                .limit(30000);
            
            const ourProducts = ourPrices
                .filter(p => p.product)
                .map(p => ({
                    id: p.product._id.toString(),
                    name: p.product.name,
                    brand: p.product.brand || '',
                    category: p.product.category_name || ''
                }));

            console.log(`[Mapping Review] Loaded ${ourProducts.length} our products for matching`);

            // Filter unmatched records
            const unmatchedRecords = apiRecords.filter(r => !r.match);
            const totalUnmatched = unmatchedRecords.length;
            const recordsToProcess = unmatchedRecords.slice(offset, offset + limit);
            
            console.log(`[Mapping Review] Processing ${recordsToProcess.length} unmatched records (total: ${totalUnmatched})`);

            // Convert to format expected by processBatchWithGPT
            const recordsForGPT = recordsToProcess.map(r => ({
                title: r.csv_name || '',
                brand: r.csv_brand || '',
                weight: r.csv_weight || '',
                ntin: r.ntin,
                market_name: r.market_name
            }));

            const productIndex = buildProductIndex(ourProducts);

            const batches = [];
            for (let i = 0; i < recordsForGPT.length; i += GPT_BATCH_SIZE) {
                batches.push(recordsForGPT.slice(i, i + GPT_BATCH_SIZE));
            }

            for (let i = 0; i < batches.length; i += GPT_PARALLEL_LIMIT) {
                const batchGroup = batches.slice(i, i + GPT_PARALLEL_LIMIT);
                const batchResults = await Promise.all(
                    batchGroup.map(batch => processBatchWithGPT(batch, productIndex, ourProducts))
                );
                results.push(...batchResults.flat());
            }

            summary = {
                total: apiRecords.length,
                total_matched: apiRecords.length - totalUnmatched,
                total_unmatched: totalUnmatched,
                processed: results.length,
                offset: offset,
                correct: results.filter(r => r.verdict === 'correct').length,
                needs_review: results.filter(r => r.verdict === 'needs_review').length,
                likely_wrong: results.filter(r => r.verdict === 'likely_wrong').length,
                not_found: results.filter(r => r.verdict === 'not_found').length
            };
        }

        const processingTime = Date.now() - startTime;
        console.log(`[Mapping Review] Completed in ${processingTime}ms: ${JSON.stringify(summary)}`);

        res.json({
            summary,
            results,
            file_info: { id: fileId, records_count: apiRecords.length, market: apiRecords[0]?.market_name },
            processing_time_ms: processingTime
        });
    } catch (err) {
        console.error('[Mapping Review] Error:', err);
        res.status(500).json({ error: err.message });
    }
};

// Helper function for summary calculation (kept for compatibility)

/**
 * Build product index for fast matching
 */
function buildProductIndex(products) {
    const indexedProducts = products.map((p) => {
        const normalizedName = normalizeText(p.name);
        const normalizedBrand = normalizeText(p.brand || '');
        const tokens = new Set(extractTokens(`${p.brand || ''} ${p.name}`));
        const volumes = extractVolumes(p.name);
        const isBundle = detectBundle(p.name);
        
        return {
            ...p,
            normalizedName,
            normalizedBrand,
            tokens,
            volumes,
            volumesText: formatVolumes(volumes),
            isBundle
        };
    });

    const tokenIndex = new Map();
    indexedProducts.forEach((p, idx) => {
        p.tokens.forEach((token) => {
            if (!tokenIndex.has(token)) tokenIndex.set(token, new Set());
            tokenIndex.get(token).add(idx);
        });
    });

    return { products: indexedProducts, tokenIndex };
}

/**
 * Normalize text for comparison
 */
function normalizeText(text) {
    return (text || '')
        .toLowerCase()
        .replace(/[^\wа-яёәіңғүұқөһ\s]/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Normalize brand name for comparison (handles EN/RU/KZ)
 */
function normalizeBrand(brand) {
    if (!brand) return '';
    
    let normalized = brand.toLowerCase().trim();
    
    // Remove common suffixes
    normalized = normalized.replace(/\s*(llc|ltd|тм|tm|ооо|ао|зао|тоо)\.?$/i, '').trim();
    
    // Remove product type words from brand (e.g., "Сливки Adal" -> "Adal")
    const words = normalized.split(/\s+/);
    const filteredWords = words.filter(w => !PRODUCT_WORDS.has(w));
    if (filteredWords.length > 0 && filteredWords.length < words.length) {
        normalized = filteredWords.join(' ');
    }
    
    // Check known translations first
    if (BRAND_TRANSLATIONS[normalized]) {
        return BRAND_TRANSLATIONS[normalized];
    }
    
    // Also check partial matches in translations
    for (const [en, ru] of Object.entries(BRAND_TRANSLATIONS)) {
        if (normalized.includes(en)) {
            normalized = normalized.replace(en, ru);
        }
    }
    
    // Convert Kazakh letters to Russian
    for (const [kz, ru] of Object.entries(KZ_RU_MAP)) {
        normalized = normalized.replace(new RegExp(kz, 'g'), ru);
    }
    
    // If mostly latin, transliterate to cyrillic
    const latinCount = (normalized.match(/[a-z]/g) || []).length;
    const cyrillicCount = (normalized.match(/[а-яё]/g) || []).length;
    
    if (latinCount > cyrillicCount && latinCount > 2) {
        let transliterated = '';
        for (const char of normalized) {
            transliterated += TRANSLIT_MAP[char] || char;
        }
        normalized = transliterated;
    }
    
    // Remove special chars and extra spaces
    return normalized.replace(/[^а-яёa-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
}

/**
 * Check if two brands match (with transliteration)
 */
function brandsMatch(brand1, brand2) {
    if (!brand1 || !brand2) return true; // If either is empty, don't fail on brand
    
    const norm1 = normalizeBrand(brand1);
    const norm2 = normalizeBrand(brand2);
    
    if (!norm1 || !norm2) return true;
    
    // Exact match
    if (norm1 === norm2) return true;
    
    // One contains the other
    if (norm1.includes(norm2) || norm2.includes(norm1)) return true;
    
    // Check if any significant word matches (for multi-word brands)
    const words1 = norm1.split(/\s+/).filter(w => w.length > 3);
    const words2 = norm2.split(/\s+/).filter(w => w.length > 3);
    
    for (const w1 of words1) {
        for (const w2 of words2) {
            if (w1 === w2 || w1.includes(w2) || w2.includes(w1)) {
                return true;
            }
        }
    }
    
    // Check first 4 chars (for short brands)
    if (norm1.length >= 4 && norm2.length >= 4) {
        if (norm1.substring(0, 4) === norm2.substring(0, 4)) return true;
    }
    
    // Levenshtein-like: allow 1-2 char difference for brands > 4 chars
    if (norm1.length > 4 && norm2.length > 4) {
        let diff = 0;
        const shorter = norm1.length < norm2.length ? norm1 : norm2;
        const longer = norm1.length < norm2.length ? norm2 : norm1;
        
        for (let i = 0; i < shorter.length; i++) {
            if (shorter[i] !== longer[i]) diff++;
        }
        diff += longer.length - shorter.length;
        
        if (diff <= 2) return true;
    }
    
    return false;
}

function extractTokens(text) {
    const normalized = normalizeText(text);
    const tokens = normalized.split(/\s+/).filter((w) => w.length > 2 && !STOP_WORDS.has(w));
    return Array.from(new Set(tokens));
}

function detectBundle(text) {
    const normalized = normalizeText(text);
    return /(набор|комплект|сет|set|bundle|подароч|2в1|3в1|4в1|2 в 1|3 в 1|4 в 1)/i.test(normalized);
}

function normalizeVolume(value, unit) {
    const v = parseFloat(value.replace(',', '.'));
    const u = unit.toLowerCase();

    if (u === 'л' || u === 'l') return { val: v * 1000, unit: 'мл' };
    if (u === 'мл' || u === 'ml') return { val: v, unit: 'мл' };
    if (u === 'кг' || u === 'kg') return { val: v * 1000, unit: 'г' };
    if (u === 'г' || u === 'g' || u === 'гр' || u === 'gr') return { val: v, unit: 'г' };
    if (u === 'мг' || u === 'mg') return { val: v / 1000, unit: 'г' };
    // Normalize all piece variations to 'шт'
    if (u === 'шт' || u === 'штук' || u === 'штуки' || u === 'штука' || u === 'pcs' || u === 'pc') {
        return { val: v, unit: 'шт' };
    }
    return { val: v, unit: u };
}

function extractVolumes(text) {
    // Extended pattern to include "штук", "штуки"
    const volumePattern = /(\d+(?:[.,]\d+)?)\s*(мл|ml|л|l|г|g|гр|gr|кг|kg|шт|штук|штуки|штука|pcs|pc|мг|mg)/gi;
    const matches = [...(text || '').matchAll(volumePattern)];
    let volumes = matches.map((m) => normalizeVolume(m[1], m[2]));

    // Filter out invalid volumes
    volumes = volumes.filter((v) => Number.isFinite(v.val) && v.val > 0);
    
    // Special handling for eggs: if we have both "шт" and grams (50-80g per egg), ignore the gram weight
    const hasShт = volumes.some(v => v.unit === 'шт');
    const textLower = (text || '').toLowerCase();
    const isEggProduct = /яйц|яиц|egg/i.test(textLower);
    
    if (hasShт && isEggProduct) {
        // Remove individual egg weight (typically 50-80g)
        volumes = volumes.filter(v => !(v.unit === 'г' && v.val >= 40 && v.val <= 80));
    }
    
    // Sort for consistent comparison
    return volumes.sort((a, b) => (a.unit === b.unit ? a.val - b.val : a.unit.localeCompare(b.unit)));
}

function formatVolumes(volumes) {
    if (!volumes || volumes.length === 0) return 'N/A';
    return volumes.map((v) => `${v.val}${v.unit}`).join(', ');
}

function buildApiInfo(record) {
    const title = record.title || record.name || '';
    const brand = record.brand || '';
    const tokens = new Set(extractTokens(`${brand} ${title}`));
    const volumes = extractVolumes(title);
    const isBundle = detectBundle(title);

    return {
        title,
        brand,
        tokens,
        volumes,
        volumesText: formatVolumes(volumes),
        isBundle
    };
}

function countCommonTokens(aSet, bSet) {
    let count = 0;
    for (const token of aSet) {
        if (bSet.has(token)) count += 1;
    }
    return count;
}

function isBrandMatch(apiBrand, candidate) {
    // Use the enhanced brand matching with transliteration
    const candidateBrand = candidate.brand || '';
    
    // Check using the new brandsMatch function
    if (brandsMatch(apiBrand, candidateBrand)) {
        return true;
    }
    
    // Also check if brand appears in product name
    const brandNorm = normalizeBrand(apiBrand);
    if (brandNorm && candidate.normalizedName && candidate.normalizedName.includes(brandNorm)) {
        return true;
    }
    
    return false;
}

function compareVolumeLists(srcVolumes, dstVolumes) {
    if (srcVolumes.length === 0 && dstVolumes.length === 0) {
        return { match: true, exact: false, reason: 'no_volume' };
    }

    // If one has no volume - this is OK (needs_review at most, not error)
    if (srcVolumes.length === 0 || dstVolumes.length === 0) {
        return { match: true, exact: false, reason: 'missing_volume' };
    }

    // If counts differ significantly, still try to match what we can
    // Focus on matching the main volume (usually the first one)
    const srcMain = srcVolumes[0];
    const dstMain = dstVolumes[0];
    
    if (srcMain.unit !== dstMain.unit) {
        return { match: false, exact: false, reason: 'unit_mismatch' };
    }
    
    const tolerance = Math.max(srcMain.val, dstMain.val) * 0.02; // 2% tolerance
    if (Math.abs(srcMain.val - dstMain.val) > tolerance) {
        return { match: false, exact: false, reason: 'value_mismatch' };
    }

    // If we have the same main volume, consider it a match
    return { match: true, exact: srcVolumes.length === dstVolumes.length, reason: 'match' };
}

function scoreCandidate(apiInfo, candidate) {
    const commonTokens = countCommonTokens(apiInfo.tokens, candidate.tokens);
    const tokenScore = commonTokens / Math.max(apiInfo.tokens.size, 4);
    const brandMatch = isBrandMatch(apiInfo.brand, candidate);
    const volumeCheck = compareVolumeLists(apiInfo.volumes, candidate.volumes);
    const bundleMatch = apiInfo.isBundle === candidate.isBundle;
    const typeCheck = checkProductTypeMatch(apiInfo.title, candidate.name);

    let score = tokenScore;
    score += brandMatch ? 0.6 : -0.4;
    score += bundleMatch ? 0.15 : -0.35;
    score += volumeCheck.match ? 0.4 : -0.8;
    score += typeCheck.match ? 0.2 : -0.5;

    return { score, commonTokens, brandMatch, volumeCheck, typeCheck };
}

/**
 * Find candidate matches using full scoring across the catalog
 */
function findCandidates(apiRecord, productIndex) {
    const apiInfo = buildApiInfo(apiRecord);
    const { products, tokenIndex } = productIndex;

    // First try token index for recall
    const candidateIds = new Set();
    for (const token of apiInfo.tokens) {
        const ids = tokenIndex.get(token);
        if (ids) ids.forEach((id) => candidateIds.add(id));
    }

    let idsToScore = candidateIds.size > 0
        ? Array.from(candidateIds)
        : [];

    // For maximum accuracy, score the full catalog when candidate set is small
    if (idsToScore.length < 200) {
        idsToScore = products.map((_, idx) => idx);
    }

    const scored = [];
    for (const id of idsToScore) {
        const candidate = products[id];
        const scoreInfo = scoreCandidate(apiInfo, candidate);
        if (scoreInfo.score > -0.4) {
            scored.push({ candidate, scoreInfo });
        }
    }

    scored.sort((a, b) => b.scoreInfo.score - a.scoreInfo.score);

    const filtered = scored.filter((s) => s.scoreInfo.score > 0.15);
    const finalList = (filtered.length > 0 ? filtered : scored)
        .slice(0, MAX_CANDIDATES)
        .map((s) => s.candidate);

    return { apiInfo, candidates: finalList };
}

/**
 * Process a batch of records with GPT
 */
async function processBatchWithGPT(batch, productIndex) {
    const results = [];
    
    // Prepare items for GPT
    const itemsForGPT = [];
    const itemMeta = [];
    
    for (const record of batch) {
        const title = record.title || record.name || '';
        const brand = record.brand || '';
        const category = record.category_full_path || record.category || '';
        
        // Find candidates
        const { apiInfo, candidates } = findCandidates(record, productIndex);
        
        if (candidates.length === 0) {
            // No candidates - mark as not found
            results.push({
                source: {
                    title,
                    brand,
                    category,
                    price: parseFloat(record.cost || record.price) || null,
                    matched_uuid: record.matched_uuid || null,
                    image_url: record.url_picture || null
                },
                matched: null,
                verdict: 'not_found',
                reason: 'Нет похожих товаров в базе Рядом',
                confidence: 0
            });
        } else {
            itemsForGPT.push({
                idx: itemMeta.length,
                api: {
                    title,
                    brand,
                    category: category.split(' > ').pop() || '',
                    volumes: apiInfo.volumesText,
                    bundle: apiInfo.isBundle ? 'yes' : 'no'
                },
                candidates: candidates.map((c, i) => ({
                    i,
                    name: c.name,
                    brand: c.brand || '',
                    volumes: c.volumesText,
                    bundle: c.isBundle ? 'yes' : 'no'
                }))
            });
            itemMeta.push({ record, candidates, apiInfo });
        }
    }
    
    // If we have items to check with GPT
    if (itemsForGPT.length > 0) {
        try {
            const gptResults = await callGPTForMatching(itemsForGPT);
            
            // Create a map of GPT results by idx
            const gptResultsMap = new Map();
            for (const r of gptResults) {
                gptResultsMap.set(r.idx, r);
            }
            
            // Process ALL items, not just those GPT returned
            for (let i = 0; i < itemMeta.length; i++) {
                const gptResult = gptResultsMap.get(i) || { match: -1, confidence: 0 };
                const meta = itemMeta[i];
                const record = meta.record;
                const candidates = meta.candidates;
                
                const title = record.title || record.name || '';
                const brand = record.brand || '';
                const category = record.category_full_path || record.category || '';
                
                let verdict, matchedProduct, reason, confidence;
                
                const candidateIndex = Number.isInteger(gptResult.match) ? gptResult.match : -1;

                if (candidateIndex === -1 || candidateIndex >= candidates.length) {
                    verdict = 'not_found';
                    matchedProduct = null;
                    reason = gptResult.reason || 'GPT не нашёл совпадения';
                    confidence = 0;
                } else {
                    matchedProduct = candidates[candidateIndex];
                    confidence = gptResult.confidence || 0;
                    
                    // POST-CHECK 0: Basic sanity check - must have at least some common words
                    const sanityCheck = checkBasicSimilarity(title, matchedProduct.name);
                    
                    // POST-CHECK 1: Verify brand match
                    const brandCheck = isBrandMatch(brand, matchedProduct);

                    // POST-CHECK 2: Verify volume/weight match
                    const volumeCheck = checkVolumeMatch(title, matchedProduct.name);
                    
                    // POST-CHECK 3: Verify product type match (keywords that MUST match)
                    const typeCheck = checkProductTypeMatch(title, matchedProduct.name);
                    
                    if (!sanityCheck.pass) {
                        // Completely different products
                        verdict = 'likely_wrong';
                        reason = `Нет общих слов: GPT ошибся`;
                        matchedProduct = null;
                        confidence = 0;
                    } else if (!brandCheck) {
                        verdict = 'likely_wrong';
                        reason = 'Бренд не совпадает';
                        confidence = 0.2;
                    } else if (!volumeCheck.match) {
                        // Volume mismatch - mark as error
                        verdict = 'likely_wrong';
                        if (volumeCheck.reason === 'missing_volume') {
                            reason = `Объём/вес указан только в одном товаре: ${volumeCheck.srcVol} ↔ ${volumeCheck.dstVol}`;
                        } else {
                            reason = `Несовпадение объёма/веса: ${volumeCheck.srcVol} ≠ ${volumeCheck.dstVol}`;
                        }
                        confidence = 0.3;
                    } else if (!typeCheck.match) {
                        // Product type mismatch
                        verdict = 'likely_wrong';
                        reason = `Разные продукты: "${typeCheck.srcType}" ≠ "${typeCheck.dstType}"`;
                        confidence = 0.2;
                    } else if (confidence >= 0.9) {
                        verdict = 'correct';
                        reason = `Точное совпадение (${Math.round(confidence * 100)}%)`;
                    } else if (confidence >= 0.7) {
                        verdict = 'needs_review';
                        reason = `Средняя уверенность (${Math.round(confidence * 100)}%): проверьте вручную`;
                    } else {
                        verdict = 'likely_wrong';
                        reason = `Низкая уверенность (${Math.round(confidence * 100)}%)`;
                    }
                }
                
                results.push({
                    source: {
                        title,
                        brand,
                        category,
                        price: parseFloat(record.cost || record.price) || null,
                        matched_uuid: record.matched_uuid || null,
                        image_url: record.url_picture || null
                    },
                    matched: matchedProduct ? {
                        id: matchedProduct.id,
                        name: matchedProduct.name,
                        brand: matchedProduct.brand
                    } : null,
                    verdict,
                    reason,
                    confidence
                });
            }
        } catch (gptError) {
            console.error('GPT error:', gptError.message);
            // Fallback to simple matching
            for (const meta of itemMeta) {
                const record = meta.record;
                const candidates = meta.candidates;
                const title = record.title || record.name || '';
                const brand = record.brand || '';
                const category = record.category_full_path || record.category || '';
                
                // Simple string similarity
                const best = findBestSimpleMatch(title, brand, candidates);
                
                results.push({
                    source: {
                        title,
                        brand,
                        category,
                        price: parseFloat(record.cost || record.price) || null,
                        matched_uuid: record.matched_uuid || null,
                        image_url: record.url_picture || null
                    },
                    matched: best.product ? {
                        id: best.product.id,
                        name: best.product.name,
                        brand: best.product.brand
                    } : null,
                    verdict: best.verdict,
                    reason: best.reason + ' (fallback)',
                    confidence: best.confidence
                });
            }
        }
    }
    
    return results;
}

/**
 * Call GPT for batch matching with STRICT criteria
 */
async function callGPTForMatching(items) {
    const prompt = `You are a STRICT product matcher.
Rules:
- Brand must match when present.
- Volume/weight must be identical. If API has volume and candidate doesn't → NOT a match.
- Bundle flag must match (set vs single).
- Product type and variant must match (milk ≠ kefir, lemon ≠ garlic, etc.).

Return JSON array of length ${items.length}.
Each item: {"idx":N,"match":candidateIndexOr-1,"confidence":0-1,"reason":"short"}.
Use match:-1 if no exact match.

Items:
${items.map(item => `[${item.idx}] API: "${item.api.title}" | brand:${item.api.brand || '?'} | vol:${item.api.volumes} | bundle:${item.api.bundle}
Candidates: ${item.candidates.map(c => `${c.i}:"${c.name}" (brand:${c.brand || '?'}, vol:${c.volumes}, bundle:${c.bundle})`).join(' ; ')}`).join('\n')}
`;

    const response = await openaiApi.post('/chat/completions', {
        model: 'gpt-4o',
        messages: [
            { role: 'system', content: 'Strict product matcher. Reply JSON array only.' },
            { role: 'user', content: prompt }
        ],
        temperature: 0,
        max_tokens: 4000
    });

    const content = response.data.choices[0].message.content.trim();
    
    // Parse JSON (handle markdown code blocks)
    let jsonStr = content;
    if (content.startsWith('```')) {
        jsonStr = content.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
    }
    
    try {
        const parsed = JSON.parse(jsonStr);
        if (Array.isArray(parsed)) return parsed;
        if (parsed && Array.isArray(parsed.results)) return parsed.results;
        return items.map(item => ({ idx: item.idx, match: -1, confidence: 0, reason: 'Invalid JSON format' }));
    } catch (e) {
        console.error('GPT JSON parse error:', content);
        // Return empty matches
        return items.map(item => ({ idx: item.idx, match: -1, confidence: 0, reason: 'Parse error' }));
    }
}

/**
 * Basic sanity check - products must have SOME common significant words
 */
function checkBasicSimilarity(srcName, dstName) {
    const src = normalizeText(srcName);
    const dst = normalizeText(dstName);
    
    // Get significant words (length > 3)
    const srcWords = src.split(/\s+/).filter(w => w.length > 3);
    const dstWords = dst.split(/\s+/).filter(w => w.length > 3);
    
    // Count common words
    let commonCount = 0;
    for (const sw of srcWords) {
        for (const dw of dstWords) {
            if (sw === dw || sw.includes(dw) || dw.includes(sw)) {
                commonCount++;
                break;
            }
        }
    }
    
    // Must have at least 1 common word (or 2 if names are long)
    const minRequired = Math.max(1, Math.min(srcWords.length, dstWords.length) > 4 ? 2 : 1);
    
    return {
        pass: commonCount >= minRequired,
        common: commonCount,
        required: minRequired
    };
}

/**
 * Check if product type matches (key ingredients/variants must be same)
 */
function checkProductTypeMatch(srcName, dstName) {
    const src = normalizeText(srcName);
    const dst = normalizeText(dstName);

    const srcBundle = detectBundle(srcName);
    const dstBundle = detectBundle(dstName);
    if (srcBundle !== dstBundle) {
        return {
            match: false,
            srcType: srcBundle ? 'набор' : 'одиночный',
            dstType: dstBundle ? 'набор' : 'одиночный'
        };
    }
    
    // Key differentiating words - if one has it and other doesn't = mismatch
    const keyWords = [
        // Vegetables
        ['кабачк', 'баклажан'], ['помидор', 'огурец'], ['морков', 'свекл'],
        // Dairy variants
        ['кефир', 'молоко', 'йогурт', 'сметан', 'творог', 'ряженк'],
        // Meat
        ['говядин', 'свинин', 'курин', 'куриц', 'индейк', 'баранин'],
        // Fish
        ['лосось', 'семг', 'форель', 'тунец', 'сельд', 'скумбри'],
        // Fruit
        ['яблок', 'груш', 'банан', 'апельсин', 'лимон', 'клубник', 'малин'],
        // Additions/variants (critical!)
        ['креветк', 'без косточ', 'с косточ', 'с лимон', 'с перц', 'с чеснок'],
        ['шоколад', 'ванил', 'клубнич', 'банан'],
        // Grooming/beauty
        ['бритв', 'станок', 'кассет', 'лезви'],
        ['гель', 'пена', 'лосьон', 'крем', 'бальзам'],
        ['шампун', 'кондиционер', 'маск', 'спрей'],
        // Fat content
        ['обезжир', 'жирн'],
    ];
    
    for (const group of keyWords) {
        const srcMatches = group.filter(w => src.includes(w));
        const dstMatches = group.filter(w => dst.includes(w));
        
        // If both have words from same group but different words - mismatch
        if (srcMatches.length > 0 && dstMatches.length > 0) {
            const srcSet = new Set(srcMatches);
            const dstSet = new Set(dstMatches);
            const intersection = [...srcSet].filter(x => dstSet.has(x));
            
            // If they have different key words from same category
            if (intersection.length === 0 && srcMatches[0] !== dstMatches[0]) {
                return { 
                    match: false, 
                    srcType: srcMatches[0], 
                    dstType: dstMatches[0] 
                };
            }
        }
        
        // If one has a specific variant and other doesn't
        for (const word of ['креветк', 'лимон', 'перц', 'чеснок', 'косточ']) {
            const srcHas = src.includes(word);
            const dstHas = dst.includes(word);
            if (srcHas !== dstHas) {
                return {
                    match: false,
                    srcType: srcHas ? word : 'без ' + word,
                    dstType: dstHas ? word : 'без ' + word
                };
            }
        }
    }
    
    return { match: true };
}

/**
 * Check if volume/weight matches between two product names
 */
function checkVolumeMatch(srcName, dstName) {
    const srcVolumes = extractVolumes(srcName);
    const dstVolumes = extractVolumes(dstName);
    const comparison = compareVolumeLists(srcVolumes, dstVolumes);

    return {
        match: comparison.match,
        srcVol: formatVolumes(srcVolumes),
        dstVol: formatVolumes(dstVolumes),
        reason: comparison.reason
    };
}

/**
 * Simple string similarity fallback
 */
function findBestSimpleMatch(title, brand, candidates) {
    const titleLower = normalizeText(title);
    const brandLower = normalizeText(brand);
    
    let best = null;
    let bestScore = 0;
    
    for (const c of candidates) {
        const cName = normalizeText(c.name);
        const cBrand = normalizeText(c.brand || '');
        
        let score = 0;
        
        // Name similarity
        if (cName === titleLower) score += 1.0;
        else if (cName.includes(titleLower) || titleLower.includes(cName)) score += 0.7;
        else {
            const commonWords = titleLower.split(' ').filter(w => cName.includes(w)).length;
            score += commonWords * 0.15;
        }
        
        // Brand match bonus
        if (brandLower && cBrand && (brandLower === cBrand || brandLower.includes(cBrand) || cBrand.includes(brandLower))) {
            score += 0.3;
        }
        
        if (score > bestScore) {
            bestScore = score;
            best = c;
        }
    }
    
    if (!best || bestScore < 0.3) {
        return { product: null, verdict: 'not_found', reason: 'Нет хорошего совпадения', confidence: 0 };
    }
    
    const confidence = Math.min(bestScore, 1.0);
    let verdict = 'likely_wrong';
    if (confidence >= 0.9) verdict = 'correct';
    else if (confidence >= 0.6) verdict = 'needs_review';
    
    return { 
        product: best, 
        verdict, 
        reason: `Similarity: ${Math.round(confidence * 100)}%`,
        confidence 
    };
}

// Legacy endpoint
exports.getMappingVerification = async (req, res) => {
    if (req.query.file_id) {
        return exports.reviewMappedFromApi(req, res);
    }

    try {
        const ryadom = await Aggregator.findOne({ name: 'Рядом' });
        const totalProducts = await Product.countDocuments();
        const ryadomProducts = ryadom ? await Price.countDocuments({ aggregator: ryadom._id }) : 0;

        res.json({
            summary: {
                total: totalProducts,
                correct: ryadomProducts,
                unmapped: totalProducts - ryadomProducts,
                not_found: 0,
                needs_review: 0,
                likely_wrong: 0
            },
            results: []
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

async function getAvailableFiles() {
    try {
        const response = await externalApi.get('/api/csv-files');
        return response.data.files?.map(f => f.id) || [];
    } catch (err) {
        return [];
    }
}

/**
 * Review mapping from local JSON file
 * New format: {csv_name, csv_brand, csv_weight, match, match_confidence, title, ...}
 * 
 * This verifies EXISTING matches in the file: csv_name (our product) vs title (aggregator product)
 */
exports.reviewLocalFile = async (req, res) => {
    const fs = require('fs');
    const path = require('path');
    
    try {
        const fileName = req.query.file || 'test_airba.json';
        const limit = Math.min(parseInt(req.query.limit) || 50, 500);
        const offset = parseInt(req.query.offset) || 0;
        const mode = req.query.mode || 'verify_existing'; // 'verify_existing' or 'find_new'
        
        console.log(`[Local Review] Starting: file=${fileName}, limit=${limit}, offset=${offset}, mode=${mode}`);
        const startTime = Date.now();
        
        // Find file path
        const filePath = path.join(__dirname, '../../../Data', fileName);
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: `File not found: ${fileName}` });
        }
        
        // Read file
        const fileData = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        console.log(`[Local Review] File has ${fileData.length} records`);
        
        let results = [];
        let summary = {};
        
        if (mode === 'verify_existing') {
            // Verify existing matches: csv_name vs title
            const matchedRecords = fileData.filter(r => r.match && r.title);
            const totalMatched = matchedRecords.length;
            const recordsToVerify = matchedRecords.slice(offset, offset + limit);
            
            console.log(`[Local Review] Verifying ${recordsToVerify.length} existing matches`);
            
            // Process each matched record
            for (const record of recordsToVerify) {
                const csvName = record.csv_name || '';
                const csvBrand = record.csv_brand || '';
                const aggTitle = record.title || '';
                const aggBrand = record.brand || '';
                const confidence = record.match_confidence || 0;
                
                // Use our matching logic to verify
                const result = verifyExistingMatch(csvName, csvBrand, aggTitle, aggBrand, confidence);
                
                results.push({
                    source: {
                        title: csvName,
                        brand: csvBrand,
                        weight: record.csv_weight
                    },
                    matched: {
                        name: aggTitle,
                        brand: aggBrand
                    },
                    verdict: result.verdict,
                    reason: result.reason,
                    original_confidence: confidence
                });
            }
            
            summary = {
                total_matched_in_file: totalMatched,
                processed: results.length,
                offset: offset,
                correct: results.filter(r => r.verdict === 'correct').length,
                needs_review: results.filter(r => r.verdict === 'needs_review').length,
                likely_wrong: results.filter(r => r.verdict === 'likely_wrong').length
            };
        } else {
            // Find new matches for unmatched records (original functionality)
            const ryadom = await Aggregator.findOne({ name: 'Рядом' });
            if (!ryadom) {
                return res.status(400).json({ error: 'Рядом aggregator not found.' });
            }

            const ourPrices = await Price.find({ aggregator: ryadom._id })
                .populate('product')
                .limit(30000);
            
            const ourProducts = ourPrices
                .filter(p => p.product)
                .map(p => ({
                    id: p.product._id.toString(),
                    name: p.product.name,
                    brand: p.product.brand || '',
                    category: p.product.category_name || ''
                }));

            const unmatchedRecords = fileData.filter(r => !r.match);
            const totalUnmatched = unmatchedRecords.length;
            const recordsToProcess = unmatchedRecords.slice(offset, offset + limit);
            
            const apiRecords = recordsToProcess.map(r => ({
                title: r.csv_name || '',
                brand: r.csv_brand || '',
                weight: r.csv_weight || ''
            }));
            
            const productIndex = buildProductIndex(ourProducts);
            
            const batches = [];
            for (let i = 0; i < apiRecords.length; i += GPT_BATCH_SIZE) {
                batches.push(apiRecords.slice(i, i + GPT_BATCH_SIZE));
            }
            
            for (let i = 0; i < batches.length; i += GPT_PARALLEL_LIMIT) {
                const batchGroup = batches.slice(i, i + GPT_PARALLEL_LIMIT);
                const batchResults = await Promise.all(
                    batchGroup.map(batch => processBatchWithGPT(batch, productIndex, ourProducts))
                );
                results.push(...batchResults.flat());
            }
            
            summary = {
                total_unmatched_in_file: totalUnmatched,
                processed: results.length,
                offset: offset,
                correct: results.filter(r => r.verdict === 'correct').length,
                needs_review: results.filter(r => r.verdict === 'needs_review').length,
                likely_wrong: results.filter(r => r.verdict === 'likely_wrong').length,
                not_found: results.filter(r => r.verdict === 'not_found').length
            };
        }
        
        const processingTime = Date.now() - startTime;
        console.log(`[Local Review] Completed in ${processingTime}ms: ${JSON.stringify(summary)}`);
        
        res.json({
            summary,
            results,
            file_info: { name: fileName, total_records: fileData.length },
            processing_time_ms: processingTime
        });
    } catch (err) {
        console.error('[Local Review] Error:', err);
        res.status(500).json({ error: err.message });
    }
};

/**
 * Verify an existing match between csv_name (our product) and title (aggregator product)
 */
function verifyExistingMatch(csvName, csvBrand, aggTitle, aggBrand, originalConfidence) {
    // Normalize both names
    const normCsv = normalizeText(csvName);
    const normAgg = normalizeText(aggTitle);
    
    // Extract volumes
    const csvVolumes = extractVolumes(csvName);
    const aggVolumes = extractVolumes(aggTitle);
    
    // Check basic similarity (common words)
    const csvTokens = new Set(extractTokens(csvName));
    const aggTokens = new Set(extractTokens(aggTitle));
    
    let commonTokens = 0;
    for (const t of csvTokens) {
        if (aggTokens.has(t)) commonTokens++;
    }
    
    const maxTokens = Math.max(csvTokens.size, aggTokens.size);
    const tokenSimilarity = maxTokens > 0 ? commonTokens / maxTokens : 0;
    
    // Check brand match
    const brandMatch = brandsMatch(csvBrand, aggBrand);
    
    // Check volume match
    const volumeCheck = compareVolumeLists(csvVolumes, aggVolumes);
    
    // Check product type match
    const typeCheck = checkProductTypeMatch(csvName, aggTitle);
    
    // Determine verdict
    if (tokenSimilarity < 0.2 && commonTokens < 2) {
        return {
            verdict: 'likely_wrong',
            reason: `Товары слишком разные (совпадение: ${(tokenSimilarity * 100).toFixed(0)}%)`
        };
    }
    
    if (!brandMatch && csvBrand && aggBrand) {
        // Check if brand appears in product name
        const csvBrandNorm = normalizeBrand(csvBrand);
        const aggBrandNorm = normalizeBrand(aggBrand);
        if (csvBrandNorm && aggBrandNorm && !normAgg.includes(csvBrandNorm) && !normCsv.includes(aggBrandNorm)) {
            return {
                verdict: 'likely_wrong',
                reason: `Бренд не совпадает: ${csvBrand} ≠ ${aggBrand}`
            };
        }
    }
    
    if (!volumeCheck.match) {
        return {
            verdict: 'likely_wrong',
            reason: `Объём/вес не совпадает: ${formatVolumes(csvVolumes)} ≠ ${formatVolumes(aggVolumes)}`
        };
    }
    
    if (!typeCheck.match) {
        return {
            verdict: 'likely_wrong',
            reason: typeCheck.reason
        };
    }
    
    // Passed all checks
    if (tokenSimilarity >= 0.5 || commonTokens >= 3) {
        return {
            verdict: 'correct',
            reason: `Совпадение: ${(tokenSimilarity * 100).toFixed(0)}%`
        };
    }
    
    return {
        verdict: 'needs_review',
        reason: `Требует проверки (совпадение: ${(tokenSimilarity * 100).toFixed(0)}%)`
    };
}
