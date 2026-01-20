from rest_framework import viewsets, status
from rest_framework.decorators import api_view, action, parser_classes
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.response import Response
from django.db.models import Count, Sum, Q, Prefetch
from django.http import HttpResponse
from django.utils import timezone
from decimal import Decimal
import csv
import io
import pandas as pd

from .models import Aggregator, Category, Product, Price, Recommendation, PriceHistory, ProductLink, ImportJob, City
from .serializers import (
    AggregatorSerializer,
    CitySerializer,
    CategorySerializer,
    CategoryTreeSerializer,
    ProductSerializer,
    ProductComparisonSerializer,
    ProductLinkSerializer,
    RecommendationSerializer,
    PriceHistorySerializer,
    ImportJobSerializer,
    DashboardSerializer,
)
from .services.importer import DataImporter
from .services.matching import ProductMatcher


class AggregatorViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Aggregator.objects.all()
    serializer_class = AggregatorSerializer


class CityViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = City.objects.all()
    serializer_class = CitySerializer


class CategoryViewSet(viewsets.ModelViewSet):
    queryset = Category.objects.all()
    serializer_class = CategorySerializer

    @action(detail=False, methods=['get'])
    def tree(self, request):
        """Получить иерархическое дерево категорий"""
        root_categories = Category.objects.filter(parent__isnull=True).order_by('sort_order', 'name')
        serializer = CategoryTreeSerializer(root_categories, many=True)
        return Response(serializer.data)


class ProductViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Product.objects.all().select_related('category')
    serializer_class = ProductSerializer

    @action(detail=False, methods=['get'])
    def comparison(self, request):
        price_qs = Price.objects.select_related('aggregator')
        if request.GET.get('city'):
            price_qs = price_qs.filter(city__slug=request.GET.get('city'))

        products = Product.objects.all().select_related('category').prefetch_related(
            Prefetch('price_set', queryset=price_qs, to_attr='filtered_prices'),
            'links'
        )
        serializer = ProductComparisonSerializer(products, many=True, context={'request': request})
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
        if request.GET.get('city'):
            prices = prices.filter(city__slug=request.GET.get('city'))
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
        )
        if request.GET.get('city'):
            our_price = our_price.filter(city__slug=request.GET.get('city'))
        our_price = our_price.first()

        if not our_price or not our_price.is_available or not our_price.price:
            competitor_prices = Price.objects.filter(
                product=product,
                is_available=True
            ).exclude(aggregator=our_aggregator).exclude(price__isnull=True)
            
            if request.GET.get('city'):
                competitor_prices = competitor_prices.filter(city__slug=request.GET.get('city'))

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

    matcher = ProductMatcher()
    count = 0

    for product in Product.objects.all():
        rec = matcher.run(product)
        if rec:
            new_recommendations.append(RecommendationSerializer(rec).data)
            count += 1

    return Response({
        'status': 'success',
        'new_recommendations': count,
        'recommendations': new_recommendations
    })


@api_view(['GET'])
def price_history(request):
    history = PriceHistory.objects.all().select_related('product', 'aggregator').order_by('-changed_at')[:50]
    serializer = PriceHistorySerializer(history, many=True)
    return Response(serializer.data)


class ProductLinkViewSet(viewsets.ModelViewSet):
    queryset = ProductLink.objects.all().select_related('product', 'aggregator')
    serializer_class = ProductLinkSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        product_id = self.request.query_params.get('product_id')
        if product_id:
            queryset = queryset.filter(product_id=product_id)
        return queryset


class ImportJobViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = ImportJob.objects.all().order_by('-created_at')
    serializer_class = ImportJobSerializer


@api_view(['GET'])
def import_template(request, template_type):
    """Скачать Excel шаблон для импорта"""
    # Define columns
    templates = {
        'products': ['name', 'category', 'brand', 'manufacturer', 'country_of_origin', 'weight_value', 'weight_unit', 'sku', 'image_url'],
        'prices': ['product_name_or_sku', 'aggregator', 'price', 'is_available', 'competitor_brand', 'competitor_country'],
        'links': ['product_name_or_sku', 'aggregator', 'url', 'external_name'],
        'categories': ['name', 'parent_name', 'icon', 'sort_order'],
    }

    if template_type not in templates:
        return Response({'error': 'Unknown template type'}, status=400)

    # create DataFrame
    df = pd.DataFrame(columns=templates[template_type])

    # Add examples
    examples = {
        'products': [{
            'name': 'Молоко 2.5%', 
            'category': 'Молочные продукты', 
            'brand': 'Lactel', 
            'manufacturer': 'Lactalis', 
            'country_of_origin': 'Казахстан', 
            'weight_value': 1, 
            'weight_unit': 'l', 
            'sku': 'MLK001', 
            'image_url': ''
        }],
        'prices': [{
            'product_name_or_sku': 'Молоко 2.5%', 
            'aggregator': 'Glovo', 
            'price': 450, 
            'is_available': True,
            'competitor_brand': 'Lactel', # Optional: if different
            'competitor_country': 'Германия' # Optional
        }],
        'links': [{
            'product_name_or_sku': 'Молоко 2.5%', 
            'aggregator': 'Glovo', 
            'url': 'https://glovo.kz/store/product/123', 
            'external_name': 'Молоко Lactel 2.5% 1л'
        }],
        'categories': [{
            'name': 'Йогурты', 
            'parent_name': 'Молочные продукты', 
            'icon': 'yogurt', 
            'sort_order': 1
        }],
    }
    
    if template_type in examples:
        df = pd.concat([df, pd.DataFrame(examples[template_type])], ignore_index=True)

    # Write to Excel
    output = io.BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        df.to_excel(writer, index=False, sheet_name='Template')
        
        # Adjust column widths for better UX
        worksheet = writer.sheets['Template']
        for idx, col in enumerate(df.columns):
            max_len = max(
                df[col].astype(str).map(len).max(),
                len(str(col))
            ) + 2
            worksheet.column_dimensions[chr(65 + idx)].width = min(max_len, 50)

    output.seek(0)
    
    response = HttpResponse(
        output.read(),
        content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    )
    response['Content-Disposition'] = f'attachment; filename="{template_type}_template.xlsx"'
    return response


@api_view(['POST'])
@parser_classes([MultiPartParser, FormParser])
def import_products(request):
    """Импорт товаров из CSV/Excel"""
    file = request.FILES.get('file')
    if not file:
        return Response({'error': 'No file provided'}, status=400)

    job = ImportJob.objects.create(
        job_type='products',
        file_name=file.name,
        status='processing'
    )

    importer = DataImporter(job)
    # Run in background ideally, but synchronous for now as in original
    importer.process(file)

    return Response({
        'job_id': job.id,
        'status': job.status,
        'total': job.total_rows,
        'success': job.success_count,
        'errors': job.error_count,
        'error_details': job.error_details
    })


@api_view(['POST'])
@parser_classes([MultiPartParser, FormParser])
def import_prices(request):
    """Импорт цен из CSV/Excel"""
    file = request.FILES.get('file')
    if not file:
        return Response({'error': 'No file provided'}, status=400)

    job = ImportJob.objects.create(
        job_type='prices',
        file_name=file.name,
        status='processing'
    )

    importer = DataImporter(job)
    importer.process(file)

    return Response({
        'job_id': job.id,
        'status': job.status,
        'total': job.total_rows,
        'success': job.success_count,
        'errors': job.error_count,
        'error_details': job.error_details
    })


@api_view(['POST'])
@parser_classes([MultiPartParser, FormParser])
def import_links(request):
    """Импорт ссылок из CSV/Excel"""
    file = request.FILES.get('file')
    if not file:
        return Response({'error': 'No file provided'}, status=400)

    job = ImportJob.objects.create(
        job_type='links',
        file_name=file.name,
        status='processing'
    )

    importer = DataImporter(job)
    importer.process(file)

    return Response({
        'job_id': job.id,
        'status': job.status,
        'total': job.total_rows,
        'success': job.success_count,
        'errors': job.error_count,
        'error_details': job.error_details
    })


@api_view(['POST'])
@parser_classes([MultiPartParser, FormParser])
def import_categories(request):
    """Импорт категорий из CSV/Excel"""
    file = request.FILES.get('file')
    if not file:
        return Response({'error': 'No file provided'}, status=400)

    job = ImportJob.objects.create(
        job_type='categories',
        file_name=file.name,
        status='processing'
    )

    importer = DataImporter(job)
    importer.process(file)

    return Response({
        'job_id': job.id,
        'status': job.status,
        'total': job.total_rows,
        'success': job.success_count,
        'errors': job.error_count,
        'error_details': job.error_details
    })
