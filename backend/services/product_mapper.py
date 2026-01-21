"""
Product Mapper Service

AI-powered product matching using ChatGPT.
Matches products from different aggregators to identify same products.

Key features:
- Candidate finding using brand, weight, and keyword matching
- AI verification with ChatGPT for confident matching
- Batch processing with rate limiting
- Automatic high-confidence matching without AI when possible
"""

import os
import re
import json
import asyncio
import logging
from typing import List, Dict, Any, Optional
from datetime import datetime
from difflib import SequenceMatcher

from openai import AsyncOpenAI
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger(__name__)

# Configuration
OPENAI_API_KEY = os.getenv('OPENAI_API_KEY')
OPENAI_MODEL = os.getenv('OPENAI_MODEL', 'gpt-4o-mini')
OUR_COMPANY = os.getenv('OUR_COMPANY_AGGREGATOR', 'Glovo')


class ProductMapper:
    """
    AI Product Mapper using ChatGPT.
    
    Matches products across aggregators by:
    1. Finding candidates using fast local matching (brand, weight, keywords)
    2. Using ChatGPT to verify matches with provided prompt format
    """
    
    def __init__(self, db, config: Optional[Dict] = None):
        self.db = db
        self.config = config or {
            'match_threshold': 90,  # Minimum confidence for match
            'max_candidates': 15,   # Max candidates to send to GPT
            'batch_size': 10,       # Products per batch
            'delay_ms': 300,        # Delay between API calls
            'weight_tolerance': 100, # Weight tolerance in grams/ml
            'auto_match_threshold': 90,  # Auto-match without AI if score >= this
        }
        
        if OPENAI_API_KEY:
            self.client = AsyncOpenAI(api_key=OPENAI_API_KEY)
        else:
            self.client = None
            logger.warning("⚠️ OPENAI_API_KEY not set - AI matching disabled")
    
    async def run_matching(
        self,
        batch_size: int = 10,
        use_ai: bool = True
    ) -> Dict[str, Any]:
        """
        Run matching on products.
        
        For each product from one aggregator, finds matching products
        from other aggregators.
        """
        
        # Get reference products (from our company - Glovo)
        our_products = await self.db.products.find({
            'prices.aggregator': OUR_COMPANY
        }).to_list(length=10000)
        
        logger.info(f"📊 Found {len(our_products)} products from {OUR_COMPANY}")
        
        # Get all products for matching
        all_products = await self.db.products.find().to_list(length=50000)
        
        # Build index for fast candidate lookup
        self._build_indexes(all_products)
        
        results = {
            'total': len(our_products),
            'matched': 0,
            'no_match': 0,
            'errors': 0,
            'matches': []
        }
        
        # Process in batches
        for i in range(0, len(our_products), batch_size):
            batch = our_products[i:i+batch_size]
            
            for product in batch:
                try:
                    match_result = await self._match_product(
                        product, 
                        all_products,
                        use_ai=use_ai
                    )
                    
                    if match_result['best_match'] == 'match':
                        results['matched'] += 1
                        results['matches'].append({
                            'product_name': product.get('name'),
                            'matched_name': match_result.get('matched_csv_title'),
                            'confidence': match_result.get('match_confidence'),
                            'reason': match_result.get('reason')
                        })
                        
                        # Update product with match info
                        await self.db.products.update_one(
                            {'_id': product['_id']},
                            {'$set': {
                                'mapping_status': 'matched',
                                'match_result': match_result
                            }}
                        )
                    else:
                        results['no_match'] += 1
                        
                except Exception as e:
                    logger.error(f"Error matching {product.get('name')}: {e}")
                    results['errors'] += 1
            
            # Small delay between batches
            await asyncio.sleep(0.1)
            
            logger.info(f"Processed {min(i + batch_size, len(our_products))}/{len(our_products)}")
        
        return results
    
    def _build_indexes(self, products: List[Dict]):
        """Build indexes for fast candidate lookup"""
        self.brand_index = {}
        self.keyword_index = {}
        
        for p in products:
            name = self._normalize_string(p.get('name', ''))
            brand = self._normalize_string(p.get('brand', ''))
            
            # Index by brand
            if brand:
                if brand not in self.brand_index:
                    self.brand_index[brand] = []
                self.brand_index[brand].append(p)
            
            # Index by keywords (first 3 significant words)
            keywords = [w for w in name.split() if len(w) > 3][:3]
            for kw in keywords:
                if kw not in self.keyword_index:
                    self.keyword_index[kw] = []
                self.keyword_index[kw].append(p)
    
    async def _match_product(
        self, 
        product: Dict, 
        all_products: List[Dict],
        use_ai: bool = True
    ) -> Dict[str, Any]:
        """Match a single product"""
        
        # Find candidates
        candidates = self._find_candidates(product, all_products)
        
        if not candidates:
            return {
                'best_match': 'no_match',
                'match_confidence': 0,
                'matched_uuid': None,
                'matched_csv_title': None,
                'reason': 'Нет подходящих кандидатов'
            }
        
        # Check for auto-match (high score candidate)
        top_candidate = candidates[0]
        if top_candidate['score'] >= self.config['auto_match_threshold']:
            if 'brand:match' in top_candidate.get('reasons', ''):
                return {
                    'best_match': 'match',
                    'match_confidence': min(top_candidate['score'], 98),
                    'matched_uuid': str(top_candidate['product'].get('_id', '')),
                    'matched_csv_title': top_candidate['product'].get('name'),
                    'reason': f"Автоматический матч: {top_candidate['reasons']}"
                }
        
        # Use AI for verification
        if use_ai and self.client:
            return await self._match_with_ai(product, candidates)
        
        # Fallback: use top candidate if score is good enough
        if top_candidate['score'] >= 70:
            return {
                'best_match': 'match',
                'match_confidence': top_candidate['score'],
                'matched_uuid': str(top_candidate['product'].get('_id', '')),
                'matched_csv_title': top_candidate['product'].get('name'),
                'reason': f"Лучший кандидат (без AI): {top_candidate['reasons']}"
            }
        
        return {
            'best_match': 'no_match',
            'match_confidence': top_candidate['score'],
            'matched_uuid': None,
            'matched_csv_title': None,
            'reason': 'Уверенность ниже порога'
        }
    
    def _find_candidates(
        self, 
        product: Dict, 
        all_products: List[Dict]
    ) -> List[Dict]:
        """Find candidate matches using fast local matching"""
        
        product_name = self._normalize_string(product.get('name', ''))
        product_brand = self._normalize_string(product.get('brand', ''))
        product_weight = self._extract_weight(product)
        product_id = str(product.get('_id', ''))
        
        candidates = {}
        
        # Strategy 1: Match by brand
        if product_brand:
            brand_matches = self.brand_index.get(product_brand, [])
            for p in brand_matches:
                pid = str(p.get('_id', ''))
                if pid != product_id:
                    self._score_candidate(
                        p, product_name, product_brand, product_weight, candidates
                    )
        
        # Strategy 2: Match by keywords
        keywords = [w for w in product_name.split() if len(w) > 3][:5]
        for kw in keywords:
            kw_matches = self.keyword_index.get(kw, [])
            for p in kw_matches:
                pid = str(p.get('_id', ''))
                if pid != product_id and pid not in candidates:
                    self._score_candidate(
                        p, product_name, product_brand, product_weight, candidates
                    )
        
        # Sort and limit
        result = sorted(
            candidates.values(),
            key=lambda x: x['score'],
            reverse=True
        )[:self.config['max_candidates']]
        
        return result
    
    def _score_candidate(
        self,
        candidate: Dict,
        product_name: str,
        product_brand: str,
        product_weight: Optional[float],
        candidates: Dict
    ):
        """Score a candidate product"""
        
        cand_name = self._normalize_string(candidate.get('name', ''))
        cand_brand = self._normalize_string(candidate.get('brand', ''))
        cand_weight = self._extract_weight(candidate)
        cand_id = str(candidate.get('_id', ''))
        
        score = 0
        reasons = []
        
        # Brand matching (35 points)
        if product_brand and cand_brand:
            if product_brand == cand_brand:
                score += 35
                reasons.append('brand:match')
            elif self._fuzzy_ratio(product_brand, cand_brand) > 0.8:
                score += 25
                reasons.append('brand:similar')
        
        # Weight matching (40 points)
        if product_weight and cand_weight:
            diff = abs(product_weight - cand_weight)
            tolerance = self.config['weight_tolerance']
            if diff == 0:
                score += 40
                reasons.append('weight:exact')
            elif diff <= tolerance:
                score += 30
                reasons.append(f'weight:±{int(diff)}')
        
        # Title similarity (25 points)
        similarity = self._title_similarity(product_name, cand_name)
        if similarity > 0.3:
            title_points = int(similarity * 25)
            score += title_points
            reasons.append(f'title:{int(similarity * 100)}%')
        
        if score > 20:  # Minimum threshold
            candidates[cand_id] = {
                'product': candidate,
                'score': score,
                'reasons': ', '.join(reasons)
            }
    
    async def _match_with_ai(
        self, 
        product: Dict, 
        candidates: List[Dict]
    ) -> Dict[str, Any]:
        """Use ChatGPT to verify match"""
        
        prompt = self._build_prompt(product, candidates)
        
        try:
            response = await self.client.chat.completions.create(
                model=OPENAI_MODEL,
                messages=[{'role': 'user', 'content': prompt}],
                temperature=0.1,
                max_tokens=500,
                response_format={'type': 'json_object'}
            )
            
            content = response.choices[0].message.content
            result = json.loads(content)
            
            # Validate threshold
            confidence = result.get('match_confidence', 0)
            threshold = self.config['match_threshold']
            
            if result.get('best_match') == 'match' and confidence < threshold:
                result['best_match'] = 'no_match'
                result['reason'] = f"Уверенность {confidence}% < порога {threshold}%"
            
            return {
                'matched_uuid': result.get('matched_uuid'),
                'matched_csv_title': result.get('matched_csv_title'),
                'match_confidence': confidence,
                'best_match': result.get('best_match', 'no_match'),
                'reason': result.get('reason', '')
            }
            
        except Exception as e:
            logger.error(f"ChatGPT error: {e}")
            return {
                'best_match': 'no_match',
                'match_confidence': 0,
                'matched_uuid': None,
                'matched_csv_title': None,
                'reason': f'Ошибка ChatGPT: {str(e)}'
            }
        
        finally:
            # Rate limiting
            await asyncio.sleep(self.config['delay_ms'] / 1000)
    
    def _build_prompt(self, product: Dict, candidates: List[Dict]) -> str:
        """Build prompt for ChatGPT - using provided format"""
        
        product_name = product.get('name', '')
        product_brand = product.get('brand', '')
        
        # Get weight
        weight_val = product.get('weight_value')
        weight_unit = product.get('weight_unit', '')
        product_weight = f"{weight_val} {weight_unit}" if weight_val else 'Не указан'
        
        normalized_weight = self._extract_weight(product)
        
        # Check if brandless product
        is_brandless = self._is_brandless_product(product)
        
        prompt = f"""Ты эксперт по сопоставлению товаров. Найди СОВПАДЕНИЕ для товара среди кандидатов из CSV.

✅ ПРАВИЛА МАППИНГА:
1. Если уверенность ≥90% → "match", иначе → "no_match"
{'2. ⚠️ ТОВАР БЕЗ БРЕНДА (овощи/фрукты/мясо) - бренд НЕ проверяй!' if is_brandless else '2. ✅ Бренд ДОЛЖЕН совпадать (учитывай транслитерацию)'}
3. ✅ Вес/объем: допуск ±100г/мл
4. ✅ Вкус: похожие вкусы = не совпадение

📦 Товар:
Название: {product_name}
{'⚠️ БЕЗБРЕНДОВЫЙ' if is_brandless else f'Бренд: {product_brand or "Не указан"}'}
Вес/Объём: {product_weight} ({normalized_weight or '-'})

🎯 Кандидаты из CSV:
"""
        
        for i, c in enumerate(candidates):
            p = c['product']
            cand_brand = p.get('brand', '')
            cand_weight = f"{p.get('weight_value', '')} {p.get('weight_unit', '')}"
            cand_norm_weight = self._extract_weight(p)
            cand_uuid = str(p.get('_id', ''))
            cand_category = p.get('category', '')
            
            prompt += f"""{i + 1}. UUID: {cand_uuid}
   Название: {p.get('name', '')}
   Бренд: {cand_brand or 'Не указан'}
   Вес: {cand_weight} ({cand_norm_weight or '-'})
   Категория: {cand_category or '-'}

"""
        
        prompt += """
Верни СТРОГО в формате JSON:
{
  "matched_uuid": "UUID из CSV или null",
  "matched_csv_title": "Название из CSV или null",
  "match_confidence": 0-100,
  "best_match": "match" | "no_match",
  "reason": "Краткое объяснение"
}
"""
        
        return prompt
    
    def _normalize_string(self, s: str) -> str:
        """Normalize string for matching"""
        if not s:
            return ''
        s = str(s).lower().strip()
        s = re.sub(r'[^a-z0-9а-яё\s]', ' ', s)
        return ' '.join(s.split())
    
    def _extract_weight(self, product: Dict) -> Optional[float]:
        """Extract weight in grams/ml"""
        weight_val = product.get('weight_value')
        weight_unit = product.get('weight_unit', 'g')
        
        if not weight_val:
            # Try to extract from name
            name = product.get('name', '')
            match = re.search(r'(\d+[.,]?\d*)\s*(г|кг|л|мл|g|kg|l|ml)', str(name).lower())
            if match:
                weight_val = float(match.group(1).replace(',', '.'))
                weight_unit = match.group(2)
            else:
                return None
        
        try:
            val = float(weight_val)
        except:
            return None
        
        # Convert to grams/ml
        multipliers = {
            'kg': 1000, 'кг': 1000,
            'g': 1, 'г': 1,
            'l': 1000, 'л': 1000,
            'ml': 1, 'мл': 1,
        }
        
        return val * multipliers.get(weight_unit, 1)
    
    def _title_similarity(self, s1: str, s2: str) -> float:
        """Calculate title similarity based on word overlap"""
        if not s1 or not s2:
            return 0
        
        words1 = set(w for w in s1.split() if len(w) > 2)
        words2 = set(w for w in s2.split() if len(w) > 2)
        
        if not words1 or not words2:
            return 0
        
        matches = len(words1 & words2)
        return matches / max(len(words1), len(words2))
    
    def _fuzzy_ratio(self, s1: str, s2: str) -> float:
        """Calculate fuzzy similarity ratio"""
        return SequenceMatcher(None, s1, s2).ratio()
    
    def _is_brandless_product(self, product: Dict) -> bool:
        """Check if product is typically brandless (vegetables, fruits, etc.)"""
        name = (product.get('name') or '').lower()
        category = (product.get('category') or '').lower()
        
        brandless_keywords = [
            'овощ', 'фрукт', 'мясо', 'яйц', 'egg',
            'vegetable', 'fruit', 'meat', 'картофель', 
            'морковь', 'лук', 'помидор', 'огурец'
        ]
        
        text = f"{name} {category}"
        return any(kw in text for kw in brandless_keywords)
