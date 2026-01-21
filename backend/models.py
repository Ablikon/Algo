"""
Pydantic Models for ScoutAlgo

Defines schemas for MongoDB documents and API responses.
"""

from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from bson import ObjectId


class PyObjectId(str):
    """Custom type for MongoDB ObjectId"""
    @classmethod
    def __get_validators__(cls):
        yield cls.validate

    @classmethod
    def validate(cls, v, handler):
        if isinstance(v, ObjectId):
            return str(v)
        if isinstance(v, str):
            return v
        raise ValueError("Invalid ObjectId")


# ============ Price embedded document ============

class PriceEntry(BaseModel):
    """Price from a single aggregator - embedded in Product"""
    aggregator: str
    price: float
    original_price: Optional[float] = None
    discount_percent: Optional[float] = None
    city: Optional[str] = None
    is_available: bool = True
    external_url: Optional[str] = None
    external_id: Optional[str] = None
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class PriceEntryResponse(BaseModel):
    """Price entry for API response"""
    aggregator: str
    aggregator_color: Optional[str] = None
    aggregator_logo: Optional[str] = None
    price: Optional[float] = None
    original_price: Optional[float] = None
    is_available: bool = True
    external_url: Optional[str] = None
    is_our_company: bool = False


# ============ Product ============

class ProductBase(BaseModel):
    """Base product fields"""
    name: str
    category: Optional[str] = None
    subcategory: Optional[str] = None
    brand: Optional[str] = None
    weight_value: Optional[float] = None
    weight_unit: Optional[str] = None
    image_url: Optional[str] = None
    country: Optional[str] = None


class ProductCreate(ProductBase):
    """Product creation schema"""
    prices: List[PriceEntry] = []


class ProductInDB(ProductBase):
    """Product as stored in MongoDB"""
    id: Optional[str] = Field(default=None, alias="_id")
    prices: List[PriceEntry] = []
    mapping_status: str = "pending"  # pending, matched, no_match
    matched_product_ids: List[str] = []
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True
        json_encoders = {ObjectId: str}


class ProductComparisonResponse(BaseModel):
    """Product with prices for comparison table"""
    id: str
    name: str
    category: Optional[str] = None
    subcategory: Optional[str] = None
    brand: Optional[str] = None
    weight: Optional[str] = None
    image_url: Optional[str] = None
    prices: Dict[str, PriceEntryResponse] = {}
    normalized_prices: Dict[str, Dict[str, Any]] = {}  # {aggregator: {price_per_unit: float, unit: str}}
    min_price: Optional[float] = None
    max_price: Optional[float] = None
    our_price: Optional[float] = None
    country: Optional[str] = None
    price_position: str = "unknown"  # leader, higher, missing


# ============ Category ============

class CategoryBase(BaseModel):
    """Base category fields"""
    name: str
    parent_id: Optional[str] = None
    icon: Optional[str] = None
    sort_order: int = 0


class CategoryInDB(CategoryBase):
    """Category as stored in MongoDB"""
    id: Optional[str] = Field(default=None, alias="_id")
    product_count: int = 0

    class Config:
        populate_by_name = True


class CategoryTreeResponse(BaseModel):
    """Category with children for tree view"""
    id: str
    name: str
    icon: Optional[str] = None
    product_count: int = 0
    children: List["CategoryTreeResponse"] = []


# ============ Aggregator ============

class AggregatorBase(BaseModel):
    """Base aggregator fields"""
    name: str
    color: Optional[str] = "#666666"
    logo_url: Optional[str] = None
    is_our_company: bool = False


class AggregatorInDB(AggregatorBase):
    """Aggregator as stored in MongoDB"""
    id: Optional[str] = Field(default=None, alias="_id")
    product_count: int = 0
    
    class Config:
        populate_by_name = True


class AggregatorResponse(AggregatorBase):
    """Aggregator for API response"""
    id: str
    product_count: int = 0


# ============ Dashboard ============

class DashboardStats(BaseModel):
    """Dashboard statistics response"""
    total_products: int = 0
    products_at_top: int = 0  # We have lowest price
    products_need_action: int = 0  # Our price higher than competitors
    missing_products: int = 0  # Competitors have, we don't
    pending_recommendations: int = 0
    potential_savings: float = 0
    market_coverage: float = 0
    price_competitiveness: float = 0
    aggregator_stats: Dict[str, Dict[str, Any]] = {}


# ============ Recommendations ============

class RecommendationBase(BaseModel):
    """Recommendation base fields"""
    product_id: str
    product_name: str
    action_type: str  # LOWER_PRICE, ADD_PRODUCT, NO_ACTION
    current_price: Optional[float] = None
    recommended_price: Optional[float] = None
    competitor_price: Optional[float] = None
    potential_savings: Optional[float] = None
    priority: str = "MEDIUM"  # HIGH, MEDIUM, LOW
    status: str = "PENDING"  # PENDING, APPLIED, REJECTED
    reason: Optional[str] = None


class RecommendationInDB(RecommendationBase):
    """Recommendation as stored in MongoDB"""
    id: Optional[str] = Field(default=None, alias="_id")
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True


# ============ Import ============

class ImportRequest(BaseModel):
    """Request for JSON import"""
    aggregators: Optional[List[str]] = None  # None = all
    limit_per_aggregator: Optional[int] = None
    dry_run: bool = False


class ImportResult(BaseModel):
    """Result of import operation"""
    status: str = "completed"
    total_read: int = 0
    total_imported: int = 0
    errors: int = 0
    by_aggregator: Dict[str, int] = {}
    by_category: Dict[str, int] = {}
    error_messages: List[str] = []


# ============ Mapping/Matching ============

class MappingResult(BaseModel):
    """Result from AI product matching"""
    matched_uuid: Optional[str] = None
    matched_csv_title: Optional[str] = None
    match_confidence: int = 0
    best_match: str = "no_match"  # match, no_match
    reason: str = ""


class MappingRequest(BaseModel):
    """Request to map products"""
    product_ids: Optional[List[str]] = None  # None = all unmapped
    batch_size: int = 10
    use_ai: bool = True


# ============ Pagination ============

class PaginatedResponse(BaseModel):
    """Generic paginated response"""
    count: int
    page: int
    page_size: int
    total_pages: int
    results: List[Any]
    meta: Optional[Dict[str, Any]] = None
