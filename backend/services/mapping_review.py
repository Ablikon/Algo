"""
Mapping Review Service

Verifies mapped results by cross-checking source items against matched products
in MongoDB. Designed for "mapped" files that already include a matched UUID.

Core idea:
- For each mapped record, find the matched product in DB (by external_id or _id).
- Compare name/brand/weight/category similarity to determine correctness.
- Return a verdict: correct / needs_review / likely_wrong / unmapped / not_found.

This service is intentionally conservative and explainable.
"""

from __future__ import annotations

from dataclasses import dataclass
from difflib import SequenceMatcher
from typing import Any, Dict, Iterable, List, Optional, Tuple

from bson import ObjectId


@dataclass
class ReviewConfig:
    name_ok_threshold: float = 0.75
    name_strict_threshold: float = 0.85
    name_low_threshold: float = 0.45
    weight_tolerance_abs: float = 200.0  # grams/ml
    weight_tolerance_ratio: float = 0.3
    require_brand_if_present: bool = True


class MappingReviewService:
    def __init__(self, db, config: Optional[ReviewConfig] = None) -> None:
        self.db = db
        self.config = config or ReviewConfig()

    async def review_mapped_items(
        self,
        mapped_items: Iterable[Dict[str, Any]],
        source_aggregator: str,
        matched_aggregator: Optional[str] = None,
    ) -> Dict[str, Any]:
        results: List[Dict[str, Any]] = []
        summary = {
            "total": 0,
            "correct": 0,
            "needs_review": 0,
            "likely_wrong": 0,
            "unmapped": 0,
            "not_found": 0,
        }

        for item in mapped_items:
            summary["total"] += 1

            matched_uuid = item.get("matched_uuid") or item.get("matched_id")
            if not matched_uuid:
                summary["unmapped"] += 1
                results.append(self._build_result(item, "unmapped", "Нет matched_uuid"))
                continue

            matched_product = await self._find_matched_product(
                matched_uuid=matched_uuid,
                matched_aggregator=matched_aggregator,
            )

            if not matched_product:
                summary["not_found"] += 1
                results.append(
                    self._build_result(
                        item,
                        "not_found",
                        f"Не найден товар по matched_uuid={matched_uuid}",
                    )
                )
                continue

            verdict, reason, score = self._evaluate_match(item, matched_product)

            summary[verdict] += 1
            results.append(
                self._build_result(
                    item,
                    verdict,
                    reason,
                    matched_product=matched_product,
                    confidence=score,
                )
            )

        return {
            "summary": summary,
            "results": results,
        }

    async def _find_matched_product(
        self,
        matched_uuid: str,
        matched_aggregator: Optional[str] = None,
    ) -> Optional[Dict[str, Any]]:
        # 1) Try as Mongo ObjectId
        if ObjectId.is_valid(matched_uuid):
            doc = await self.db.products.find_one({"_id": ObjectId(matched_uuid)})
            if doc:
                return doc

        # 2) Try to match by matched_uuid in prices
        query = {
            "prices": {
                "$elemMatch": {
                    "matched_uuid": str(matched_uuid),
                }
            }
        }
        if matched_aggregator:
            query["prices"]["$elemMatch"]["aggregator"] = matched_aggregator

        doc = await self.db.products.find_one(query)
        if doc:
            return doc

        # 3) Try to match by external_id in prices
        query = {
            "prices": {
                "$elemMatch": {
                    "external_id": str(matched_uuid),
                }
            }
        }
        if matched_aggregator:
            query["prices"]["$elemMatch"]["aggregator"] = matched_aggregator

        doc = await self.db.products.find_one(query)
        if doc:
            return doc

        # 4) Fallback: try any price.matched_uuid/external_id = matched_uuid
        doc = await self.db.products.find_one(
            {"prices.matched_uuid": str(matched_uuid)}
        )
        if doc:
            return doc
        doc = await self.db.products.find_one(
            {"prices.external_id": str(matched_uuid)}
        )
        return doc

    def _evaluate_match(
        self,
        source_item: Dict[str, Any],
        matched_product: Dict[str, Any],
    ) -> Tuple[str, str, float]:
        src_name = self._normalize_text(
            source_item.get("title")
            or source_item.get("name")
            or source_item.get("product_name")
        )
        dst_name = self._normalize_text(matched_product.get("name"))

        name_score = self._similarity(src_name, dst_name)

        src_brand = self._normalize_text(source_item.get("brand") or source_item.get("brand_name"))
        dst_brand = self._normalize_text(matched_product.get("brand"))

        brand_match = self._brand_match(src_brand, dst_brand)

        src_category = self._normalize_text(
            source_item.get("category_full_path")
            or source_item.get("category")
            or source_item.get("category_1")
        )
        dst_category = self._normalize_text(matched_product.get("category"))

        category_match = self._category_match(src_category, dst_category)

        src_weight = self._extract_weight_value(source_item)
        dst_weight = self._extract_weight_from_product(matched_product)

        weight_ok, weight_reason = self._weight_match(src_weight, dst_weight)

        reasons = [
            f"name_score={name_score:.2f}",
            f"brand_match={brand_match}",
            f"category_match={category_match}",
            weight_reason,
        ]

        # Decision logic
        if name_score >= self.config.name_strict_threshold:
            if src_brand and dst_brand and not brand_match and self.config.require_brand_if_present:
                return "needs_review", "Высокая похожесть, но бренд не совпал", name_score
            if src_weight and dst_weight and not weight_ok:
                return "needs_review", "Высокая похожесть, но вес отличается", name_score
            return "correct", "Высокая похожесть названий", name_score

        if name_score >= self.config.name_ok_threshold:
            if self.config.require_brand_if_present and src_brand and dst_brand and not brand_match:
                return "needs_review", "Похожее название, но бренд не совпал", name_score
            if src_weight and dst_weight and not weight_ok:
                return "needs_review", "Похожее название, но вес отличается", name_score
            return "correct", "Достаточно похожее название", name_score

        if name_score <= self.config.name_low_threshold:
            return "likely_wrong", "Низкая похожесть названий", name_score

        # Middle zone
        if brand_match and (weight_ok or src_weight is None or dst_weight is None):
            return "needs_review", "Средняя похожесть, бренд совпадает", name_score

        return "likely_wrong", "Средняя похожесть без уверенных признаков", name_score

    def _build_result(
        self,
        source_item: Dict[str, Any],
        verdict: str,
        reason: str,
        matched_product: Optional[Dict[str, Any]] = None,
        confidence: Optional[float] = None,
    ) -> Dict[str, Any]:
        return {
            "verdict": verdict,
            "reason": reason,
            "confidence": confidence,
            "source": {
                "title": source_item.get("title") or source_item.get("name"),
                "brand": source_item.get("brand") or source_item.get("brand_name"),
                "category": source_item.get("category_full_path")
                or source_item.get("category_1")
                or source_item.get("category"),
                "matched_uuid": source_item.get("matched_uuid"),
                "product_id": source_item.get("product_id") or source_item.get("id"),
                "url": source_item.get("url"),
            },
            "matched": {
                "id": str(matched_product.get("_id")) if matched_product else None,
                "name": matched_product.get("name") if matched_product else None,
                "brand": matched_product.get("brand") if matched_product else None,
                "category": matched_product.get("category") if matched_product else None,
                "subcategory": matched_product.get("subcategory") if matched_product else None,
            } if matched_product else None,
        }

    def _normalize_text(self, text: Optional[str]) -> str:
        if not text:
            return ""
        return " ".join(str(text).lower().strip().split())

    def _similarity(self, a: str, b: str) -> float:
        if not a or not b:
            return 0.0
        return SequenceMatcher(None, a, b).ratio()

    def _brand_match(self, a: str, b: str) -> bool:
        if not a or not b:
            return False
        return a == b

    def _category_match(self, a: str, b: str) -> bool:
        if not a or not b:
            return False
        # allow partial overlap for long paths
        if a in b or b in a:
            return True
        return a == b

    def _extract_weight_value(self, item: Dict[str, Any]) -> Optional[float]:
        # Support different mapped schemas
        raw = item.get("weight") or item.get("measure")
        if raw:
            return self._parse_weight_value(raw)

        name = item.get("title") or item.get("name")
        if name:
            return self._parse_weight_value(name)

        return None

    def _extract_weight_from_product(self, product: Dict[str, Any]) -> Optional[float]:
        val = product.get("weight_value")
        unit = (product.get("weight_unit") or "").lower()
        if not val:
            return None

        try:
            val = float(val)
        except Exception:
            return None

        if unit in ("kg", "кг"):
            return val * 1000
        if unit in ("l", "л"):
            return val * 1000
        if unit in ("ml", "мл", "g", "г", "гр"):
            return val
        return val

    def _parse_weight_value(self, text: str) -> Optional[float]:
        import re

        match = re.search(r"(\d+[.,]?\d*)\s*(кг|kg|л|l|мл|ml|г|g|гр)\b", str(text).lower())
        if not match:
            return None

        value = float(match.group(1).replace(",", "."))
        unit = match.group(2)

        if unit in ("kg", "кг"):
            return value * 1000
        if unit in ("l", "л"):
            return value * 1000
        return value

    def _weight_match(
        self,
        src_weight: Optional[float],
        dst_weight: Optional[float],
    ) -> Tuple[bool, str]:
        if src_weight is None or dst_weight is None:
            return True, "weight=unknown"

        diff = abs(src_weight - dst_weight)
        ratio = diff / max(src_weight, dst_weight) if max(src_weight, dst_weight) > 0 else 0

        if diff <= self.config.weight_tolerance_abs:
            return True, f"weight_diff=±{int(diff)}"
        if ratio <= self.config.weight_tolerance_ratio:
            return True, f"weight_ratio=±{ratio:.2f}"

        return False, f"weight_diff=±{int(diff)}"
