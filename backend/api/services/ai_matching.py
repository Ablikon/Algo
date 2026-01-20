import os
import json
import re
from openai import OpenAI
from dotenv import load_dotenv
from decimal import Decimal
from ..models import Product, Category, Price, Aggregator, City

# Load environment variables
load_dotenv()

class AIProductMapper:
    def __init__(self, config=None):
        self.config = config or {
            'api_key': os.getenv('OPENAI_API_KEY'),
            'model': os.getenv('OPENAI_MODEL', 'gpt-4o-mini'),
            'match_threshold': 85
        }
        self.client = OpenAI(api_key=self.config['api_key'])

    def normalize_string(self, s):
        if not s: return ""
        s = s.lower()
        # Remove special characters but keep numbers and letters
        s = re.sub(r'[^a-z0-9а-яё\s]', ' ', s)
        return " ".join(s.split())

    def extract_weight(self, title):
        # basic extraction of weight/volume from title
        match = re.search(r'(\d+[.,]?\d*)\s*(г|кг|л|мл|g|kg|l|ml|шт|pcs)', title.lower())
        if match:
            return f"{match.group(1)}{match.group(2)}"
        return ""

    def is_brandless(self, product):
        # Common brandless categories
        brandless_keywords = ['овощи', 'фрукты', 'мясо', 'яйца']
        cat_name = product.category.name.lower() if product.category else ""
        return any(kw in cat_name for kw in brandless_keywords)

    def build_prompt(self, product, candidates):
        product_name = product.name
        product_brand = product.brand or "Не указан"
        product_weight = f"{product.weight_value}{product.weight_unit}" if product.weight_value else "Не указан"
        is_brandless = self.is_brandless(product)

        prompt = f"""Ты эксперт по сопоставлению товаров. Найди СОВПАДЕНИЕ для товара среди кандидатов из маркетплейсов.

✅ ПРАВИЛА МАППИНГА:
1. Если уверенность ≥{self.config['match_threshold']}% → "match", иначе → "no_match"
{ '2. ⚠️ ТОВАР БЕЗ БРЕНДА (овощи/фрукты/мясо/яйца) - бренд НЕ проверяй!' if is_brandless else '2. ✅ Бренд ДОЛЖЕН совпадать (учитывай транслитерацию)' }
3. ✅ Вес/объем: допуск ±50г/мл
4. ✅ Вкус: похожие вкусы = не совпадение
5. ✅ Размер/количество: должны совпадать (72шт ≠ 54шт)

📦 Товар в нашей базе:
Название: {product_name}
{ '⚠️ БЕЗБРЕНДОВЫЙ' if is_brandless else f'Бренд: {product_brand}' }
Вес/Объем: {product_weight}

🎯 Кандидаты (другие агрегаторы):
"""
        for i, c in enumerate(candidates):
            prompt += f"{i + 1}. ID: {c['id']}\n   Название: {c['name']}\n   Бренд: {c.get('brand', 'Не указан')}\n   Вес: {c.get('weight', 'Не указан')}\n   Агрегатор: {c.get('aggregator', '-')}\n\n"

        prompt += """Верни СТРОГО в формате JSON:
{
  "matched_candidate_id": "ID кандидата или null",
  "match_confidence": 0-100,
  "best_match": "match" | "no_match",
  "reason": "Краткое объяснение"
}"""
        return prompt

    def map_product_to_candidates(self, product, candidates_data):
        if not candidates_data:
            return {
                "best_match": "no_match",
                "match_confidence": 0,
                "matched_candidate_id": None,
                "reason": "Нет кандидатов для сопоставления"
            }

        prompt = self.build_prompt(product, candidates_data)
        
        try:
            response = self.client.chat.completions.create(
                model=self.config['model'],
                messages=[{"role": "user", "content": prompt}],
                temperature=0.1,
                max_tokens=500,
                response_format={ "type": "json_object" }
            )
            
            content = response.choices[0].message.content
            return json.loads(content)
        except Exception as e:
            print(f"Error calling OpenAI: {e}")
            return {
                "best_match": "no_match",
                "match_confidence": 0,
                "matched_candidate_id": None,
                "reason": f"Ошибка OpenAI: {str(e)}"
            }
