const OpenAI = require('openai');
const Category = require('../models/Category');
const CategoryMapping = require('../models/CategoryMapping');
const Aggregator = require('../models/Aggregator');

class CategoryMatcher {
    constructor() {
        this.openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY
        });
        this.model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
    }

    /**
     * Extract and normalize categories from API data
     * @param {Array} records - API records with category_full_path
     * @param {string} aggregatorName - Name of the aggregator
     * @param {number} limit - Limit for testing (0 = no limit)
     */
    async processCategories(records, aggregatorName, limit = 0) {
        console.log(`\n📂 Processing categories for ${aggregatorName}...`);
        
        // Normalize aggregator name for matching
        const normalizedName = this.normalizeAggregatorName(aggregatorName);
        
        // Get or create aggregator (case-insensitive search)
        let aggregator = await Aggregator.findOne({ 
            name: { $regex: new RegExp(`^${normalizedName}`, 'i') } 
        });
        
        if (!aggregator) {
            // Try to find by partial match
            const partialName = normalizedName.split(/[\s._-]/)[0];
            aggregator = await Aggregator.findOne({
                name: { $regex: new RegExp(partialName, 'i') }
            });
        }
        
        if (!aggregator) {
            console.log(`  ❌ Aggregator ${aggregatorName} (normalized: ${normalizedName}) not found`);
            return { processed: 0, created: 0, mapped: 0 };
        }
        
        console.log(`  Found aggregator: ${aggregator.name}`);

        // Extract unique categories (filter out technical ones)
        const rawCategories = new Set();
        for (const record of records) {
            const catPath = record.category_full_path;
            if (catPath && catPath.trim()) {
                // Skip technical categories
                if (/^Publication \d+$/.test(catPath) || /^[a-f0-9]{20,}$/i.test(catPath)) {
                    continue;
                }
                rawCategories.add(catPath.trim());
            }
        }

        let categoriesToProcess = [...rawCategories];
        if (limit > 0) {
            categoriesToProcess = categoriesToProcess.slice(0, limit);
            console.log(`  🧪 Test mode: processing only ${limit} categories`);
        }

        console.log(`  Found ${rawCategories.size} unique categories, processing ${categoriesToProcess.length}`);

        // Check which categories are already mapped
        const existingMappings = await CategoryMapping.find({
            raw_category: { $in: categoriesToProcess },
            aggregator: aggregator._id
        }).lean();
        
        const mappedCategories = new Set(existingMappings.map(m => m.raw_category));
        const newCategories = categoriesToProcess.filter(c => !mappedCategories.has(c));

        console.log(`  Already mapped: ${mappedCategories.size}, New: ${newCategories.length}`);

        if (newCategories.length === 0) {
            return { processed: categoriesToProcess.length, created: 0, mapped: existingMappings.length };
        }

        // Get existing master categories
        const masterCategories = await Category.find({ parent: null }).lean();
        
        // Use GPT to match categories
        const matchResults = await this.matchCategoriesWithGPT(newCategories, masterCategories, aggregatorName);
        
        // Create master categories and mappings
        let created = 0;
        let mapped = 0;

        console.log(`  Processing ${matchResults.length} match results...`);
        
        for (const result of matchResults) {
            console.log(`  -> ${result.raw_category} -> ${result.master_category}`);
            try {
                let masterId = null;

                if (result.master_category) {
                    // Find or create master category (case-insensitive)
                    let master = masterCategories.find(m => 
                        m.name.toLowerCase() === result.master_category.toLowerCase()
                    );
                    
                    if (!master) {
                        // Check if it exists in DB first
                        let existingMaster = await Category.findOne({ 
                            name: { $regex: new RegExp(`^${result.master_category}$`, 'i') },
                            parent: null 
                        });
                        
                        if (existingMaster) {
                            masterId = existingMaster._id;
                            masterCategories.push({ _id: masterId, name: existingMaster.name });
                        } else {
                            // Create new master category
                            const newMaster = await Category.create({
                                name: result.master_category,
                                parent: null
                            });
                            masterId = newMaster._id;
                            masterCategories.push({ _id: masterId, name: result.master_category });
                            created++;
                        }
                    } else {
                        masterId = master._id;
                    }

                    // Create child category if path suggests hierarchy
                    if (result.child_category && result.child_category !== result.master_category) {
                        // First try to find with exact parent
                        let child = await Category.findOne({ 
                            name: { $regex: new RegExp(`^${result.child_category}$`, 'i') }, 
                            parent: masterId 
                        });
                        
                        if (!child) {
                            // Check if category exists anywhere (might have different parent)
                            const anyExisting = await Category.findOne({
                                name: { $regex: new RegExp(`^${result.child_category}$`, 'i') }
                            });
                            
                            if (anyExisting) {
                                // Use existing category even if parent differs
                                child = anyExisting;
                                console.log(`    ℹ️ Using existing category "${anyExisting.name}"`);
                            } else {
                                // Create new child
                                child = await Category.create({
                                    name: result.child_category,
                                    parent: masterId
                                });
                                created++;
                            }
                        }
                        masterId = child._id;
                    }
                }

                // Create mapping - mark as unverified if low confidence
                const confidence = result.confidence || 50;
                const isVerified = confidence >= 70;
                
                await CategoryMapping.findOneAndUpdate(
                    { raw_category: result.raw_category, aggregator: aggregator._id },
                    {
                        master_category: masterId,
                        confidence: confidence,
                        is_verified: isVerified
                    },
                    { upsert: true }
                );
                mapped++;
                
                if (!isVerified) {
                    console.log(`    ⚠️ Low confidence (${confidence}): "${result.raw_category}" → "${result.master_category}"`);
                }
            } catch (err) {
                console.log(`  ⚠️ Error mapping "${result.raw_category}": ${err.message}`);
            }
        }

        console.log(`  ✅ Created ${created} categories, mapped ${mapped} categories`);
        return { processed: categoriesToProcess.length, created, mapped };
    }

    /**
     * Use GPT to match raw categories to master categories
     */
    async matchCategoriesWithGPT(rawCategories, existingMasters, aggregatorName) {
        if (rawCategories.length === 0) return [];

        const masterNames = existingMasters.map(m => m.name);
        
        // Process in batches to avoid token limits
        const batchSize = 20;
        const results = [];

        for (let i = 0; i < rawCategories.length; i += batchSize) {
            const batch = rawCategories.slice(i, i + batchSize);
            console.log(`  🤖 GPT matching batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(rawCategories.length/batchSize)}...`);
            console.log(`  Categories to process: ${batch.join(', ')}`);

            const prompt = this.buildMatchingPrompt(batch, masterNames, aggregatorName);
            
            if (!prompt) {
                console.log(`  Skipping batch - all technical categories`);
                continue;
            }
            
            console.log(`  Prompt length: ${prompt.length}`);
            
            try {
                const response = await this.openai.chat.completions.create({
                    model: this.model,
                    messages: [
                        {
                            role: 'system',
                            content: `You are a grocery category expert for Kazakhstan market. Normalize e-commerce categories into a unified Russian hierarchy.

CRITICAL RULES:
1. ДЕТСКОЕ ПИТАНИЕ (baby/kids food) is SEPARATE from adult categories:
   - "Молочные смеси", "Детские каши", "Детское пюре" → parent: "Детское питание"
   - NOT under "Молочные продукты" or "Бакалея"!

2. Standard parent categories (use EXACTLY these names):
   - "Молочные продукты" (milk, cheese, yogurt, kefir, smetana, tvorog - FOR ADULTS)
   - "Детское питание" (baby formula, baby food, kids snacks)
   - "Мясо и птица" (meat, poultry)
   - "Рыба и морепродукты" (fish, seafood)
   - "Овощи и фрукты" (vegetables, fruits)
   - "Хлеб и выпечка" (bread, bakery)
   - "Напитки" (drinks, water, juice, soda)
   - "Бакалея" (pasta, cereals, oil, canned goods)
   - "Замороженные продукты" (frozen food)
   - "Кондитерские изделия" (sweets, chocolate, cookies)
   - "Снеки" (chips, crackers)
   - "Алкоголь" (alcohol)

3. Translate English slugs accurately:
   - "cheeses" → "Сыры" (child of "Молочные продукты")
   - "milk_butter_eggs" → "Молоко, масло, яйца" (child of "Молочные продукты")
   - "baby_food" → "Детское питание" (parent)

4. Skip technical categories (IDs, hex codes, "Publication X")

5. Confidence scoring:
   - 90-100: Exact or obvious match
   - 70-89: Clear match with minor translation
   - 50-69: Reasonable guess, may need review
   - <50: Uncertain, needs manual verification

Respond ONLY with valid JSON array.`
                        },
                        { role: 'user', content: prompt }
                    ],
                    temperature: 0.3,
                    max_tokens: 2000
                });

                const content = response.choices[0].message.content;
                console.log(`  GPT response (${content.length} chars): ${content.substring(0, 200)}...`);
                const parsed = this.parseGPTResponse(content, batch);
                console.log(`  Parsed ${parsed.length} categories`);
                results.push(...parsed);
            } catch (err) {
                console.log(`  ❌ GPT error: ${err.message}`);
                console.log(`  Stack: ${err.stack?.substring(0, 300)}`);
                // Fallback: create simple mappings
                for (const cat of batch) {
                    results.push({
                        raw_category: cat,
                        master_category: this.simplifyCategory(cat),
                        child_category: null,
                        confidence: 50
                    });
                }
            }
        }

        return results;
    }

    buildMatchingPrompt(categories, existingMasters, aggregatorName) {
        // Filter out obvious technical categories before sending to GPT
        const validCategories = categories.filter(c => 
            !(/^Publication \d+$/.test(c)) && 
            !(/^[a-f0-9]{20,}$/i.test(c)) &&
            c.trim().length > 0
        );

        if (validCategories.length === 0) {
            return null; // No valid categories to process
        }

        return `Aggregator: ${aggregatorName}

${existingMasters.length > 0 ? `REUSE these existing master categories when appropriate:\n${existingMasters.join(', ')}\n` : ''}
Categories to normalize:
${validCategories.map((c, i) => `${i + 1}. "${c}"`).join('\n')}

For EACH category, return JSON with:
- raw_category: exact original name
- master_category: parent category (use standard names from system prompt)
- child_category: subcategory in Russian, or null if it IS the parent
- confidence: 0-100 (be honest, low score if uncertain)

EXAMPLES of correct mapping:
- "Молочные смеси" → {"master_category":"Детское питание","child_category":"Молочные смеси","confidence":95}
- "Детские каши" → {"master_category":"Детское питание","child_category":"Детские каши","confidence":95}
- "Йогурт" → {"master_category":"Молочные продукты","child_category":"Йогурты","confidence":90}
- "cheeses" → {"master_category":"Молочные продукты","child_category":"Сыры","confidence":85}
- "frozen_vegetables" → {"master_category":"Замороженные продукты","child_category":"Замороженные овощи","confidence":85}

Return valid JSON array ONLY:`;
    }

    parseGPTResponse(content, originalCategories) {
        try {
            // Extract JSON from response
            const jsonMatch = content.match(/\[[\s\S]*\]/);
            if (!jsonMatch) {
                throw new Error('No JSON array found');
            }
            
            const parsed = JSON.parse(jsonMatch[0]);
            return parsed.filter(p => p && p.raw_category);
        } catch (err) {
            console.log(`  ⚠️ Parse error: ${err.message}`);
            // Return fallback
            return originalCategories.map(cat => ({
                raw_category: cat,
                master_category: this.simplifyCategory(cat),
                child_category: null,
                confidence: 40
            }));
        }
    }

    simplifyCategory(cat) {
        // Skip technical categories
        if (/^Publication \d+$/.test(cat) || /^[a-f0-9]{20,}$/.test(cat)) {
            return null;
        }
        // Convert underscores to spaces and capitalize
        return cat.replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase());
    }

    normalizeAggregatorName(name) {
        // Remove city suffix and normalize
        return name
            .replace(/\s*(ALMATY|ASTANA|almaty|astana)$/i, '')
            .replace(/\s+/g, ' ')
            .trim();
    }

    /**
     * Get unified category for a raw category
     */
    async getUnifiedCategory(rawCategory, aggregatorId) {
        const mapping = await CategoryMapping.findOne({
            raw_category: rawCategory,
            aggregator: aggregatorId
        }).populate('master_category');
        
        return mapping?.master_category || null;
    }
}

module.exports = new CategoryMatcher();
