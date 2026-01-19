from rest_framework import viewsets, status
from rest_framework.decorators import api_view, action
from rest_framework.response import Response
from django.db.models import Count, Sum, Q
from decimal import Decimal

from .models import Aggregator, Category, Product, Price, Recommendation, PriceHistory
from .serializers import (
    AggregatorSerializer,
    CategorySerializer,
    ProductSerializer,
    ProductComparisonSerializer,
    RecommendationSerializer,
    PriceHistorySerializer,
    DashboardSerializer,
)


class AggregatorViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Aggregator.objects.all()
    serializer_class = AggregatorSerializer


class CategoryViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Category.objects.all()
    serializer_class = CategorySerializer


class ProductViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Product.objects.all().select_related('category')
    serializer_class = ProductSerializer

    @action(detail=False, methods=['get'])
    def comparison(self, request):
        products = Product.objects.all().select_related('category')
        serializer = ProductComparisonSerializer(products, many=True)
        return Response(serializer.data)


class RecommendationViewSet(viewsets.ModelViewSet):
    queryset = Recommendation.objects.all().select_related('product', 'product__category')
    serializer_class = RecommendationSerializer

    @action(detail=True, methods=['post'])
    def apply(self, request, pk=None):
        recommendation = self.get_object()

        if recommendation.status == 'APPLIED':
            return Response(
                {'error': 'Recommendation already applied'},
                status=status.HTTP_400_BAD_REQUEST
            )

        our_aggregator = Aggregator.objects.filter(is_our_company=True).first()

        if recommendation.action_type == 'LOWER_PRICE':
            price_obj = Price.objects.filter(
                product=recommendation.product,
                aggregator=our_aggregator
            ).first()

            if price_obj:
                old_price = price_obj.price
                price_obj.price = recommendation.recommended_price
                price_obj.save()

                PriceHistory.objects.create(
                    product=recommendation.product,
                    aggregator=our_aggregator,
                    old_price=old_price,
                    new_price=recommendation.recommended_price
                )

        elif recommendation.action_type == 'ADD_PRODUCT':
            Price.objects.update_or_create(
                product=recommendation.product,
                aggregator=our_aggregator,
                defaults={
                    'price': recommendation.recommended_price,
                    'is_available': True
                }
            )

        recommendation.status = 'APPLIED'
        recommendation.save()

        return Response({'status': 'success', 'message': 'Recommendation applied'})

    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        recommendation = self.get_object()
        recommendation.status = 'REJECTED'
        recommendation.save()
        return Response({'status': 'success', 'message': 'Recommendation rejected'})


@api_view(['GET'])
def dashboard_stats(request):
    our_aggregator = Aggregator.objects.filter(is_our_company=True).first()
    total_products = Product.objects.count()

    products_at_top = 0
    products_need_action = 0
    missing_products = 0

    for product in Product.objects.all():
        prices = Price.objects.filter(product=product).select_related('aggregator')
        our_price = None
        competitor_prices = []
        has_our_product = False

        for price in prices:
            if price.aggregator.is_our_company:
                if price.is_available and price.price:
                    our_price = float(price.price)
                    has_our_product = True
            else:
                if price.is_available and price.price:
                    competitor_prices.append(float(price.price))

        if not has_our_product:
            missing_products += 1
        elif our_price and competitor_prices:
            min_competitor = min(competitor_prices)
            # TOP 1 только если СТРОГО меньше
            if our_price < min_competitor:
                products_at_top += 1
            else:
                # Равная цена или выше = нужно действие
                products_need_action += 1

    pending_recommendations = Recommendation.objects.filter(status='PENDING').count()
    potential_savings = Recommendation.objects.filter(
        status='PENDING',
        potential_savings__isnull=False
    ).aggregate(total=Sum('potential_savings'))['total'] or Decimal('0')

    market_coverage = ((total_products - missing_products) / total_products * 100) if total_products > 0 else 0
    price_competitiveness = (products_at_top / (total_products - missing_products) * 100) if (total_products - missing_products) > 0 else 0

    data = {
        'total_products': total_products,
        'products_at_top': products_at_top,
        'products_need_action': products_need_action,
        'missing_products': missing_products,
        'pending_recommendations': pending_recommendations,
        'potential_savings': potential_savings,
        'market_coverage': round(market_coverage, 1),
        'price_competitiveness': round(price_competitiveness, 1)
    }

    return Response(data)


@api_view(['GET'])
def analytics_gaps(request):
    """Get products that we don't have but competitors do"""
    our_aggregator = Aggregator.objects.filter(is_our_company=True).first()

    gaps = []
    for product in Product.objects.all().select_related('category'):
        our_price = Price.objects.filter(
            product=product,
            aggregator=our_aggregator
        ).first()

        if not our_price or not our_price.is_available or not our_price.price:
            competitor_prices = Price.objects.filter(
                product=product,
                is_available=True
            ).exclude(aggregator=our_aggregator).exclude(price__isnull=True)

            if competitor_prices.exists():
                min_price = min(float(p.price) for p in competitor_prices)
                gaps.append({
                    'product_id': product.id,
                    'product_name': product.name,
                    'category': product.category.name if product.category else None,
                    'min_competitor_price': min_price,
                    'suggested_price': round(min_price - 1, 2)
                })

    return Response(gaps)


@api_view(['POST'])
def run_algorithm(request):
    """Run the pricing optimization algorithm"""
    our_aggregator = Aggregator.objects.filter(is_our_company=True).first()

    new_recommendations = []

    for product in Product.objects.all():
        prices = Price.objects.filter(product=product).select_related('aggregator')
        our_price_obj = None
        competitor_prices = []

        for price in prices:
            if price.aggregator.is_our_company:
                our_price_obj = price
            else:
                if price.is_available and price.price:
                    competitor_prices.append({
                        'price': float(price.price),
                        'aggregator': price.aggregator.name
                    })

        if not competitor_prices:
            continue

        min_competitor = min(competitor_prices, key=lambda x: x['price'])

        existing = Recommendation.objects.filter(
            product=product,
            status='PENDING'
        ).exists()

        if existing:
            continue

        if not our_price_obj or not our_price_obj.is_available or not our_price_obj.price:
            rec = Recommendation.objects.create(
                product=product,
                action_type='ADD_PRODUCT',
                current_price=None,
                recommended_price=Decimal(str(min_competitor['price'] - 1)),
                competitor_price=Decimal(str(min_competitor['price'])),
                potential_savings=None,
                priority='HIGH',
                status='PENDING'
            )
            new_recommendations.append(RecommendationSerializer(rec).data)

        elif float(our_price_obj.price) > min_competitor['price']:
            savings = float(our_price_obj.price) - (min_competitor['price'] - 1)

            if savings > 50:
                priority = 'HIGH'
            elif savings > 10:
                priority = 'MEDIUM'
            else:
                priority = 'LOW'

            rec = Recommendation.objects.create(
                product=product,
                action_type='LOWER_PRICE',
                current_price=our_price_obj.price,
                recommended_price=Decimal(str(min_competitor['price'] - 1)),
                competitor_price=Decimal(str(min_competitor['price'])),
                potential_savings=Decimal(str(savings)),
                priority=priority,
                status='PENDING'
            )
            new_recommendations.append(RecommendationSerializer(rec).data)

        elif float(our_price_obj.price) == min_competitor['price']:
            rec = Recommendation.objects.create(
                product=product,
                action_type='LOWER_PRICE',
                current_price=our_price_obj.price,
                recommended_price=Decimal(str(min_competitor['price'] - 1)),
                competitor_price=Decimal(str(min_competitor['price'])),
                potential_savings=Decimal('1'),
                priority='LOW',
                status='PENDING'
            )
            new_recommendations.append(RecommendationSerializer(rec).data)

    return Response({
        'status': 'success',
        'new_recommendations': len(new_recommendations),
        'recommendations': new_recommendations
    })


@api_view(['GET'])
def price_history(request):
    history = PriceHistory.objects.all().select_related('product', 'aggregator').order_by('-changed_at')[:50]
    serializer = PriceHistorySerializer(history, many=True)
    return Response(serializer.data)
