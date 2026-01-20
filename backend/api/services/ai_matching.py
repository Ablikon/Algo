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
            'match_threshold': 90
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
        product_name = product.title  # Updated to match prompt
        product_brand = product.brand or "Не указан"  # Updated to match prompt
        product_weight = product.weight or product.volume or 'Не указан'  # Updated to match prompt
        product_weight_normalized = productWeight or '-'  # Assuming productWeight is defined elsewhere or set to '-'
        is_brandless = self.is_brandless(product)

        prompt = f"""Ты эксперт по сопоставлению товаров. Найди СОВПАДЕНИЕ для товара среди кандидатов.

✅ ПРАВИЛА МАППИНГА:
1. Если уверенность ≥{self.config['match_threshold']}% → "match", иначе → "no_match"
{ '2. ⚠️ ТОВАР БЕЗ БРЕНДА (овощи/фрукты/мясо/яйца) - бренд НЕ проверяй!' if is_brandless else '2. ✅ Бренд ДОЛЖЕН совпадать (учитывай транслитерацию)' }
3. ✅ Вес/объем: допуск ±100г/мл
4. ✅ Вкус: похожие вкусы = не совпадение

📦 Товар:
Название: {product_name}
{ '⚠️ БЕЗБРЕНДОВЫЙ' if is_brandless else f'Бренд: {product_brand}' }
Вес/Объем: {product_weight} ({product_weight_normalized})

🎯 Кандидаты из CSV:
"""
        for i, c in enumerate(candidates):
            csv_brand = c.csv.brand or c.csv.extractedBrand or 'Не указан'
            csv_category = c.csv.category_full or c.csv.category_1 or '-'
            prompt += f"{i + 1}. UUID: {c.csv.uuid}\n   Название: {c.csv.name}\n   Бренд: {csv_brand}\n   Вес: {c.csv.weight} ({c.csv.normalizedWeight or '-'})\n   Категория: {csv_category}\n\n"

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

    def map_product_to_candidates(self, product, candidates_data):
        if not candidates_data:
            return {
                "best_match": "no_match",
                "match_confidence": 0,
                "matched_uuid": None,
                "matched_csv_title": None,
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
            result = json.loads(content)
            return result  # Return directly as it matches the format
        except Exception as e:
            print(f"Error calling OpenAI: {e}")
            return {
                "best_match": "no_match",
                "match_confidence": 0,
                "matched_uuid": None,
                "matched_csv_title": None,
                "reason": f"Ошибка OpenAI: {str(e)}"
            }
