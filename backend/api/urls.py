from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register(r'aggregators', views.AggregatorViewSet)
router.register(r'cities', views.CityViewSet)
router.register(r'categories', views.CategoryViewSet)
router.register(r'products', views.ProductViewSet)
router.register(r'recommendations', views.RecommendationViewSet)
router.register(r'product-links', views.ProductLinkViewSet)
router.register(r'import-jobs', views.ImportJobViewSet)

urlpatterns = [
    path('', include(router.urls)),
    path('dashboard/', views.dashboard_stats, name='dashboard'),
    path('analytics/gaps/', views.analytics_gaps, name='analytics-gaps'),
    path('algorithm/run/', views.run_algorithm, name='run-algorithm'),
    path('price-history/', views.price_history, name='price-history'),
    # Import endpoints
    path('import/template/<str:template_type>/', views.import_template, name='import-template'),
    path('import/products/', views.import_products, name='import-products'),
    path('import/prices/', views.import_prices, name='import-prices'),
    path('import/links/', views.import_links, name='import-links'),
    path('import/categories/', views.import_categories, name='import-categories'),
    # JSON import from Data folder
    path('import/json/info/', views.json_import_info, name='json-import-info'),
    path('import/json/', views.import_from_json, name='import-from-json'),
    # Export
    path('export/products/', views.export_products, name='export-products'),
    # Categories
    path('reset-categories/', views.reset_categories, name='reset-categories'),
]

