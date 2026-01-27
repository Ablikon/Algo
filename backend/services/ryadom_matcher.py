"""
Deterministic Ryadom matcher helper.

Purpose:
- Provide fast, explainable matching between mapped competitor items and Ryadom items
  without AI.
- Intended to be used during import or for building monitoring datasets.

Strategy (deterministic, fast):
1) Normalize names (lowercase, strip, remove punctuation).
2) Extract/normalize brand if present.
3) Extract/normalize weight/measure (g/ml/kg/l).
4) Score candidates by name similarity + brand/weight agreement.
5) Select best candidate if score passes threshold.

Note: This module does NOT access DB directly. It expects dictionaries and lists.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from difflib import SequenceMatcher
from typing import Any, Dict, Iterable, List, Optional, Tuple


@dataclass
class MatchConfig:
    min_name_score: float = 0.78
    strong_name_score: float = 0.88
    brand_bonus: float = 0.08
    weight_bonus: float = 0.06
    require_brand_if_present: bool = False
    weight_tolerance_abs: float = 200.0  # grams/ml
    weight_tolerance_ratio: float = 0.3


class RyadomMatcher:
    def __init__(self, config: Optional[MatchConfig] = None) -> None:
        self.config = config or MatchConfig()

    def match(
        self,
        mapped_item: Dict[str, Any],
        ryadom_items: Iterable[Dict[str, Any]],
    ) -> Dict[str, Any]:
        """
        Returns:
        {
          "best_match": "match" | "no_match",
          "confidence": float,
          "reason": str,
          "matched_item": <ryadom_item or None>
        }
        """
        src_name = self._normalize_text(
            mapped_item.get("title")
            or mapped_item.get("name")
            or mapped_item.get("product_name")
        )
        if not src_name:
            return {
                "best_match": "no_match",
                "confidence": 0.0,
                "reason": "source_name_missing",
                "matched_item": None,
            }

        src_brand = self._normalize_text(
            mapped_item.get("brand") or mapped_item.get("brand_name")
        )
        src_weight = self._extract_weight(mapped_item)

        best = None
        best_score = 0.0
        best_reason = "no_candidates"

        for candidate in ryadom_items:
            cand_name = self._normalize_text(
                candidate.get("name")
                or candidate.get("name_origin")
                or candidate.get("name_short")
            )
            if not cand_name:
                continue

            name_score = self._similarity(src_name, cand_name)
            if name_score < self.config.min_name_score:
                continue

            cand_brand = self._normalize_text(
                candidate.get("brand_name") or candidate.get("brand")
            )
            cand_weight = self._extract_weight(candidate)

            score = name_score
            reasons = [f"name={name_score:.2f}"]

            brand_match = self._brand_match(src_brand, cand_brand)
            if brand_match:
                score += self.config.brand_bonus
                reasons.append("brand=ok")
            elif src_brand and cand_brand and self.config.require_brand_if_present:
                reasons.append("brand=mismatch")

            weight_match, weight_reason = self._weight_match(src_weight, cand_weight)
            if weight_match and (src_weight is not None and cand_weight is not None):
                score += self.config.weight_bonus
            reasons.append(weight_reason)

            if score > best_score:
                best_score = score
                best = candidate
                best_reason = "; ".join(reasons)

        if best and best_score >= self.config.min_name_score:
            return {
                "best_match": "match",
                "confidence": round(min(best_score, 1.0), 4),
                "reason": best_reason,
                "matched_item": best,
            }

        return {
            "best_match": "no_match",
            "confidence": round(best_score, 4),
            "reason": best_reason,
            "matched_item": None,
        }

    def _normalize_text(self, text: Optional[str]) -> str:
        if not text:
            return ""
        text = str(text).lower().strip()
        text = re.sub(r"[^\w\s]+", " ", text, flags=re.UNICODE)
        text = re.sub(r"\s+", " ", text)
        return text

    def _similarity(self, a: str, b: str) -> float:
        if not a or not b:
            return 0.0
        return SequenceMatcher(None, a, b).ratio()

    def _brand_match(self, a: str, b: str) -> bool:
        if not a or not b:
            return False
        return a == b

    def _extract_weight(self, item: Dict[str, Any]) -> Optional[float]:
        raw = item.get("weight") or item.get("measure")
        if raw:
            return self._parse_weight_value(raw)

        name = item.get("title") or item.get("name")
        if name:
            return self._parse_weight_value(name)

        return None

    def _parse_weight_value(self, text: Any) -> Optional[float]:
        match = re.search(
            r"(\d+[.,]?\d*)\s*(кг|kg|л|l|мл|ml|г|g|гр)\b",
            str(text).lower(),
        )
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
