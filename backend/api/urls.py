from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register(r'aggregators', views.AggregatorViewSet)
router.register(r'categories', views.CategoryViewSet)
router.register(r'products', views.ProductViewSet)
router.register(r'recommendations', views.RecommendationViewSet)

urlpatterns = [
    path('', include(router.urls)),
    path('dashboard/', views.dashboard_stats, name='dashboard'),
    path('analytics/gaps/', views.analytics_gaps, name='analytics-gaps'),
    path('algorithm/run/', views.run_algorithm, name='run-algorithm'),
    path('price-history/', views.price_history, name='price-history'),
]
