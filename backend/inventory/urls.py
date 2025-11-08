# backend/inventory/urls.py
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

# backend/inventory/urls.py - Update the router configuration
router = DefaultRouter()
router.register(r'products', views.ProductViewSet, basename='product')
router.register(r'customers', views.CustomerViewSet, basename='customer')
router.register(r'sales', views.SaleViewSet, basename='sale')
router.register(r'purchases', views.PurchaseViewSet, basename='purchase')
router.register(r'payments', views.PaymentViewSet, basename='payment')

urlpatterns = [
    path('', include(router.urls)),
    path('download-image/', views.download_image, name='download-image'),
    path('bulk-import-products/', views.bulk_import_products, name='bulk-import-products'),
    path('dashboard/stats/', views.DashboardViewSet.as_view({'get': 'stats'}), name='dashboard-stats'),
]