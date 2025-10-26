# backend/inventory/views.py
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db.models import Sum, Count, Q, F
from django.utils import timezone
from datetime import timedelta
from django.db import transaction
from .models import Product, Customer, Sale, SaleItem, Purchase, PurchaseItem
from .serializers import *

class ProductViewSet(viewsets.ModelViewSet):
    queryset = Product.objects.filter(is_active=True).order_by('name')
    serializer_class = ProductSerializer
    search_fields = ['name', 'barcode', 'category']
    
    def get_queryset(self):
        return Product.objects.filter(is_active=True).order_by('name')
    
    def perform_destroy(self, instance):
        # Soft delete instead of actual delete
        instance.is_active = False
        instance.save()
    
    @action(detail=False, methods=['get'])
    def low_stock(self, request):
        try:
            low_stock_products = Product.objects.filter(
                stock_quantity__lte=F('min_stock_level'),
                is_active=True
            ).order_by('stock_quantity')
            serializer = self.get_serializer(low_stock_products, many=True)
            return Response(serializer.data)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    @action(detail=False, methods=['get'])
    def search(self, request):
        try:
            query = request.GET.get('q', '').strip()
            if not query:
                return Response([])
                
            products = Product.objects.filter(
                Q(name__icontains=query) | 
                Q(barcode__icontains=query) |
                Q(category__icontains=query),
                is_active=True
            )[:15]  # Limit results for performance
            serializer = self.get_serializer(products, many=True)
            return Response(serializer.data)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class CustomerViewSet(viewsets.ModelViewSet):
    queryset = Customer.objects.all().order_by('name')
    serializer_class = CustomerSerializer

class SaleViewSet(viewsets.ModelViewSet):
    queryset = Sale.objects.all().order_by('-date_created')
    serializer_class = SaleSerializer
    
    @transaction.atomic
    def create(self, request):
        try:
            serializer = self.get_serializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            
            # Calculate total amount from items
            items_data = request.data.get('items', [])
            total_amount = 0
            sale_items = []
            
            # Validate stock and calculate total
            for item_data in items_data:
                product = Product.objects.get(id=item_data['product_id'])
                if product.stock_quantity < item_data['quantity']:
                    return Response(
                        {'error': f'Insufficient stock for {product.name}. Available: {product.stock_quantity}'},
                        status=status.HTTP_400_BAD_REQUEST
                    )
                
                item_total = item_data['quantity'] * item_data['unit_price']
                total_amount += item_total
                
                sale_items.append({
                    'product': product,
                    'quantity': item_data['quantity'],
                    'unit_price': item_data['unit_price']
                })
            
            # Create sale
            sale_data = request.data.copy()
            sale_data['total_amount'] = total_amount
            serializer = self.get_serializer(data=sale_data)
            serializer.is_valid(raise_exception=True)
            sale = serializer.save()
            
            # Create sale items and update stock
            for item_data in sale_items:
                SaleItem.objects.create(
                    sale=sale,
                    product=item_data['product'],
                    quantity=item_data['quantity'],
                    unit_price=item_data['unit_price']
                )
                
                # Update product stock
                item_data['product'].stock_quantity -= item_data['quantity']
                item_data['product'].save()
            
            return Response(serializer.data, status=status.HTTP_201_CREATED)
            
        except Product.DoesNotExist:
            return Response({'error': 'Product not found'}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class PurchaseViewSet(viewsets.ModelViewSet):
    queryset = Purchase.objects.all().order_by('-date_created')
    serializer_class = PurchaseSerializer
    
    @transaction.atomic
    def create(self, request):
        try:
            serializer = self.get_serializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            
            items_data = request.data.get('items', [])
            total_cost = 0
            purchase_items = []
            
            # Calculate total cost
            for item_data in items_data:
                product = Product.objects.get(id=item_data['product_id'])
                item_total = item_data['quantity'] * item_data['unit_cost']
                total_cost += item_total
                
                purchase_items.append({
                    'product': product,
                    'quantity': item_data['quantity'],
                    'unit_cost': item_data['unit_cost']
                })
            
            # Create purchase
            purchase_data = request.data.copy()
            purchase_data['total_cost'] = total_cost
            serializer = self.get_serializer(data=purchase_data)
            serializer.is_valid(raise_exception=True)
            purchase = serializer.save()
            
            # Create purchase items and update stock
            for item_data in purchase_items:
                PurchaseItem.objects.create(
                    purchase=purchase,
                    product=item_data['product'],
                    quantity=item_data['quantity'],
                    unit_cost=item_data['unit_cost']
                )
                
                # Update product stock and cost price
                product = item_data['product']
                product.stock_quantity += item_data['quantity']
                product.cost_price = item_data['unit_cost']  # Update to latest cost
                product.save()
            
            return Response(serializer.data, status=status.HTTP_201_CREATED)
            
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class DashboardViewSet(viewsets.ViewSet):
    def stats(self, request):
        try:
            today = timezone.now().date()
            week_ago = today - timedelta(days=7)
            month_ago = today - timedelta(days=30)
            
            # Sales data
            today_sales = Sale.objects.filter(date_created__date=today).aggregate(
                total=Sum('total_amount')
            )['total'] or 0
            
            weekly_sales = Sale.objects.filter(date_created__date__gte=week_ago).aggregate(
                total=Sum('total_amount')
            )['total'] or 0
            
            monthly_sales = Sale.objects.filter(date_created__date__gte=month_ago).aggregate(
                total=Sum('total_amount')
            )['total'] or 0
            
            # Product counts
            low_stock_count = Product.objects.filter(
                stock_quantity__lte=F('min_stock_level'),
                is_active=True
            ).count()
            
            total_products = Product.objects.filter(is_active=True).count()
            out_of_stock_count = Product.objects.filter(stock_quantity=0, is_active=True).count()
            
            # Recent sales for dashboard
            recent_sales = Sale.objects.select_related('customer').prefetch_related('items').order_by('-date_created')[:5]
            recent_sales_data = SaleSerializer(recent_sales, many=True).data
            
            # Best selling products (last 30 days)
            best_sellers = SaleItem.objects.filter(
                sale__date_created__gte=month_ago
            ).values(
                'product__name', 'product__id'
            ).annotate(
                total_sold=Sum('quantity'),
                total_revenue=Sum(F('quantity') * F('unit_price'))
            ).order_by('-total_sold')[:5]
            
            return Response({
                'sales': {
                    'today': float(today_sales),
                    'week': float(weekly_sales),
                    'month': float(monthly_sales),
                },
                'inventory': {
                    'total_products': total_products,
                    'low_stock': low_stock_count,
                    'out_of_stock': out_of_stock_count,
                },
                'recent_sales': recent_sales_data,
                'best_sellers': list(best_sellers),
            })
            
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)