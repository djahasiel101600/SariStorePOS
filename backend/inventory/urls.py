# backend/inventory/urls.py
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

# router = DefaultRouter()
# router.register(r'products', views.ProductViewSet)
# router.register(r'customers', views.CustomerViewSet)
# router.register(r'sales', views.SaleViewSet)
# router.register(r'purchases', views.PurchaseViewSet)

# urlpatterns = [
#     path('', include(router.urls)),
#     path('dashboard/stats/', views.DashboardViewSet.as_view({'get': 'stats'}), name='dashboard-stats'),
#     path('products/search/', views.ProductViewSet.as_view({'get': 'search'}), name='product-search'),
#     path('products/low-stock/', views.ProductViewSet.as_view({'get': 'low_stock'}), name='low-stock'),
#     path('products/', views.ProductViewSet.as_view({
#         'get': 'list',
#         'post': 'create'
#     }), name='product-list'),
#     path('products/<int:pk>/', views.ProductViewSet.as_view({
#         'get': 'retrieve',
#         'patch': 'partial_update', 
#         'delete': 'destroy'
#     }), name='product-detail'),
# ]

# backend/inventory/urls.py - Update the router configuration
router = DefaultRouter()
router.register(r'products', views.ProductViewSet, basename='product')
router.register(r'customers', views.CustomerViewSet, basename='customer')
router.register(r'sales', views.SaleViewSet, basename='sale')
router.register(r'purchases', views.PurchaseViewSet, basename='purchase')
router.register(r'payments', views.PaymentViewSet, basename='payment')

urlpatterns = [
    path('', include(router.urls)),
    path('dashboard/stats/', views.DashboardViewSet.as_view({'get': 'stats'}), name='dashboard-stats'),
    
    # # These custom endpoints should work now
    # path('products/search/', views.ProductViewSet.as_view({'get': 'search'}), name='product-search'),
    # path('products/low-stock/', views.ProductViewSet.as_view({'get': 'low_stock'}), name='low-stock'),
]