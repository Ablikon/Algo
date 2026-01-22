"""
AI-Powered Product Matcher with Enhanced Aggressive Matching

Optimized for finding maximum matches using full ChatGPT capabilities.
Prioritizes products with more aggregator coverage.
"""

import os
import re
import json
import asyncio
import logging
from typing import List, Dict, Any, Optional
from datetime import datetime
from difflib import SequenceMatcher
from collections import Counter

from openai import AsyncOpenAI
from dotenv import load_dotenv
from bson import ObjectId

load_dotenv()
logger = logging.getLogger(__name__)

# Configuration
OPENAI_API_KEY = os.getenv('OPENAI_API_KEY')
OPENAI_MODEL = os.getenv('OPENAI_MODEL', 'gpt-4o')  # Using GPT-4o for best reasoning
OUR_COMPANY = os.getenv('OUR_COMPANY_AGGREGATOR', 'Glovo')

# Comprehensive transliteration mapping (CYR <-> LAT)
TRANSLIT_MAP = {
    'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'yo', 'ж': 'zh',
    'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm', 'н': 'n', 'о': 'o',
    'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u', 'ф': 'f', 'х': 'kh', 'ц': 'ts',
    'ч': 'ch', 'ш': 'sh', 'щ': 'shch', 'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu',
    'я': 'ya', 'і': 'i', 'ї': 'yi', 'є': 'ye', 'ґ': 'g'
}

# Reverse transliteration for LAT -> CYR
REVERSE_TRANSLIT_MAP = {}
for cyr, lat in TRANSLIT_MAP.items():
    if lat not in REVERSE_TRANSLIT_MAP:
        REVERSE_TRANSLIT_MAP[lat] = cyr

# Synonym mappings for product types - COMPREHENSIVE
SYNONYM_GROUPS = {
    # Cleaning products
    'dish_soap': ['гель', 'жидкость', 'мыло', 'soap', 'gel', 'liquid', 'обезжириватель', 'мойка', 'средство', 'cleaner', 'washing'],
    'laundry_detergent': ['порошок', 'гель', 'detergent', 'powder', 'liquid', 'capsule', 'capsules', 'капсулы', 'for washing', 'для стирки'],
    'fabric_softener': ['кондиционер', 'conditioner', 'softener', 'смягчитель', 'ополаскиватель'],

    # Beverages
    'carbonated': ['газировка', 'лимонад', 'газированный', 'carbonated', 'sparkling', 'drink', 'fizzy', 'soda', 'tonic'],
    'juice': ['сок', 'juice', 'nectar', 'нектар', 'drink', 'напиток'],
    'water': ['вода', 'water', 'минералка', 'минеральная'],

    # Dairy
    'milk': ['молоко', 'milk', 'питьевое'],
    'yogurt': ['йогурт', 'yogurt', 'yoghurt', 'drinking', 'питьевой'],
    'kefir': ['кефир', 'kefir', 'probiotic', 'пробиотик'],
    'sour_cream': ['сметана', 'sour cream', 'creme fraiche'],

    # Baby products
    'diapers': ['подгузник', 'подгузники', 'diaper', 'diapers', 'nappy', 'nappies', 'pampers'],
    'baby_pants': ['трусики', 'pants', 'underpants', 'подгузник-трусики', 'slip'],

    # Personal care
    'shampoo': ['шампунь', 'shampoo'],
    'conditioner': ['кондиционер', 'conditioner', 'balm', 'бальзам'],
    'toothpaste': ['зубная паста', 'toothpaste', 'paste', 'паста'],
    'toothbrush': ['зубная щетка', 'toothbrush', 'brush', 'щетка'],

    # Food
    'cereal': ['хлопья', 'cereals', 'flakes', 'мусли', 'muesli', 'granola'],
    'pasta': ['макароны', 'pasta', 'spaghetti', 'macaroni', 'vermicelli', 'вермишель', 'спагетти'],
    'rice': ['рис', 'rice'],
    'chicken': ['курица', 'chicken', 'мясо птицы', 'poultry'],

    # Snacks
    'chips': ['чипсы', 'chips', 'crisps', 'картофельные чипсы'],
    'cookies': ['печенье', 'cookies', 'biscuits', 'бисквит'],
    'chocolate': ['шоколад', 'chocolate', 'bar', 'плитка'],

    # Household
    'napkins': ['салфетки', 'napkins', 'paper', 'бумажные'],
    'toilet_paper': ['туалетная бумага', 'toilet paper', 'tp', 'paper'],
    'dish_sponge': ['губка', 'sponge', 'sponge for dishes', 'для посуды'],
}


# Global status tracker
MATCHING_STATUS = {
    'is_running': False,
    'total': 0,
    'processed': 0,
    'matched': 0,
    'start_time': None,
    'current_product': None,
    'errors': 0
}

class ProductMapper:
    """
    Ultra-smart AI Product Mapper using full ChatGPT capabilities.

    Features:
    - Multi-stage candidate finding (6+ strategies)
    - Aggressive AI verification with detailed prompts
    - Prioritization of products with more aggregator matches
    - Comprehensive synonym handling
    - Transliteration-aware matching (CYR <-> LAT)
    - Smart weight/size tolerance
    - Fallback fuzzy matching strategy
    """

    def __init__(self, db, config: Optional[Dict] = None):
        self.db = db
        self.config = config or {
            'match_threshold': 60,  # Lower threshold - trust GPT more
            'max_candidates': 150,  # Many more candidates for AI to analyze
            'batch_size': 10,
            'delay_ms': 100,
            'weight_tolerance': 200,  # Generous: ±200g/ml
            'weight_tolerance_ratio': 0.3,  # Also allow 30% relative difference
            'auto_match_threshold': 95,  # Very high threshold for auto-match
            'min_candidate_threshold': 25,  # Include weak candidates for AI
            'enable_fallback': True,  # New: enable fuzzy fallback
        }

        if OPENAI_API_KEY:
            self.client = AsyncOpenAI(api_key=OPENAI_API_KEY)
        else:
            self.client = None
            logger.warning("⚠️ OPENAI_API_KEY not set - AI matching disabled")

    async def run_matching(
        self,
        batch_size: int = 10,
        use_ai: bool = True,
        prioritize_multi_aggregator: bool = True
    ) -> Dict[str, Any]:
        """
        Run product matching with optional multi-aggregator prioritization.

        Args:
            batch_size: Number of products to process per batch
            use_ai: Whether to use ChatGPT for verification
            prioritize_multi_aggregator: If True, process products with more
                aggregator coverage first
        """
        
        # Reset and init status
        MATCHING_STATUS['is_running'] = True
        MATCHING_STATUS['processed'] = 0
        MATCHING_STATUS['matched'] = 0
        MATCHING_STATUS['errors'] = 0
        MATCHING_STATUS['start_time'] = datetime.now().isoformat()
        MATCHING_STATUS['current_product'] = "Initializing..."

        # Get all products
        all_products = await self.db.products.find().to_list(length=50000)

        # Build indexes
        self._build_indexes(all_products)

        # Get reference products from our aggregator
        our_products = await self.db.products.find({
            'prices.aggregator': OUR_COMPANY
        }).to_list(length=10000)

        logger.info(f"📊 Found {len(our_products)} products from {OUR_COMPANY}")
        logger.info(f"📦 Total products in database: {len(all_products)}")

        # Count aggregators for each product
        product_agg_counts = {}
        for p in our_products:
            agg_count = len(set(price.get('aggregator') for price in p.get('prices', [])))
            product_agg_counts[str(p.get('_id'))] = agg_count

        # Prioritize by aggregator count if requested
        if prioritize_multi_aggregator:
            our_products.sort(
                key=lambda p: product_agg_counts.get(str(p.get('_id')), 0),
                reverse=True
            )
            logger.info("🎯 Prioritizing products with more aggregator coverage")

            logger.info("🎯 Prioritizing products with more aggregator coverage")

        results = {
            'total': len(our_products),
            'matched': 0,
            'no_match': 0,
            'errors': 0,
            'matches': [],
            'skips': []
        }
        
        MATCHING_STATUS['total'] = len(our_products)
        MATCHING_STATUS['current_product'] = "Starting batch processing..."

        # Process in batches
        for i in range(0, len(our_products), batch_size):
            batch = our_products[i:i+batch_size]

            for product in batch:
                try:
                    p_name = product.get('name', 'Unknown')
                    MATCHING_STATUS['current_product'] = p_name
                    
                    agg_count = product_agg_counts.get(str(product.get('_id')), 0)
                    match_result = await self._match_product(
                        product,
                        all_products,
                        use_ai=use_ai
                    )

                    if match_result['best_match'] == 'match':
                        results['matched'] += 1
                        MATCHING_STATUS['matched'] += 1
                        
                        results['matches'].append({
                            'product_name': product.get('name'),
                            'matched_name': match_result.get('matched_csv_title'),
                            'confidence': match_result.get('match_confidence'),
                            'reason': match_result.get('reason'),
                            'aggregator_count': agg_count
                        })

                        # Update product with match info and merge prices
                        matched_id = match_result['matched_uuid']
                        try:
                            # Convert to ObjectId if it's a valid hex string
                            if isinstance(matched_id, str) and len(matched_id) == 24:
                                matched_id = ObjectId(matched_id)
                        except Exception:
                            pass

                        matched_product = await self.db.products.find_one({
                            '_id': matched_id
                        })

                        if matched_product and 'prices' in matched_product:
                            # Merge prices into our product
                            existing_prices = product.get('prices', [])
                            new_prices = matched_product.get('prices', [])
                            
                            # Deduplicate by aggregator
                            merged_prices_map = {}
                            # Add existing prices first
                            for p in existing_prices:
                                agg = p.get('aggregator')
                                if agg:
                                    merged_prices_map[agg] = p
                            
                            # Override/Add new prices (competitor prices)
                            for p in new_prices:
                                agg = p.get('aggregator')
                                if agg:
                                    # If it's a competitor price, it's valuable
                                    merged_prices_map[agg] = p
                                    
                            final_prices = list(merged_prices_map.values())
                            
                            update_res = await self.db.products.update_one(
                                {'_id': product['_id']},
                                {
                                    '$set': {
                                        'mapping_status': 'matched',
                                        'match_result': match_result,
                                        'prices': final_prices
                                    }
                                }
                            )

                            # Remove standalone competitor product
                            await self.db.products.delete_one({
                                '_id': matched_id
                            })
                        else:
                            await self.db.products.update_one(
                                {'_id': product['_id']},
                                {'$set': {
                                    'mapping_status': 'matched',
                                    'match_result': match_result
                                }}
                            )
                    else:
                        results['no_match'] += 1
                        results['skips'].append({
                            'product_name': product.get('name'),
                            'reason': match_result.get('reason'),
                            'candidates_found': match_result.get('candidates_count', 0),
                            'aggregator_count': agg_count
                        })

                except Exception as e:
                    logger.error(f"Error matching {product.get('name')}: {e}")
                    results['errors'] += 1
                    MATCHING_STATUS['errors'] += 1

            # Progress logging
            processed = min(i + batch_size, len(our_products))
            MATCHING_STATUS['processed'] = processed
            logger.info(
                f"✅ Processed {processed}/{len(our_products)} | "
                f"Matched: {results['matched']} | "
                f"No Match: {results['no_match']} | "
                f"Errors: {results['errors']}"
            )

            await asyncio.sleep(0.1)
            
        MATCHING_STATUS['is_running'] = False
        MATCHING_STATUS['current_product'] = "Completed"

        return results

    def _transliterate(self, text: str, reverse: bool = False) -> str:
        """Transliterate text between Cyrillic and Latin"""
        if not text:
            return ""

        text = text.lower()
        mapping = REVERSE_TRANSLIT_MAP if reverse else TRANSLIT_MAP
        result = ""

        for char in text:
            result += mapping.get(char, char)

        return result

    def _normalize_string(self, s: str) -> str:
        """Normalize string for matching"""
        if not s:
            return ''

        s = str(s).lower().strip()
        # Remove special chars but keep important delimiters
        s = re.sub(r'[^\w\sа-яёіїєґ]', ' ', s)
        return ' '.join(s.split())

    def _extract_weight(self, product: Dict) -> Optional[float]:
        """Extract weight/volume in grams/ml"""
        # Check explicit weight fields
        weight_val = product.get('weight_value')
        weight_unit = str(product.get('weight_unit') or '').lower()

        if not weight_val:
            # Extract from name
            name = product.get('name', '')
            # Try multiple patterns
            patterns = [
                r'(\d+[.,]?\d*)\s*(?:г|кг|л|мл|g|kg|l|ml)\b',
                r'(\d+[.,]?\d*)\s*(?:гр|кг|литр|мл\b)',
            ]

            for pattern in patterns:
                match = re.search(pattern, str(name).lower())
                if match:
                    weight_val = float(match.group(1).replace(',', '.'))
                    # Determine unit from match
                    remaining = name[match.end():match.end()+10].lower()
                    if any(u in remaining for u in ['кг', 'kg', 'литр']):
                        weight_unit = 'kg'
                    elif any(u in remaining for u in ['л', 'l']):
                        weight_unit = 'l'
                    else:
                        weight_unit = 'g'
                    break

        if not weight_val:
            return None

        try:
            val = float(weight_val)
        except (ValueError, TypeError):
            return None

        # Convert to grams/ml
        multipliers = {
            'kg': 1000, 'кг': 1000,
            'g': 1, 'г': 1, 'гр': 1,
            'l': 1000, 'л': 1000, 'литр': 1000,
            'ml': 1, 'мл': 1,
        }

        unit_key = str(weight_unit or '').lower()
        return val * multipliers.get(unit_key, 1)

    def _extract_all_weights(self, name: str) -> List[Dict[str, Any]]:
        """Extract ALL weights/volumes from product name"""
        weights = []
        pattern = r'(\d+[.,]?\d*)\s*(?:г|кг|л|мл|g|kg|l|ml|гр)\b'

        for match in re.finditer(pattern, str(name).lower()):
            val = float(match.group(1).replace(',', '.'))
            unit = 'g'
            remaining = name[match.end():match.end()+10].lower()

            if any(u in remaining for u in ['кг', 'kg']):
                unit = 'kg'
                val *= 1000
            elif any(u in remaining for u in ['л', 'l']):
                unit = 'l'
                val *= 1000
            elif any(u in remaining for u in ['мл', 'ml']):
                unit = 'ml'

            weights.append({
                'value': val,
                'unit': unit,
                'position': match.start()
            })

        return weights

    def _get_brand_variants(self, brand: str) -> List[str]:
        """Get all possible brand name variants"""
        if not brand:
            return []

        variants = set()
        normalized = self._normalize_string(brand)
        variants.add(normalized)

        # Transliterations
        lat_to_cyr = self._transliterate(normalized, reverse=True)
        if lat_to_cyr != normalized:
            variants.add(lat_to_cyr)

        cyr_to_lat = self._transliterate(normalized, reverse=False)
        if cyr_to_lat != normalized:
            variants.add(cyr_to_lat)

        # Remove common suffixes
        for suffix in [' ltd', ' llc', ' ooo', ' gmbh', ' co', ' ltd.', ' corp']:
            clean = normalized.replace(suffix, '').strip()
            if clean and clean != normalized:
                variants.add(clean)

        return list(variants)

    def _get_synonym_group(self, word: str) -> Optional[str]:
        """Find which synonym group a word belongs to"""
        word_clean = word.lower().strip()

        for group_name, synonyms in SYNONYM_GROUPS.items():
            if word_clean in [s.lower() for s in synonyms]:
                return group_name

        return None

    def _count_shared_synonyms(self, name1: str, name2: str) -> int:
        """Count shared synonym groups between two product names"""
        words1 = set(self._normalize_string(name1).split())
        words2 = set(self._normalize_string(name2).split())

        groups1 = set()
        groups2 = set()

        for word in words1:
            group = self._get_synonym_group(word)
            if group:
                groups1.add(group)

        for word in words2:
            group = self._get_synonym_group(word)
            if group:
                groups2.add(group)

        return len(groups1 & groups2)

    def _build_indexes(self, products: List[Dict]):
        """Build comprehensive indexes for fast candidate lookup"""
        logger.info("🔍 Building product indexes...")

        self.brand_index = {}
        self.keyword_index = {}
        self.category_index = {}
        self.weight_index = {}  # Round weights for grouping
        self.synonym_group_index = {}

        for p in products:
            pid = str(p.get('_id', ''))

            # Brand index with all variants
            brand = self._normalize_string(p.get('brand', ''))
            brand_variants = self._get_brand_variants(brand)

            for variant in brand_variants:
                if variant:
                    if variant not in self.brand_index:
                        self.brand_index[variant] = []
                    if pid not in self.brand_index[variant]:
                        self.brand_index[variant].append(p)

            # Keyword index (all significant words)
            name = self._normalize_string(p.get('name', ''))
            keywords = [w for w in name.split() if len(w) > 2]

            for kw in keywords:
                if kw not in self.keyword_index:
                    self.keyword_index[kw] = []
                if pid not in self.keyword_index[kw]:
                    self.keyword_index[kw].append(p)

            # Category index
            category = self._normalize_string(p.get('category', ''))
            subcategory = self._normalize_string(p.get('subcategory', ''))

            for cat in [category, subcategory]:
                if cat and cat not in self.category_index:
                    self.category_index[cat] = []
                if cat and pid not in self.category_index.get(cat, []):
                    self.category_index[cat].append(p)

            # Weight index (rounded to nearest 50g/ml)
            weight = self._extract_weight(p)
            if weight:
                rounded = round(weight / 50) * 50
                if rounded not in self.weight_index:
                    self.weight_index[rounded] = []
                if pid not in self.weight_index[rounded]:
                    self.weight_index[rounded].append(p)

            # Synonym group index
            for word in keywords:
                group = self._get_synonym_group(word)
                if group:
                    if group not in self.synonym_group_index:
                        self.synonym_group_index[group] = []
                    if pid not in self.synonym_group_index[group]:
                        self.synonym_group_index[group].append(p)

        logger.info(f"✅ Indexes built:")
        logger.info(f"   - Brands: {len(self.brand_index)}")
        logger.info(f"   - Keywords: {len(self.keyword_index)}")
        logger.info(f"   - Categories: {len(self.category_index)}")
        logger.info(f"   - Weights: {len(self.weight_index)}")
        logger.info(f"   - Synonym groups: {len(self.synonym_group_index)}")

    async def _match_product(
        self,
        product: Dict,
        all_products: List[Dict],
        use_ai: bool = True
    ) -> Dict[str, Any]:
        """Match a single product with enhanced candidate finding"""

        # Find candidates using multiple strategies
        candidates = self._find_candidates_enhanced(product, all_products)
        
        # If no candidates found with strict/smart strategies, try fallback
        if not candidates and self.config.get('enable_fallback', False):
            candidates = self._find_candidates_fallback(product, all_products)

        if not candidates:
            return {
                'best_match': 'no_match',
                'match_confidence': 0,
                'matched_uuid': None,
                'matched_csv_title': None,
                'reason': 'Не найдено кандидатов',
                'candidates_count': 0
            }

        # Check for auto-match
        top_candidate = candidates[0]

        # Very high threshold for auto-match without AI
        if top_candidate['score'] >= self.config['auto_match_threshold']:
            return {
                'best_match': 'match',
                'match_confidence': min(top_candidate['score'], 99),
                'matched_uuid': str(top_candidate['product'].get('_id', '')),
                'matched_csv_title': top_candidate['product'].get('name'),
                'reason': f"Автоматический матч (скор: {int(top_candidate['score'])}): {top_candidate['reasons']}",
                'candidates_count': len(candidates)
            }

        # Use AI for verification
        if use_ai and self.client:
            return await self._match_with_ai(product, candidates)

        # Fallback: use top candidate
        if top_candidate['score'] >= self.config['match_threshold']:
            return {
                'best_match': 'match',
                'match_confidence': top_candidate['score'],
                'matched_uuid': str(top_candidate['product'].get('_id', '')),
                'matched_csv_title': top_candidate['product'].get('name'),
                'reason': f"Лучший кандидат без AI: {top_candidate['reasons']}",
                'candidates_count': len(candidates)
            }

        return {
            'best_match': 'no_match',
            'match_confidence': top_candidate['score'],
            'matched_uuid': None,
            'matched_csv_title': None,
            'reason': f'Уверенность {int(top_candidate["score"])}% ниже порога {self.config["match_threshold"]}%',
            'candidates_count': len(candidates)
        }

    def _find_candidates_enhanced(
        self,
        product: Dict,
        all_products: List[Dict]
    ) -> List[Dict]:
        """
        Enhanced multi-strategy candidate finding.

        Strategies (tried in order):
        1. Exact brand match
        2. Brand + category match
        3. Synonym group match
        4. Weight range matching
        5. Multiple keyword overlap
        6. Fuzzy brand matching
        7. Category + keyword match
        """

        product_name = self._normalize_string(product.get('name', ''))
        product_brand = self._normalize_string(product.get('brand', ''))
        product_weight = self._extract_weight(product)
        product_category = self._normalize_string(product.get('category', ''))
        product_id = str(product.get('_id', ''))

        candidates = {}

        # Strategy 1: Exact brand match (highest priority)
        brand_variants = self._get_brand_variants(product_brand)

        for brand_variant in brand_variants:
            if brand_variant in self.brand_index:
                for p in self.brand_index[brand_variant]:
                    pid = str(p.get('_id', ''))
                    if pid != product_id:
                        self._score_candidate_enhanced(
                            p,
                            product_name,
                            product_brand,
                            product_weight,
                            candidates,
                            boost=20  # Brand match gets big boost
                        )

        # Strategy 2: Brand + category combo
        for brand_variant in brand_variants:
            if brand_variant in self.brand_index and product_category:
                for p in self.brand_index[brand_variant]:
                    pid = str(p.get('_id', ''))
                    if pid != product_id:
                        p_category = self._normalize_string(p.get('category', ''))
                        if p_category == product_category:
                            # Additional boost for brand + category match
                            self._score_candidate_enhanced(
                                p,
                                product_name,
                                product_brand,
                                product_weight,
                                candidates,
                                boost=10
                            )

        # Strategy 3: Synonym group matching (very powerful)
        product_keywords = set(product_name.split())
        product_synonym_groups = set()

        for kw in product_keywords:
            group = self._get_synonym_group(kw)
            if group:
                product_synonym_groups.add(group)

        for group in product_synonym_groups:
            if group in self.synonym_group_index:
                for p in self.synonym_group_index[group]:
                    pid = str(p.get('_id', ''))
                    if pid != product_id:
                        # Count shared synonym groups
                        shared_synonyms = self._count_shared_synonyms(
                            product_name,
                            p.get('name', '')
                        )
                        if shared_synonyms > 0:
                            self._score_candidate_enhanced(
                                p,
                                product_name,
                                product_brand,
                                product_weight,
                                candidates,
                                boost=shared_synonyms * 15  # Per shared synonym group
                            )

        # Strategy 4: Weight range matching (within tolerance)
        if product_weight:
            tolerance = self.config['weight_tolerance']
            ratio_tolerance = self.config['weight_tolerance_ratio']

            for weight_bucket in self.weight_index.keys():
                weight_diff = abs(weight_bucket - product_weight)

                if weight_diff <= tolerance or weight_diff <= product_weight * ratio_tolerance:
                    for p in self.weight_index[weight_bucket]:
                        pid = str(p.get('_id', ''))
                        if pid != product_id:
                            self._score_candidate_enhanced(
                                p,
                                product_name,
                                product_brand,
                                product_weight,
                                candidates,
                                boost=15 if weight_diff == 0 else 5
                            )

        # Strategy 5: Multiple keyword overlap (at least 2 matching keywords)
        if len(product_keywords) >= 2:
            keyword_hits = Counter()

            for kw in product_keywords:
                if kw in self.keyword_index:
                    for p in self.keyword_index[kw]:
                        pid = str(p.get('_id', ''))
                        keyword_hits[pid] += 1

            # Products with 1+ keyword matches (loosened)
            for pid, hit_count in keyword_hits.items():
                if pid != product_id:
                    # Allow 1-keyword match if the keyword is significant (len >= 5)
                    # or if we have 2+ matches
                    is_significant = any(len(kw) >= 5 for kw in product_keywords if pid in [str(item.get('_id')) for item in self.keyword_index.get(kw, [])])
                    
                    if hit_count >= 2 or (hit_count >= 1 and is_significant):
                        p = next((p for p in all_products if str(p.get('_id')) == pid), None)
                        if p:
                            self._score_candidate_enhanced(
                                p,
                                product_name,
                                product_brand,
                                product_weight,
                                candidates,
                                boost=hit_count * 8
                            )

        # Strategy 6: Fuzzy brand matching (Levenshtein-like)
        if product_brand and len(product_brand) >= 3:
            for b in self.brand_index.keys():
                if len(b) >= 3:
                    similarity = SequenceMatcher(None, product_brand, b).ratio()
                    if similarity > 0.7:  # Fuzzy threshold
                        for p in self.brand_index[b]:
                            pid = str(p.get('_id', ''))
                            if pid != product_id and pid not in candidates:
                                self._score_candidate_enhanced(
                                    p,
                                    product_name,
                                    product_brand,
                                    product_weight,
                                    candidates,
                                    boost=int(similarity * 25)
                                )

        # Strategy 7: Category + keyword match (when brand is unknown)
        if not product_brand and product_category:
            if product_category in self.category_index:
                for p in self.category_index[product_category]:
                    pid = str(p.get('_id', ''))
                    if pid != product_id:
                        # Check keyword overlap
                        p_name = self._normalize_string(p.get('name', ''))
                        p_keywords = set(p_name.split())
                        overlap = len(product_keywords & p_keywords)

                        if overlap >= 2:
                            self._score_candidate_enhanced(
                                p,
                                product_name,
                                product_brand,
                                product_weight,
                                candidates,
                                boost=overlap * 5
                            )

        # Strategy 8: Loose Brand + Category (Brand match is prioritized)
        if product_brand:
            brand_variants = self._get_brand_variants(product_brand)
            for variant in brand_variants:
                if variant in self.brand_index:
                    for p in self.brand_index[variant]:
                        pid = str(p.get('_id', ''))
                        if pid != product_id and pid not in candidates:
                            # Even if category is different, keep as candidate if brand is strong
                            self._score_candidate_enhanced(
                                p,
                                product_name,
                                product_brand,
                                product_weight,
                                candidates,
                                boost=15
                            )

        # Sort candidates and limit
        sorted_candidates = sorted(
            candidates.values(),
            key=lambda x: (x['score'], x['aggregator_count']),
            reverse=True
        )[:self.config['max_candidates']]

        logger.debug(
            f"Found {len(sorted_candidates)} candidates for: {product_name[:50]}"
        )

        return sorted_candidates

    def _score_candidate_enhanced(
        self,
        candidate: Dict,
        product_name: str,
        product_brand: str,
        product_weight: Optional[float],
        candidates: Dict,
        boost: int = 0
    ):
        """Enhanced scoring for candidate products"""
        # EXCLUDE self-matches from the same aggregator
        cand_prices = candidate.get('prices', [])
        cand_aggregators = set(p.get('aggregator') for p in cand_prices)
        
        if OUR_COMPANY in cand_aggregators and len(cand_aggregators) == 1:
            # This is a pure product from our own aggregator, skip it
            return

        cand_name = self._normalize_string(candidate.get('name', ''))
        cand_brand = self._normalize_string(candidate.get('brand', ''))
        cand_weight = self._extract_weight(candidate)
        cand_id = str(candidate.get('_id', ''))

        # Count aggregators
        aggregator_count = len(set(
            price.get('aggregator')
            for price in candidate.get('prices', [])
        ))

        score = 0
        reasons = []

        # Brand matching (up to 30 points)
        if product_brand and cand_brand:
            if product_brand == cand_brand:
                score += 30
                reasons.append('brand:exact')
            else:
                # Check transliterations
                brand_variants = set(self._get_brand_variants(product_brand))
                cand_variants = set(self._get_brand_variants(cand_brand))

                if brand_variants & cand_variants:
                    score += 28
                    reasons.append('brand:translit')
                elif SequenceMatcher(None, product_brand, cand_brand).ratio() > 0.8:
                    score += 20
                    reasons.append('brand:similar')

        # Weight matching (up to 35 points)
        if product_weight and cand_weight:
            diff = abs(product_weight - cand_weight)
            tolerance = self.config['weight_tolerance']
            ratio_diff = diff / max(product_weight, cand_weight) if product_weight > 0 else 1

            if diff == 0:
                score += 35
                reasons.append('weight:exact')
            elif diff <= tolerance or ratio_diff <= self.config['weight_tolerance_ratio']:
                score += 25
                reasons.append(f'weight:±{int(diff)}')

        # Title similarity (up to 25 points)
        word_overlap = self._word_overlap_score(product_name, cand_name)
        if word_overlap > 0:
            score += int(word_overlap * 25)
            reasons.append(f'title:{int(word_overlap * 100)}%')

        # Synonym group match (up to 20 points)
        shared_synonyms = self._count_shared_synonyms(product_name, cand_name)
        if shared_synonyms > 0:
            score += min(shared_synonyms * 10, 20)
            reasons.append(f'synonyms:{shared_synonyms}')

        # Aggregator count boost (up to 10 points)
        # Products with more aggregator data are prioritized
        if aggregator_count > 1:
            score += min(aggregator_count * 3, 10)
            reasons.append(f'aggs:{aggregator_count}')

        # Apply boost from search strategy
        score += boost

        # Minimum threshold to be considered
        min_threshold = self.config['min_candidate_threshold']

        if score >= min_threshold:
            candidates[cand_id] = {
                'product': candidate,
                'score': min(score, 100),
                'reasons': ', '.join(reasons),
                'aggregator_count': aggregator_count
            }

    def _find_candidates_fallback(self, product: Dict, all_products: List[Dict]) -> List[Dict]:
        """
        Fallback strategy: Bruteforce fuzzy search if indexes fail.
        This is slower but ensures we find something if it exists.
        """
        product_name = self._normalize_string(product.get('name', ''))
        product_id = str(product.get('_id', ''))
        product_weight = self._extract_weight(product)
        
        if len(product_name) < 3:
            return []
            
        candidates = {}
        
        # We need to iterate all products since indexes didn't help
        # Optimizing by doing a quick check first
        
        # Pre-filter by weight if we have it
        potential_pool = []
        if product_weight:
            # Only check products with same weight unit class (ignoring small diffs)
            tolerance = self.config['weight_tolerance'] * 2 # Double tolerance for fallback
            
            for p in all_products:
                pid = str(p.get('_id', ''))
                if pid == product_id:
                    continue
                    
                p_weight = self._extract_weight(p)
                if p_weight:
                    if abs(p_weight - product_weight) <= tolerance:
                        potential_pool.append(p)
                else:
                    # If product has no weight, include it just in case
                    potential_pool.append(p)
        else:
            potential_pool = all_products
            
        # Fuzzy match on name for the pool
        # Limit pool size to avoid timeout if it's too huge
        if len(potential_pool) > 10000:
             # Random sample or just first N might be bad, but better than freezing
             # Let's trust that previous steps filtered easy strict matches
             pass

        for p in potential_pool[:5000]: # Check at most 5000 to be safe
             pid = str(p.get('_id', ''))
             if pid == product_id:
                continue
                
             p_name = self._normalize_string(p.get('name', ''))
             
             # Quick substring check
             # If significant words from source are in target
             p_words = set(product_name.split())
             c_words = set(p_name.split())
             
             overlap = len(p_words & c_words)
             # simple ratio
             if overlap >= 2 or (overlap == 1 and len(p_words) <= 2):
                 # Detail check
                 ratio = SequenceMatcher(None, product_name, p_name).ratio()
                 if ratio > 0.4: # Very loose threshold
                     self._score_candidate_enhanced(
                        p, product_name, 
                        product.get('brand',''), 
                        product_weight, 
                        candidates, 
                        boost=int(ratio * 10)
                     )
                     
        sorted_candidates = sorted(
            candidates.values(),
            key=lambda x: (x['score'], x['aggregator_count']),
            reverse=True
        )[:20] # Return top 20 fallback candidates
        
        if sorted_candidates:
            logger.info(f"⚠️ Used fallback strategy for '{product.get('name')}': found {len(sorted_candidates)} candidates")
            
        return sorted_candidates

    def _word_overlap_score(self, s1: str, s2: str) -> float:
        """Calculate word overlap score"""
        if not s1 or not s2:
            return 0

        words1 = set(w for w in s1.split() if len(w) > 2)
        words2 = set(w for w in s2.split() if len(w) > 2)

        if not words1 or not words2:
            return 0

        # Intersection over max
        matches = len(words1 & words2)
        return matches / max(len(words1), len(words2))

    async def _match_with_ai(
        self,
        product: Dict,
        candidates: List[Dict]
    ) -> Dict[str, Any]:
        """Use ChatGPT with enhanced prompt for intelligent matching"""

        prompt = self._build_enhanced_prompt(product, candidates)

        try:
            response = await self.client.chat.completions.create(
                model=OPENAI_MODEL,
                messages=[
                    {
                        'role': 'system',
                        'content': self._get_system_prompt()
                    },
                    {
                        'role': 'user',
                        'content': prompt
                    }
                ],
                temperature=0.1,  # Low temp for consistent reasoning
                max_tokens=1500,  # Generous token budget
                response_format={'type': 'json_object'}
            )

            content = response.choices[0].message.content
            result = json.loads(content)

            confidence = result.get('match_confidence', 0)
            threshold = self.config['match_threshold']

            # Aggressive matching with leniency
            force_match = False
            if result.get('best_match') == 'match':
                if confidence >= threshold:
                    pass  # Normal match
                elif confidence >= threshold - 20:
                    # Leniency: accept if AI is reasonably confident
                    force_match = True
                else:
                    result['best_match'] = 'no_match'
                    result['reason'] = (
                        f"Уверенность {confidence}% < порога {threshold}%"
                    )

            return {
                'matched_uuid': result.get('matched_uuid'),
                'matched_csv_title': result.get('matched_csv_title'),
                'match_confidence': confidence,
                'best_match': (
                    result.get('best_match', 'no_match')
                    if not force_match
                    else 'match'
                ),
                'reason': result.get('reasoning') or result.get('reason', ''),
                'candidates_count': len(candidates)
            }

        except Exception as e:
            logger.error(f"ChatGPT API error: {e}")
            return {
                'best_match': 'no_match',
                'match_confidence': 0,
                'matched_uuid': None,
                'matched_csv_title': None,
                'reason': f'Ошибка ChatGPT: {str(e)}',
                'candidates_count': len(candidates)
            }

        finally:
            # Rate limiting
            await asyncio.sleep(self.config['delay_ms'] / 1000)

    def _get_system_prompt(self) -> str:
        """Get comprehensive system prompt for ChatGPT"""
        return """You are an expert FMCG product matcher specializing in identifying identical products across different aggregators.

CORE PRINCIPLE: Be AGGRESSIVE and SMART in matching. If two products are clearly the same item despite naming differences, MATCH them.

CRITICAL RULES:

STRICT NO-MATCH CATEGORIES (these are different products):
1. Different meat parts: Chicken Wing ≠ Chicken Drumstick ≠ Chicken Breast
2. Different flavors: Orange ≠ Lemon ≠ Vanilla ≠ Chocolate
3. Different fat content: 2.5% milk ≠ 3.2% milk ≠ 5% yogurt
4. Completely different categories: Diapers ≠ Wipes ≠ Soap

ALLOWED VARIATIONS (these can be MATCH):
1. Synonyms: "Liquid soap" = "Гель" = "Dishwashing liquid" = "Средство для мытья посуды"
2. Transliteration: "Прил" = "Pril", "Fairy" = "Фейри", "Tide" = "Тайд"
3. Weight units: "0.5L" = "500ml" = "0.5kg" (for liquids)
4. Naming styles: "Chicken breast" = "Chicken Breast" = "Грудка куриная"
5. Different descriptors for same item: "Crispy" = "Хрустящие", "Spicy" = "Острые" (if base product is same)

DECISION THRESHOLDS:
- 85%+ confidence: Definitely same product
- 70-84%: Very likely same product - accept with clear reasoning
- 55-69%: Likely same product - accept if multiple positive signals
- Below 55%: Uncertain - prefer no match

PRIORITIZATION FACTORS:
1. Brand match (exact or transliteration) - STRONGEST signal
2. Weight/volume match within ±200g or ±30%
3. Product type match (via synonyms)
4. Similar naming patterns
5. Category/subcategory agreement

REASONING REQUIREMENT:
Always explain your decision clearly citing specific evidence from product attributes."""

    def _build_enhanced_prompt(
        self,
        product: Dict,
        candidates: List[Dict]
    ) -> str:
        """Build comprehensive prompt for ChatGPT with full product details"""

        product_name = product.get('name', '')
        product_brand = product.get('brand', '')

        # Weight information
        weight_val = product.get('weight_value')
        weight_unit = product.get('weight_unit', '')
        product_weight = f"{weight_val} {weight_unit}" if weight_val else 'Не указан'

        normalized_weight = self._extract_weight(product)

        # Categorization
        is_brandless = self._is_brandless_product(product)
        aggregator_count = len(set(
            price.get('aggregator')
            for price in product.get('prices', [])
        ))

        prompt = f"""IDENTIFY THE EXACT SAME PRODUCT from the candidate list.

BE AGGRESSIVE: If brand and weight align with similar product type, it's likely a MATCH. Don't be overly pedantic about word choice.

SOURCE PRODUCT:
- Name: {product_name}
- Brand: {product_brand or "Not specified"}
- Weight/Volume: {product_weight} ({normalized_weight or '-'}g/ml)
- Category: {product.get('category', '-')}
- Subcategory: {product.get('subcategory', '-')}
- Aggregator coverage: {aggregator_count}
- Type: {"Brandless product - match by variety and weight" if is_brandless else "Branded product - match by brand, weight, and type"}

CANDIDATES (analyzed in order of relevance):
"""

        for i, c in enumerate(candidates):
            p = c['product']

            # Extract all relevant info
            cand_name = p.get('name', '')
            cand_brand = p.get('brand', '')
            cand_weight = f"{p.get('weight_value', '')} {p.get('weight_unit', '')}"
            cand_norm_weight = self._extract_weight(p)
            cand_category = p.get('category', '')
            cand_subcategory = p.get('subcategory', '')
            cand_uuid = str(p.get('_id', ''))
            cand_agg_count = c.get('aggregator_count', 0)

            # Calculate weight difference
            weight_diff = None
            if normalized_weight and cand_norm_weight:
                weight_diff = abs(normalized_weight - cand_norm_weight)

            prompt += f"""{i + 1}. [ID: {cand_uuid}]
   Name: {cand_name}
   Brand: {cand_brand or 'Not specified'}
   Weight: {cand_weight} ({cand_norm_weight or '-'}g/ml)
   Category: {cand_category} / {cand_subcategory}
   Local score: {c['score']:.0f}
   Aggregator count: {cand_agg_count}
   Match signals: {c['reasons']}
   Weight difference: {f'±{int(weight_diff)}g' if weight_diff else 'N/A'}

"""

        prompt += """
MATCHING INSTRUCTIONS:
1. Look for the BEST match, not perfect match
2. Focus on: BRAND + WEIGHT/VOLUME + PRODUCT TYPE
3. Ignore naming differences that are just synonyms or transliteration
4. Accept matches if confidence is ≥70% unless there's a clear reason not to
5. For brandless products, focus on variety/weight/category
6. Products with higher aggregator counts are better candidates

STRICTLY NO-MATCH if:
- Different meat parts (wing vs drumstick vs breast)
- Different flavors/vibrations (orange vs lemon, vanilla vs chocolate)
- Different fat percentages (2.5% vs 3.2%)
- Fundamentally different product types

RETURN JSON:
{
  "reasoning": "Detailed explanation: why this is/isn't the same product (cite brand match, weight, synonyms, type)",
  "matched_uuid": "Candidate UUID or null",
  "matched_csv_title": "Candidate name or null",
  "match_confidence": 0-100,
  "best_match": "match" | "no_match"
}
"""
        return prompt

    def _is_brandless_product(self, product: Dict) -> bool:
        """Check if product is typically brandless (fresh produce, etc.)"""
        name = (product.get('name') or '').lower()
        category = (product.get('category') or '').lower()
        subcategory = (product.get('subcategory') or '').lower()

        brandless_keywords = [
            'овощ', 'фрукт', 'ягод', 'egg', 'яйц',
            'vegetable', 'fruit', 'berry', 'meat', 'мясо',
            'картофель', 'potato', 'морковь', 'carrot', 'лук', 'onion',
            'помидор', 'tomato', 'огурец', 'cucumber', 'капуста', 'cabbage',
            'яблоко', 'apple', 'груша', 'pear', 'банан', 'banana',
            'рыба', 'fish', 'сыр', 'cheese'
        ]

        text = f"{name} {category} {subcategory}"
        return any(kw in text for kw in brandless_keywords)
