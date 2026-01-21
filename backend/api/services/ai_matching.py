"""
AI Product Matching Service using OpenAI ChatGPT

Matches products from aggregator data with reference products using AI.
Uses specified prompt format for product comparison.
"""

import os
import json
import re
from difflib import SequenceMatcher
from openai import OpenAI
from dotenv import load_dotenv

# Load environment variables
load_dotenv()


class AIProductMatcher:
    """AI-powered product matching using ChatGPT"""
    
    def __init__(self, config=None):
        self.config = config or {
            'api_key': os.getenv('OPENAI_API_KEY'),
            'model': os.getenv('OPENAI_MODEL', 'gpt-4o-mini'),
            'match_threshold': 75,  # Lowered from 90 for better coverage
            'max_candidates': 15,   # Increased from 5
        }

        if self.config['api_key']:
            self.client = OpenAI(api_key=self.config['api_key'])
        else:
            self.client = None
            print("Warning: OPENAI_API_KEY not set. AI matching disabled.")
    
    def normalize_string(self, s):
        """Normalize text for matching"""
        if not s:
            return ""
        s = str(s).lower().strip()
        # Remove special characters but keep letters and numbers
        s = re.sub(r'[^a-z0-9а-яё\s]', ' ', s)
        return " ".join(s.split())
    
    def extract_weight(self, text):
        """Extract weight/volume from text"""
        if not text:
            return None
        
        text = str(text).lower()
        match = re.search(r'(\d+[.,]?\d*)\s*(г|кг|л|мл|g|kg|l|ml|шт|pcs)', text)
        if match:
            value = float(match.group(1).replace(',', '.'))
            unit = match.group(2)
            
            # Normalize to grams or ml
            unit_multipliers = {
                'кг': 1000, 'kg': 1000,  # Convert to grams
                'г': 1, 'g': 1,
                'л': 1000, 'l': 1000,  # Convert to ml
                'мл': 1, 'ml': 1,
            }
            
            if unit in unit_multipliers:
                return value * unit_multipliers[unit]
            return value
        return None
    
    def is_brandless_category(self, category_name):
        """Check if category is typically brandless (vegetables, fruits, meat, eggs)"""
        if not category_name:
            return False
        
        brandless_keywords = ['овощи', 'фрукты', 'мясо', 'яйца', 'яйц', 'egg', 'vegetable', 'fruit', 'meat']
        category_lower = category_name.lower()
        return any(kw in category_lower for kw in brandless_keywords)
    
    def build_matching_prompt(self, product, candidates):
        """Build prompt for AI matching - optimized for maximum coverage"""

        product_title = product.get('title') or product.get('name', '')
        product_brand = product.get('brand') or ''
        product_weight_raw = product.get('weight') or product.get('volume') or product.get('measure') or ''
        product_weight_normalized = self.extract_weight(product_title + ' ' + str(product_weight_raw))

        category_name = product.get('category', '')
        is_brandless = self.is_brandless_category(category_name)

        threshold = self.config['match_threshold']

        # Build prompt - более агрессивный для лучшего покрытия
        prompt = f"""Ты эксперт по сопоставлению FMCG товаров в Казахстане. Твоя задача - найти ОДИН и тот же товар среди кандидатов.

⚠️ ВАЖНО: Названия могут отличаться из-за:
- Разных языков (русский/казахский/английский)
- Транслитерации брендов (Coca-Cola = Кока-Кола, Sprite = Спрайт)
- Сокращений (л = литр, мл = миллилитр, г = грамм)
- Разного порядка слов

✅ ПРАВИЛА MATCH (совпадение):
1. Это ОДИН И ТОТ ЖЕ товар, если совпадают: бренд + объём/вес (±100г/мл) + тип продукта
2. {'Для овощей/фруктов/мяса/яиц бренд НЕ важен - сравнивай только тип и вес' if is_brandless else 'Бренд должен совпадать (учитывай транслитерацию: Fanta=Фанта, Sprite=Спрайт и т.д.)'}
3. Уверенность ≥{threshold}% = "match"

❌ НЕ СОВПАДЕНИЕ:
- Разные вкусы одного бренда (Fanta Orange ≠ Fanta Grape)
- Мультипаки vs одиночные (2x500мл ≠ 500мл)
- Комбо-наборы vs отдельные товары

📦 ИСКОМЫЙ ТОВАР:
Название: {product_title}
{f'Бренд: {product_brand}' if product_brand else ''}
Вес/Объём: {product_weight_raw or 'не указан'} {f'(~{product_weight_normalized}г/мл)' if product_weight_normalized else ''}

🎯 КАНДИДАТЫ:
"""

        for i, candidate in enumerate(candidates):
            c_brand = candidate.get('brand') or ''
            c_weight_raw = candidate.get('weight') or candidate.get('measure') or ''
            c_weight_normalized = self.extract_weight(str(candidate.get('title', '')) + ' ' + str(c_weight_raw))
            c_uuid = candidate.get('uuid') or candidate.get('id') or candidate.get('product_id') or str(i+1)
            c_name = candidate.get('title') or candidate.get('name') or 'Без названия'

            prompt += f"{i + 1}. [UUID: {c_uuid}] {c_name}"
            if c_brand:
                prompt += f" | Бренд: {c_brand}"
            if c_weight_raw:
                prompt += f" | Вес: {c_weight_raw}"
            if c_weight_normalized:
                prompt += f" (~{c_weight_normalized})"
            prompt += "\n"

        prompt += f"""
📋 ОТВЕТЬ JSON:
{{"matched_uuid": "UUID или null", "matched_csv_title": "Название или null", "match_confidence": 0-100, "best_match": "match" или "no_match", "reason": "кратко"}}

Если есть хотя бы один подходящий кандидат с уверенностью ≥{threshold}% - выбери ЛУЧШИЙ."""
        return prompt

    
    def match_product(self, product, candidates):
        """Match a product against candidate products using AI"""

        if not self.client:
            return {
                "best_match": "no_match",
                "match_confidence": 0,
                "matched_uuid": None,
                "matched_csv_title": None,
                "reason": "OpenAI API не настроен"
            }

        if not candidates:
            return {
                "best_match": "no_match",
                "match_confidence": 0,
                "matched_uuid": None,
                "matched_csv_title": None,
                "reason": "Нет кандидатов для сопоставления"
            }

        prompt = self.build_matching_prompt(product, candidates)

        try:
            response = self.client.chat.completions.create(
                model=self.config['model'],
                messages=[{"role": "user", "content": prompt}],
                temperature=0.1,
                max_tokens=500,
                response_format={"type": "json_object"}
            )

            content = response.choices[0].message.content
            result = json.loads(content)

            confidence = result.get("match_confidence", 0)
            threshold = self.config['match_threshold']

            # Determine match based on threshold
            best_match = "match" if confidence >= threshold else "no_match"

            return {
                "matched_uuid": result.get("matched_uuid") if best_match == "match" else None,
                "matched_csv_title": result.get("matched_csv_title") if best_match == "match" else None,
                "match_confidence": confidence,
                "best_match": best_match,
                "reason": result.get("reason", "")
            }

        except Exception as e:
            print(f"Error calling OpenAI: {e}")
            return {
                "best_match": "no_match",
                "match_confidence": 0,
                "matched_uuid": None,
                "matched_csv_title": None,
                "reason": f"Ошибка OpenAI: {str(e)}"
            }
    
    def fuzzy_ratio(self, s1, s2):
        """Calculate fuzzy similarity ratio between two strings"""
        return SequenceMatcher(None, s1.lower(), s2.lower()).ratio()

    def extract_brand_from_name(self, name):
        """Try to extract brand from product name (first word often is brand)"""
        if not name:
            return None
        words = name.split()
        if words:
            # Common brand patterns - first capitalized word or known brands
            first_word = words[0]
            if len(first_word) > 2:
                return first_word.lower()
        return None

    def find_candidates(self, product, all_products, max_candidates=None):
        """Find candidate matches using multiple strategies for better coverage"""

        if max_candidates is None:
            max_candidates = self.config.get('max_candidates', 15)

        product_name = self.normalize_string(product.get('title') or product.get('name', ''))
        if not product_name:
            return []

        product_brand = self.normalize_string(product.get('brand', ''))
        product_weight = self.extract_weight(product_name + ' ' + str(product.get('weight', '')))

        # Extract key words from product name
        keywords = set(product_name.split())

        scored = []
        seen_names = set()

        for candidate in all_products:
            c_name = self.normalize_string(candidate.get('title') or candidate.get('name', ''))
            if not c_name or c_name == product_name or c_name in seen_names:
                continue
            seen_names.add(c_name)

            c_brand = self.normalize_string(candidate.get('brand', ''))
            c_keywords = set(c_name.split())

            # Strategy 1: Keyword overlap (original)
            overlap = len(keywords & c_keywords)
            overlap_score = overlap / max(len(keywords), len(c_keywords), 1) if overlap > 0 else 0

            # Strategy 2: Fuzzy string matching
            fuzzy_score = self.fuzzy_ratio(product_name, c_name)

            # Strategy 3: Brand matching boost
            brand_boost = 0
            if product_brand and c_brand:
                if product_brand == c_brand:
                    brand_boost = 0.3
                elif self.fuzzy_ratio(product_brand, c_brand) > 0.8:
                    brand_boost = 0.2
            # Try to match brand from name if not explicitly set
            elif not product_brand or not c_brand:
                inferred_brand_p = self.extract_brand_from_name(product_name)
                inferred_brand_c = self.extract_brand_from_name(c_name)
                if inferred_brand_p and inferred_brand_c:
                    if inferred_brand_p == inferred_brand_c:
                        brand_boost = 0.2

            # Strategy 4: Weight similarity boost
            weight_boost = 0
            if product_weight:
                c_weight = self.extract_weight(c_name + ' ' + str(candidate.get('weight', '')))
                if c_weight and product_weight:
                    weight_diff = abs(product_weight - c_weight)
                    if weight_diff <= 50:  # Within 50g/ml
                        weight_boost = 0.15
                    elif weight_diff <= 100:  # Within 100g/ml
                        weight_boost = 0.1

            # Combined score (weighted average)
            combined_score = (
                overlap_score * 0.3 +
                fuzzy_score * 0.4 +
                brand_boost +
                weight_boost
            )

            # Minimum threshold to be considered a candidate
            if combined_score > 0.15:
                scored.append((combined_score, candidate))

        # Sort by score and return top candidates
        scored.sort(key=lambda x: x[0], reverse=True)
        return [c[1] for c in scored[:max_candidates]]
    
    def batch_match(self, products, reference_products, max_candidates=5):
        """Match multiple products against reference data"""
        
        results = []
        
        for product in products:
            # Find candidates using simple matching
            candidates = self.find_candidates(product, reference_products, max_candidates)
            
            if candidates:
                # Use AI to match
                match_result = self.match_product(product, candidates)
                results.append({
                    'product': product,
                    'match': match_result
                })
            else:
                results.append({
                    'product': product,
                    'match': {
                        "best_match": "no_match",
                        "match_confidence": 0,
                        "matched_uuid": None,
                        "matched_csv_title": None,
                        "reason": "Не найдено похожих кандидатов"
                    }
                })
        
        return results
