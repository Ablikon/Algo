from rest_framework import serializers
from .models import Aggregator, Category, Product, Price, Recommendation, PriceHistory


class AggregatorSerializer(serializers.ModelSerializer):
    class Meta:
        model = Aggregator
        fields = '__all__'


class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
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
    prices = serializers.SerializerMethodField()
    our_position = serializers.SerializerMethodField()
    min_competitor_price = serializers.SerializerMethodField()
    status = serializers.SerializerMethodField()
    recommended_price = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = ['id', 'name', 'category_name', 'prices', 'our_position', 'min_competitor_price', 'status', 'recommended_price']

    def get_prices(self, obj):
        prices = Price.objects.filter(product=obj).select_related('aggregator')
        result = {}
        for price in prices:
            result[price.aggregator.name.lower()] = {
                'price': float(price.price) if price.price else None,
                'is_available': price.is_available,
                'color': price.aggregator.color
            }
        return result

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
