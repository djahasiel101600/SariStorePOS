# backend/inventory/views.py
from rest_framework import viewsets, status
from rest_framework.decorators import action, api_view
from rest_framework.response import Response
from django.db.models import Sum, Count, Q, F
from django.utils import timezone
from datetime import timedelta
from django.db import transaction
from decimal import Decimal
from .models import Product, Customer, Sale, SaleItem, Purchase, PurchaseItem, Payment
from .serializers import *
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from django.utils.text import slugify
import requests
import os

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

    def create(self, request, *args, **kwargs):
        # Allow creation with an existing saved image path (downloaded previously)
        existing_image_path = request.data.get('existing_image_path')

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        instance = serializer.save()

        if existing_image_path and not instance.image:
            # Attach saved file path to image field
            instance.image.name = existing_image_path
            instance.save(update_fields=['image'])

        return Response(self.get_serializer(instance).data, status=status.HTTP_201_CREATED)

    def partial_update(self, request, *args, **kwargs):
        existing_image_path = request.data.get('existing_image_path')
        partial = kwargs.pop('partial', True)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        instance = serializer.save()

        if existing_image_path and not instance.image:
            instance.image.name = existing_image_path
            instance.save(update_fields=['image'])

        return Response(self.get_serializer(instance).data)
    
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
                quantity = Decimal(str(item_data['quantity']))
                
                if product.stock_quantity < quantity:
                    return Response(
                        {'error': f'Insufficient stock for {product.name}. Available: {product.stock_quantity} {product.get_unit_type_display()}'},
                        status=status.HTTP_400_BAD_REQUEST
                    )
                
                unit_price = Decimal(str(item_data['unit_price']))
                item_total = quantity * unit_price
                total_amount += item_total
                
                sale_items.append({
                    'product': product,
                    'quantity': quantity,
                    'unit_price': unit_price,
                    'requested_amount': Decimal(str(item_data.get('requested_amount', 0))) if item_data.get('requested_amount') else None
                })
            
            # Create sale
            sale_data = request.data.copy()
            sale_data['total_amount'] = total_amount

            # Handle utang-specific fields
            payment_method = sale_data.get('payment_method', 'cash')
            if payment_method == 'utang':
                sale_data['amount_paid'] = Decimal('0')
                sale_data['is_fully_paid'] = False
            else:
                # For non-utang, mark fully paid
                sale_data['amount_paid'] = Decimal(str(total_amount))
                sale_data['is_fully_paid'] = True

            serializer = self.get_serializer(data=sale_data)
            serializer.is_valid(raise_exception=True)
            sale = serializer.save()
            
            # Create sale items and update stock
            for item_data in sale_items:
                SaleItem.objects.create(
                    sale=sale,
                    product=item_data['product'],
                    quantity=item_data['quantity'],
                    unit_price=item_data['unit_price'],
                    requested_amount=item_data.get('requested_amount')
                )
                
                # Update product stock
                item_data['product'].stock_quantity -= item_data['quantity']
                item_data['product'].save()

            # Update customer balances for utang
            if payment_method == 'utang' and sale.customer:
                customer = sale.customer
                customer.outstanding_balance = (customer.outstanding_balance or 0) + Decimal(str(total_amount))
                customer.last_utang_date = timezone.now()
                customer.save(update_fields=['outstanding_balance', 'last_utang_date'])
            
            return Response(self.get_serializer(sale).data, status=status.HTTP_201_CREATED)
            
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
                quantity = Decimal(str(item_data['quantity']))
                unit_cost = Decimal(str(item_data['unit_cost']))
                item_total = quantity * unit_cost
                total_cost += item_total
                
                purchase_items.append({
                    'product': product,
                    'quantity': quantity,
                    'unit_cost': unit_cost
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
                product.stock_quantity = Decimal(str(product.stock_quantity)) + item_data['quantity']
                product.cost_price = item_data['unit_cost']  # Update to latest cost
                product.save()
            
            return Response(serializer.data, status=status.HTTP_201_CREATED)
            
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class PaymentViewSet(viewsets.ModelViewSet):
    queryset = Payment.objects.all().order_by('-date_created')
    serializer_class = PaymentSerializer

    @transaction.atomic
    def create(self, request, *args, **kwargs):
      try:
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        payment = serializer.save()

        # Apply payment to customer balance and optional sale
        customer = payment.customer
        customer.outstanding_balance = (customer.outstanding_balance or 0) - payment.amount
        if customer.outstanding_balance < 0:
            customer.outstanding_balance = 0
        customer.save(update_fields=['outstanding_balance'])

        if payment.sale:
            sale = payment.sale
            sale.amount_paid = (sale.amount_paid or 0) + payment.amount
            if sale.amount_paid >= sale.total_amount:
                sale.is_fully_paid = True
            sale.save(update_fields=['amount_paid', 'is_fully_paid'])

        return Response(self.get_serializer(payment).data, status=status.HTTP_201_CREATED)
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


@api_view(['POST'])
def download_image(request):
    """Download an external image and save it to MEDIA_ROOT/products/.

    Expects JSON body with 'url' and optional 'name'. Returns JSON with
    'image_path' (relative storage path) and 'image_url' (public URL).
    """
    url = request.data.get('url') or request.data.get('image_url')
    name = request.data.get('name') or request.data.get('product_name') or 'image'

    if not url:
        return Response({'error': 'url is required'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        resp = requests.get(url, timeout=15)
        if resp.status_code != 200:
            return Response({'error': f'Failed to fetch image: {resp.status_code}'}, status=status.HTTP_400_BAD_REQUEST)

        content_type = resp.headers.get('Content-Type', '')
        if not content_type.startswith('image'):
            return Response({'error': 'Provided URL is not an image'}, status=status.HTTP_400_BAD_REQUEST)

        # Determine extension
        ext = None
        if 'jpeg' in content_type or 'jpg' in content_type:
            ext = '.jpg'
        elif 'png' in content_type:
            ext = '.png'
        elif 'webp' in content_type:
            ext = '.webp'
        elif 'gif' in content_type:
            ext = '.gif'
        else:
            # Fallback: try to extract from URL
            _, url_ext = os.path.splitext(url)
            ext = url_ext if url_ext else '.jpg'

        filename = f"{slugify(name) or 'image'}{ext}"
        relative_path = f"products/{filename}"

        # Ensure we don't overwrite existing file
        storage_path = default_storage.get_available_name(relative_path)
        saved_path = default_storage.save(storage_path, ContentFile(resp.content))
        public_url = default_storage.url(saved_path)
        # Ensure frontend gets an absolute URL (includes host) so it can load the image
        try:
            absolute_url = request.build_absolute_uri(public_url)
        except Exception:
            absolute_url = public_url

        return Response({'image_path': saved_path, 'image_url': absolute_url}, status=status.HTTP_201_CREATED)

    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)