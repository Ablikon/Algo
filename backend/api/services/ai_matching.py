"""
AI Product Matching Service using OpenAI ChatGPT

Matches products from aggregator data with reference products using AI.
Uses specified prompt format for product comparison.
"""

import os
import json
import re
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
            'match_threshold': 90
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
        """Build prompt for AI matching according to specified format"""
        
        product_title = product.get('title') or product.get('name', '')
        product_brand = product.get('brand') or 'Не указан'
        product_weight_raw = product.get('weight') or product.get('volume') or product.get('measure') or 'Не указан'
        product_weight_normalized = self.extract_weight(product_title + ' ' + str(product_weight_raw))
        
        category_name = product.get('category', '')
        is_brandless = self.is_brandless_category(category_name)
        
        # Build prompt
        prompt = f"""Ты эксперт по сопоставлению товаров. Найди СОВПАДЕНИЕ для товара среди кандидатов.

✅ ПРАВИЛА МАППИНГА:
1. Если уверенность ≥{self.config['match_threshold']}% → "match", иначе → "no_match"
{'2. ⚠️ ТОВАР БЕЗ БРЕНДА (овощи/фрукты/мясо/яйца) - бренд НЕ проверяй!' if is_brandless else '2. ✅ Бренд ДОЛЖЕН совпадать (учитывай транслитерацию)'}
3. ✅ Вес/объем: допуск ±100г/мл
4. ✅ Вкус: похожие вкусы = не совпадение

📦 Товар:
Название: {product_title}
{'⚠️ БЕЗБРЕНДОВЫЙ' if is_brandless else f'Бренд: {product_brand}'}
Вес/Объем: {product_weight_raw} ({product_weight_normalized or '-'})

🎯 Кандидаты из CSV:
"""
        
        for i, candidate in enumerate(candidates):
            c_brand = candidate.get('brand') or 'Не указан'
            c_category = candidate.get('category_full') or candidate.get('category') or '-'
            c_weight_raw = candidate.get('weight') or candidate.get('measure') or 'Не указан'
            c_weight_normalized = self.extract_weight(str(candidate.get('title', '')) + ' ' + str(c_weight_raw))
            c_uuid = candidate.get('uuid') or candidate.get('id') or candidate.get('product_id') or str(i+1)
            c_name = candidate.get('title') or candidate.get('name') or 'Без названия'
            
            prompt += f"{i + 1}. UUID: {c_uuid}\n   Название: {c_name}\n   Бренд: {c_brand}\n   Вес: {c_weight_raw} ({c_weight_normalized or '-'})\n   Категория: {c_category}\n\n"
        
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
            
            # Ensure all required fields are present
            return {
                "matched_uuid": result.get("matched_uuid"),
                "matched_csv_title": result.get("matched_csv_title"),
                "match_confidence": result.get("match_confidence", 0),
                "best_match": result.get("best_match", "no_match"),
                "reason": result.get("reason", "Нет объяснения")
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
    
    def find_candidates(self, product, all_products, max_candidates=5):
        """Find candidate matches using simple text similarity"""
        
        product_name = self.normalize_string(product.get('title') or product.get('name', ''))
        if not product_name:
            return []
        
        # Extract key words from product name
        keywords = set(product_name.split())
        if len(keywords) < 2:
            keywords = set(product_name[:10])
        
        # Score all products
        scored = []
        for candidate in all_products:
            c_name = self.normalize_string(candidate.get('title') or candidate.get('name', ''))
            if not c_name or c_name == product_name:
                continue
            
            c_keywords = set(c_name.split())
            
            # Calculate overlap score
            overlap = len(keywords & c_keywords)
            if overlap > 0:
                score = overlap / max(len(keywords), len(c_keywords))
                scored.append((score, candidate))
        
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
