from rest_framework import serializers
from .models import Aggregator, Category, Product, Price, Recommendation, PriceHistory, ProductLink, UnitConversion, ImportJob


class AggregatorSerializer(serializers.ModelSerializer):
    class Meta:
        model = Aggregator
        fields = '__all__'


class CategorySerializer(serializers.ModelSerializer):
    parent_id = serializers.IntegerField(source='parent.id', read_only=True, allow_null=True)

    class Meta:
        model = Category
        fields = ['id', 'name', 'icon', 'parent_id', 'sort_order']


class CategoryTreeSerializer(serializers.ModelSerializer):
    children = serializers.SerializerMethodField()
    product_count = serializers.SerializerMethodField()

    class Meta:
        model = Category
        fields = ['id', 'name', 'icon', 'sort_order', 'children', 'product_count']

    def get_children(self, obj):
        children = obj.children.all().order_by('sort_order', 'name')
        return CategoryTreeSerializer(children, many=True).data

    def get_product_count(self, obj):
        count = Product.objects.filter(category=obj).count()
        for child in obj.children.all():
            count += Product.objects.filter(category=child).count()
        return count


class ProductLinkSerializer(serializers.ModelSerializer):
    aggregator_name = serializers.CharField(source='aggregator.name', read_only=True)

    class Meta:
        model = ProductLink
        fields = ['id', 'product_id', 'aggregator_id', 'aggregator_name', 'url', 'external_name', 'is_verified']


class ImportJobSerializer(serializers.ModelSerializer):
    class Meta:
        model = ImportJob
        fields = '__all__'


class PriceSerializer(serializers.ModelSerializer):
    aggregator_name = serializers.CharField(source='aggregator.name', read_only=True)
    aggregator_color = serializers.CharField(source='aggregator.color', read_only=True)

    class Meta:
        model = Price
        fields = ['id', 'price', 'is_available', 'aggregator_name', 'aggregator_color', 'aggregator_id']


class ProductSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source='category.name', read_only=True)

    class Meta:
        model = Product
        fields = ['id', 'name', 'category_id', 'category_name', 'image_url']


class ProductComparisonSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source='category.name', read_only=True)
    category_id = serializers.IntegerField(source='category.id', read_only=True)
    prices = serializers.SerializerMethodField()
    our_position = serializers.SerializerMethodField()
    min_competitor_price = serializers.SerializerMethodField()
    status = serializers.SerializerMethodField()
    recommended_price = serializers.SerializerMethodField()
    weight_info = serializers.SerializerMethodField()
    normalized_prices = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = [
            'id', 'name', 'category_id', 'category_name', 'brand', 'country_of_origin',
            'weight_info', 'prices', 'normalized_prices', 'our_position',
            'min_competitor_price', 'status', 'recommended_price'
        ]

    def get_weight_info(self, obj):
        if obj.weight_value and obj.weight_unit:
            return {
                'value': float(obj.weight_value),
                'unit': obj.weight_unit,
                'display': f"{obj.weight_value} {obj.weight_unit}"
            }
        return None

    def get_prices(self, obj):
        prices = Price.objects.filter(product=obj).select_related('aggregator')
        links = {link.aggregator_id: link for link in ProductLink.objects.filter(product=obj)}
        result = {}
        for price in prices:
            link = links.get(price.aggregator_id)
            result[price.aggregator.name.lower()] = {
                'price': float(price.price) if price.price else None,
                'is_available': price.is_available,
                'color': price.aggregator.color,
                'url': link.url if link else None,
                'external_name': link.external_name if link else None,
                'is_verified': link.is_verified if link else False
            }
        return result

    def get_normalized_prices(self, obj):
        """Цена за стандартную единицу (кг или литр)"""
        if not obj.weight_value or not obj.weight_unit:
            return None

        prices = Price.objects.filter(product=obj).select_related('aggregator')
        result = {}

        # Определяем стандартную единицу и множитель
        if obj.weight_unit in ['kg', 'g']:
            standard_unit = 'kg'
            if obj.weight_unit == 'kg':
                multiplier = 1 / float(obj.weight_value)
            else:  # g
                multiplier = 1000 / float(obj.weight_value)
        elif obj.weight_unit in ['l', 'ml']:
            standard_unit = 'l'
            if obj.weight_unit == 'l':
                multiplier = 1 / float(obj.weight_value)
            else:  # ml
                multiplier = 1000 / float(obj.weight_value)
        else:
            return None

        for price in prices:
            if price.price and price.is_available:
                normalized = float(price.price) * multiplier
                result[price.aggregator.name.lower()] = {
                    'price_per_unit': round(normalized, 2),
                    'unit': standard_unit
                }

        return result if result else None

    def get_our_position(self, obj):
        """
        TOP 1 только если наша цена СТРОГО меньше всех конкурентов.
        Равная цена = нужно снизить на 1₸
        """
        prices = Price.objects.filter(product=obj).select_related('aggregator')
        our_price = None
        competitor_prices = []

        for price in prices:
            if price.price and price.is_available:
                if price.aggregator.is_our_company:
                    our_price = float(price.price)
                else:
                    competitor_prices.append(float(price.price))

        if our_price is None:
            return None  # Нет нашего товара

        if not competitor_prices:
            return 1  # Нет конкурентов - мы единственные

        min_competitor = min(competitor_prices)

        # TOP 1 только если СТРОГО меньше
        if our_price < min_competitor:
            return 1
        elif our_price == min_competitor:
            return 2  # Равная цена - не лидер
        else:
            # Считаем позицию
            all_prices = sorted(set(competitor_prices + [our_price]))
            return all_prices.index(our_price) + 1

    def get_min_competitor_price(self, obj):
        prices = Price.objects.filter(
            product=obj,
            aggregator__is_our_company=False,
            is_available=True
        ).exclude(price__isnull=True)

        if prices.exists():
            return float(min(p.price for p in prices))
        return None

    def get_status(self, obj):
        """
        Возвращает статус товара:
        - 'top' - мы лидер (цена строго ниже)
        - 'equal' - цена равна, нужно снизить на 1₸
        - 'higher' - наша цена выше, нужно снизить
        - 'missing' - у нас нет этого товара
        """
        prices = Price.objects.filter(product=obj).select_related('aggregator')
        our_price = None
        competitor_prices = []

        for price in prices:
            if price.price and price.is_available:
                if price.aggregator.is_our_company:
                    our_price = float(price.price)
                else:
                    competitor_prices.append(float(price.price))

        if our_price is None:
            return 'missing'

        if not competitor_prices:
            return 'top'

        min_competitor = min(competitor_prices)

        if our_price < min_competitor:
            return 'top'
        elif our_price == min_competitor:
            return 'equal'
        else:
            return 'higher'

    def get_recommended_price(self, obj):
        """Рекомендуемая цена = минимальная цена конкурента - 1"""
        min_price = self.get_min_competitor_price(obj)
        if min_price:
            return min_price - 1
        return None


class RecommendationSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source='product.name', read_only=True)
    category_name = serializers.CharField(source='product.category.name', read_only=True)

    class Meta:
        model = Recommendation
        fields = '__all__'


class PriceHistorySerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source='product.name', read_only=True)
    aggregator_name = serializers.CharField(source='aggregator.name', read_only=True)

    class Meta:
        model = PriceHistory
        fields = '__all__'


class DashboardSerializer(serializers.Serializer):
    total_products = serializers.IntegerField()
    products_at_top = serializers.IntegerField()
    products_need_action = serializers.IntegerField()
    missing_products = serializers.IntegerField()
    pending_recommendations = serializers.IntegerField()
    potential_savings = serializers.DecimalField(max_digits=10, decimal_places=2)
    market_coverage = serializers.FloatField()
    price_competitiveness = serializers.FloatField()
