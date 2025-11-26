# backend/inventory/views.py
from rest_framework import viewsets, status
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView as BaseTokenRefreshView
from rest_framework_simplejwt.tokens import RefreshToken
from django.db.models import Sum, Count, Q, F, Avg
from django.db.models.functions import ExtractHour
from django.utils import timezone
from datetime import timedelta
from django.db import transaction
from decimal import Decimal, InvalidOperation
from django.contrib.auth.models import User
from .models import Product, Customer, Sale, SaleItem, Purchase, PurchaseItem, Payment, UNIT_TYPES, PRICING_MODELS
from .models import Shift
from .serializers import *
from .permissions import RoleRequiredPermission
from .decorators import drf_role_required, role_required
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from django.utils.text import slugify
import requests
import os
import csv
import io
from .models import Sale, AuditLog
from django.http.response import JsonResponse
from .websocket_utils import broadcast_sales_update, broadcast_inventory_update, broadcast_shift_update, broadcast_dashboard_update

class ProductViewSet(viewsets.ModelViewSet):
    queryset = Product.objects.filter(is_active=True).order_by('name')
    serializer_class = ProductSerializer
    search_fields = ['name', 'barcode', 'category']
    permission_classes = [IsAuthenticated]
    
    def get_permissions(self):
        """
        Set permissions based on action:
        - list, retrieve, search, low_stock: All authenticated users
        - create, update, partial_update, destroy: Only admin, manager, inventory_manager
        """
        if self.action in ['list', 'retrieve', 'search', 'low_stock']:
            # Read-only actions - all authenticated users
            return [IsAuthenticated()]
        else:
            # Write actions - restricted roles
            allowed_roles = ['admin', 'manager', 'inventory_manager']
            return [RoleRequiredPermission(allowed_roles)]
    
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
        
        # Broadcast inventory update
        try:
            broadcast_inventory_update({
                'action': 'created',
                'product': ProductSerializer(instance).data
            })
        except Exception as e:
            print(f"WebSocket broadcast error: {e}")

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
        
        # Broadcast inventory update
        try:
            broadcast_inventory_update({
                'action': 'updated',
                'product': ProductSerializer(instance).data
            })
        except Exception as e:
            print(f"WebSocket broadcast error: {e}")

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
    permission_classes = [IsAuthenticated]

    def get_permissions(self):
        """
        Dynamically set allowed_roles based on action:
        - Read actions (list, retrieve): all authenticated users
        - Create/Update actions: all authenticated users (including cashiers)
        - Delete action: only admin, manager, inventory_manager (NOT cashiers)
        """
        if self.action in ['list', 'retrieve']:
            allowed_roles = ['admin', 'manager', 'cashier', 'inventory_manager']
        elif self.action in ['create', 'update', 'partial_update']:
            allowed_roles = ['admin', 'manager', 'cashier', 'inventory_manager']
        elif self.action == 'destroy':
            # Cashiers cannot delete customers
            allowed_roles = ['admin', 'manager', 'inventory_manager']
        else:
            allowed_roles = ['admin', 'manager', 'inventory_manager']
        
        return [RoleRequiredPermission(allowed_roles)]

class SaleViewSet(viewsets.ModelViewSet):
    # Require authentication by default; detailed role checks are applied in get_permissions()
    permission_classes = [IsAuthenticated]

    def get_permissions(self):
        """
        Dynamically set allowed_roles based on action
        """
        if self.action == 'create':
            allowed_roles = ['admin', 'manager', 'cashier']
        elif self.action in ['update', 'partial_update']:
            allowed_roles = ['admin', 'manager']
        elif self.action == 'destroy':
            allowed_roles = ['admin']
        else:  # list, retrieve
            allowed_roles = ['admin', 'manager', 'cashier', 'inventory_manager']
        
        # Return instances with the allowed_roles
        return [RoleRequiredPermission(allowed_roles)]

    def get_queryset(self):
        """
        Filter sales based on user role:
        - Admin and Manager: see all sales
        - Cashier and others: see only their own sales
        """
        queryset = Sale.objects.all().order_by('-date_created')
        user = self.request.user
        
        # Check user role
        try:
            user_role = user.profile.role
            # Admin and Manager can see all sales
            if user_role in ['admin', 'manager']:
                return queryset
        except AttributeError:
            pass
        
        # Cashiers and others only see their own sales
        # Filter by shift user (the person who made the sale)
        return queryset.filter(shift__user=user)

    queryset = Sale.objects.all().order_by('-date_created')
    serializer_class = SaleSerializer
    
    @transaction.atomic
    def create(self, request):
        try:
            # Support idempotency: if client sends an Idempotency-Key header,
            # return existing Sale if one was already created with that key.
            idempotency_key = None
            try:
                idempotency_key = request.headers.get('Idempotency-Key')
            except Exception:
                idempotency_key = request.META.get('HTTP_IDEMPOTENCY_KEY')

            if idempotency_key:
                existing = Sale.objects.filter(idempotency_key=idempotency_key).first()
                if existing:
                    return Response(self.get_serializer(existing).data, status=status.HTTP_200_OK)

            # Validate incoming payload first (do not save yet - we need to compute totals)
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

            # Assign current active shift for the user if exists; require shift
            active_shift = Shift.objects.filter(user=request.user, status='open').first()
            if not active_shift:
                return Response({'error': 'No active shift. Please start a shift before creating sales.'}, status=status.HTTP_403_FORBIDDEN)

            # Attach idempotency key if provided so duplicates are prevented
            if idempotency_key:
                sale_data['idempotency_key'] = idempotency_key
                serializer = self.get_serializer(data=sale_data)
                serializer.is_valid(raise_exception=True)
                sale = serializer.save(cashier=request.user, shift=active_shift)
            else:
                sale = serializer.save(cashier=request.user, shift=active_shift)
            
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

            # Log the sale for accountability
            AuditLog.objects.create(
                user=request.user,
                action='SALE_CREATED',
                model='Sale',
                object_id=sale.id,
                details=f'Sale #{sale.id} created - Total: ${sale.total_amount} by {request.user.username}'
            )

            # Broadcast sale update via WebSocket
            try:
                sale_data = self.get_serializer(sale).data
                broadcast_sales_update({
                    'action': 'created',
                    'sale': sale_data,
                    'cashier': request.user.username
                })
                # Also update dashboard
                broadcast_dashboard_update({'action': 'sale_created'})
            except Exception as e:
                print(f"WebSocket broadcast error: {e}")

            headers = self.get_success_headers(serializer.data)
            return Response(self.get_serializer(sale).data, status=status.HTTP_201_CREATED, headers=headers)
            
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


class ShiftViewSet(viewsets.ModelViewSet):
    queryset = Shift.objects.all().order_by('-start_time')
    serializer_class = None  # set dynamically

    def get_serializer_class(self):
        # Lazy import to avoid circular
        from .serializers import ShiftSerializer
        return ShiftSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        # Admins can see all; others see own shifts
        if hasattr(self.request, 'user') and not self.request.user.is_staff:
            qs = qs.filter(user=self.request.user)
        return qs

    def create(self, request, *args, **kwargs):
        # Start a shift for current user. Enforce one active shift per user.
        terminal_id = request.data.get('terminal_id') or request.headers.get('X-Terminal-Id')
        existing = Shift.objects.filter(user=request.user, status='open').first()
        if existing:
            serializer = self.get_serializer(existing)
            return Response(serializer.data, status=status.HTTP_200_OK)

        shift = Shift.objects.create(user=request.user, terminal_id=terminal_id)
        serializer = self.get_serializer(shift)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'])
    def end(self, request, pk=None):
        shift = self.get_object()
        if shift.status != 'open':
            return Response({'error': 'Shift already closed'}, status=status.HTTP_400_BAD_REQUEST)
        shift.status = 'closed'
        shift.end_time = timezone.now()
        shift.save(update_fields=['status', 'end_time'])
        return Response(self.get_serializer(shift).data)

class PaymentViewSet(viewsets.ModelViewSet):
    queryset = Payment.objects.all().order_by('-date_created')
    serializer_class = PaymentSerializer

    @transaction.atomic
    def create(self, request, *args, **kwargs):
      try:
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        # Get current active shift if user is authenticated
        active_shift = None
        if request.user.is_authenticated:
            active_shift = Shift.objects.filter(user=request.user, end_time__isnull=True).first()
        
        # Save payment with shift reference
        payment = serializer.save(shift=active_shift)

        # Apply payment to customer balance
        customer = payment.customer
        customer.outstanding_balance = (customer.outstanding_balance or 0) - payment.amount
        if customer.outstanding_balance < 0:
            customer.outstanding_balance = 0
        customer.save(update_fields=['outstanding_balance'])

        # If payment is linked to a specific sale, update that sale
        if payment.sale:
            sale = payment.sale
            sale.amount_paid = (sale.amount_paid or 0) + payment.amount
            if sale.amount_paid >= sale.total_amount:
                sale.is_fully_paid = True
            sale.save(update_fields=['amount_paid', 'is_fully_paid'])
        else:
            # If payment is not linked to a specific sale, distribute it across unpaid sales
            # Get all unpaid Utang sales for this customer, ordered by date (oldest first)
            unpaid_sales = Sale.objects.filter(
                customer=customer,
                payment_method='utang',
                is_fully_paid=False
            ).order_by('date_created')
            
            remaining_payment = payment.amount
            
            # Distribute payment across unpaid sales and create payment records for tracking
            for sale in unpaid_sales:
                if remaining_payment <= 0:
                    break
                
                outstanding = sale.total_amount - (sale.amount_paid or 0)
                if outstanding > 0:
                    # Apply payment to this sale
                    payment_to_apply = min(remaining_payment, outstanding)
                    sale.amount_paid = (sale.amount_paid or 0) + payment_to_apply
                    
                    # Check if sale is now fully paid
                    if sale.amount_paid >= sale.total_amount:
                        sale.is_fully_paid = True
                    
                    sale.save(update_fields=['amount_paid', 'is_fully_paid'])
                    
                    # Create a payment record linked to this sale for tracking split payments
                    # This allows tracking of each portion when a payment is split across multiple sales
                    Payment.objects.create(
                        customer=customer,
                        sale=sale,
                        amount=payment_to_apply,
                        method=payment.method,
                        notes=f"From payment #{payment.id}" + (f": {payment.notes}" if payment.notes else "")
                    )
                    
                    remaining_payment -= payment_to_apply
            
            # Note: The original payment record remains unlinked (sale=null) when distributed
            # This serves as an audit record of the total payment made
            # Individual sale payment histories show the split portions created above

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
            
            # Sales trends - last 30 days daily breakdown
            sales_trend = []
            for i in range(29, -1, -1):
                date = today - timedelta(days=i)
                daily_total = Sale.objects.filter(
                    date_created__date=date
                ).aggregate(total=Sum('total_amount'))['total'] or 0
                sales_trend.append({
                    'date': date.isoformat(),
                    'amount': float(daily_total)
                })
            
            # Payment method breakdown (last 30 days)
            payment_breakdown = Sale.objects.filter(
                date_created__date__gte=month_ago
            ).values('payment_method').annotate(
                total=Sum('total_amount'),
                count=Count('id')
            ).order_by('-total')
            
            # Profit analysis (last 30 days) - handle NULL cost_price gracefully
            revenue = Sale.objects.filter(
                date_created__date__gte=month_ago
            ).aggregate(total=Sum('total_amount'))['total'] or 0
            
            # Calculate cost from sale items (only for products with cost_price set)
            try:
                cost_data = SaleItem.objects.filter(
                    sale__date_created__date__gte=month_ago,
                    product__cost_price__isnull=False
                ).aggregate(
                    total_cost=Sum(F('quantity') * F('product__cost_price'))
                )
                total_cost = cost_data['total_cost'] or 0
            except Exception as cost_err:
                print(f"Cost calculation error: {cost_err}")
                total_cost = 0
            
            gross_profit = float(revenue) - float(total_cost)
            profit_margin = (gross_profit / float(revenue) * 100) if revenue > 0 else 0
            
            # Product counts
            low_stock_count = Product.objects.filter(
                stock_quantity__lte=F('min_stock_level'),
                is_active=True
            ).count()
            
            total_products = Product.objects.filter(is_active=True).count()
            out_of_stock_count = Product.objects.filter(stock_quantity=0, is_active=True).count()
            
            # Recent sales for dashboard
            recent_sales = Sale.objects.select_related('customer', 'cashier', 'shift').prefetch_related('items').order_by('-date_created')[:5]
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
            
            # Top customers by spending (last 30 days)
            try:
                top_customers = Sale.objects.filter(
                    date_created__date__gte=month_ago,
                    customer__isnull=False
                ).values(
                    'customer__id', 'customer__name'
                ).annotate(
                    total_spent=Sum('total_amount'),
                    transaction_count=Count('id')
                ).order_by('-total_spent')[:5]
            except Exception:
                top_customers = []
            
            # Category performance (last 30 days)
            try:
                category_performance = SaleItem.objects.filter(
                    sale__date_created__date__gte=month_ago,
                    product__category__isnull=False
                ).values(
                    'product__category'
                ).annotate(
                    total_revenue=Sum(F('quantity') * F('unit_price')),
                    items_sold=Sum('quantity')
                ).order_by('-total_revenue')[:8]
            except Exception:
                category_performance = []
            
            # Shift performance (last 30 days)
            try:
                shift_performance = Sale.objects.filter(
                    date_created__date__gte=month_ago,
                    cashier__isnull=False
                ).values(
                    'cashier__username', 'cashier__id'
                ).annotate(
                    total_sales=Sum('total_amount'),
                    transaction_count=Count('id'),
                    avg_transaction=Avg('total_amount')
                ).order_by('-total_sales')[:10]
            except Exception:
                shift_performance = []
            
            # Hourly sales pattern (last 7 days) - use Python to extract hour to avoid SQLite issues
            try:
                from django.db.models.functions import ExtractHour
                hourly_sales = Sale.objects.filter(
                    date_created__gte=timezone.now() - timedelta(days=7)
                ).annotate(
                    hour=ExtractHour('date_created')
                ).values('hour').annotate(
                    total=Sum('total_amount'),
                    count=Count('id')
                ).order_by('hour')
            except Exception as hourly_err:
                print(f"Hourly sales error: {hourly_err}")
                hourly_sales = []
            
            return Response({
                'sales': {
                    'today': float(today_sales),
                    'week': float(weekly_sales),
                    'month': float(monthly_sales),
                    'trend': sales_trend,
                },
                'profit': {
                    'revenue': float(revenue),
                    'cost': float(total_cost),
                    'gross_profit': gross_profit,
                    'margin_percent': round(profit_margin, 2),
                },
                'payment_methods': list(payment_breakdown),
                'inventory': {
                    'total_products': total_products,
                    'low_stock': low_stock_count,
                    'out_of_stock': out_of_stock_count,
                },
                'recent_sales': recent_sales_data,
                'best_sellers': list(best_sellers),
                'top_customers': list(top_customers),
                'category_performance': list(category_performance),
                'shift_performance': list(shift_performance),
                'hourly_pattern': list(hourly_sales),
            })
            
        except Exception as e:
            import traceback
            print(f"Dashboard stats error: {str(e)}")
            print(traceback.format_exc())
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


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def bulk_import_products(request):
    """
    Bulk import products from CSV file.
    """
    # Role checking (additional to authentication)
    if not hasattr(request.user, 'profile'):
        return Response({'error': 'User profile not found'}, status=status.HTTP_403_FORBIDDEN)
    
    allowed_roles = ['admin', 'manager', 'inventory_manager']
    if request.user.profile.role not in allowed_roles:
        return Response({'error': 'Insufficient permissions'}, status=status.HTTP_403_FORBIDDEN)
    
    MAX_FILE_SIZE = 5 * 1024 * 1024  # 5MB
    MAX_ROWS = 1000
    
    if 'file' not in request.FILES:
        return Response({'error': 'CSV file is required'}, status=status.HTTP_400_BAD_REQUEST)
    
    csv_file = request.FILES['file']
    download_images = request.data.get('download_images', 'false').lower() == 'true'
    preview_only = request.data.get('preview_only', 'false').lower() == 'true'
    
    # Validate file
    if csv_file.size > MAX_FILE_SIZE:
        return Response(
            {'error': f'File size exceeds maximum allowed size of {MAX_FILE_SIZE / 1024 / 1024}MB'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    if not csv_file.name.lower().endswith('.csv'):
        return Response({'error': 'File must be a CSV file'}, status=status.HTTP_400_BAD_REQUEST)
    
    try:
        # Read and parse CSV
        decoded_file = csv_file.read().decode('utf-8-sig')
        csv_reader = csv.DictReader(io.StringIO(decoded_file))
        rows = list(csv_reader)
        
        # Validate basic file structure
        if len(rows) > MAX_ROWS:
            return Response(
                {'error': f'CSV file contains {len(rows)} rows. Maximum allowed is {MAX_ROWS} rows.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if len(rows) == 0:
            return Response({'error': 'CSV file is empty'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Validate headers
        required_headers = ['name', 'price', 'stock_quantity']
        csv_headers = [h.strip().lower() for h in csv_reader.fieldnames] if csv_reader.fieldnames else []
        
        missing_headers = [h for h in required_headers if h not in csv_headers]
        if missing_headers:
            return Response(
                {'error': f'Missing required columns: {", ".join(missing_headers)}'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Process rows
        validated_rows = []
        errors = []
        
        # Use iterator for better performance with large datasets
        existing_names = Product.objects.filter(is_active=True).values_list('name', flat=True)
        existing_barcodes = Product.objects.filter(
            is_active=True, 
            barcode__isnull=False
        ).exclude(barcode='').values_list('barcode', flat=True)
        
        existing_names_set = set(existing_names)
        existing_barcodes_set = set(existing_barcodes)
        
        seen_names_in_csv = set()
        seen_barcodes_in_csv = set()
        
        for row_num, row in enumerate(rows, start=2):
            row_errors = []
            row_data = {}
            
            # Process name
            name = row.get('name', '').strip()
            if not name:
                row_errors.append('Name is required')
            else:
                row_data['name'] = name
                # Check duplicates in CSV
                if name.lower() in seen_names_in_csv:
                    row_errors.append(f'Duplicate product name in CSV: "{name}"')
                else:
                    seen_names_in_csv.add(name.lower())
                # Check duplicates in database
                if name in existing_names_set:
                    row_errors.append(f'Product with name "{name}" already exists')
            
            # Process price
            price_str = row.get('price', '').strip()
            if not price_str:
                row_errors.append('Price is required')
            else:
                try:
                    price = Decimal(price_str)
                    if price < 0:
                        row_errors.append('Price must be >= 0')
                    else:
                        row_data['price'] = price
                except (InvalidOperation, ValueError):
                    row_errors.append(f'Invalid price value: {price_str}')
            
            # Process stock
            stock_str = row.get('stock_quantity', '').strip()
            if not stock_str:
                row_errors.append('Stock quantity is required')
            else:
                try:
                    stock = Decimal(stock_str)
                    if stock < 0:
                        row_errors.append('Stock quantity must be >= 0')
                    else:
                        row_data['stock_quantity'] = stock
                except (InvalidOperation, ValueError):
                    row_errors.append(f'Invalid stock quantity value: {stock_str}')
            
            # Process barcode
            barcode = row.get('barcode', '').strip() or None
            if barcode:
                # Check duplicates in CSV
                if barcode in seen_barcodes_in_csv:
                    row_errors.append(f'Duplicate barcode in CSV: "{barcode}"')
                else:
                    seen_barcodes_in_csv.add(barcode)
                # Check duplicates in database
                if barcode in existing_barcodes_set:
                    row_errors.append(f'Product with barcode "{barcode}" already exists')
                row_data['barcode'] = barcode
            
            # Process other fields...
            category = row.get('category', '').strip() or ''
            row_data['category'] = category
            
            unit_type = row.get('unit_type', '').strip().lower() or 'piece'
            valid_unit_types = [ut[0] for ut in UNIT_TYPES]
            if unit_type not in valid_unit_types:
                row_errors.append(f'Invalid unit_type: {unit_type}. Must be one of: {", ".join(valid_unit_types)}')
            else:
                row_data['unit_type'] = unit_type
            
            pricing_model = row.get('pricing_model', '').strip().lower() or 'fixed_per_unit'
            valid_pricing_models = [pm[0] for pm in PRICING_MODELS]
            if pricing_model not in valid_pricing_models:
                row_errors.append(f'Invalid pricing_model: {pricing_model}. Must be one of: {", ".join(valid_pricing_models)}')
            else:
                row_data['pricing_model'] = pricing_model
            
            # Process cost price
            cost_price_str = row.get('cost_price', '').strip()
            if cost_price_str:
                try:
                    cost_price = Decimal(cost_price_str)
                    if cost_price < 0:
                        row_errors.append('Cost price must be >= 0')
                    else:
                        row_data['cost_price'] = cost_price
                except (InvalidOperation, ValueError):
                    row_errors.append(f'Invalid cost price value: {cost_price_str}')
            else:
                row_data['cost_price'] = None
            
            # Process min stock level
            min_stock_str = row.get('min_stock_level', '').strip()
            if min_stock_str:
                try:
                    min_stock = Decimal(min_stock_str)
                    if min_stock < 0:
                        row_errors.append('Min stock level must be >= 0')
                    else:
                        row_data['min_stock_level'] = min_stock
                except (InvalidOperation, ValueError):
                    row_errors.append(f'Invalid min stock level value: {min_stock_str}')
            else:
                row_data['min_stock_level'] = Decimal('5')
            
            # Process image URL
            image_url = row.get('image_url', '').strip() or None
            row_data['image_url'] = image_url
            
            if row_errors:
                errors.append({
                    'row': row_num,
                    'errors': row_errors,
                    'data': {k: str(v) if isinstance(v, Decimal) else v for k, v in row_data.items()}
                })
            else:
                validated_rows.append({
                    'row': row_num,
                    'data': row_data
                })
        
        # Return validation errors if any
        if errors:
            # Log failed attempt
            AuditLog.objects.create(
                user=request.user,
                action='INVENTORY_UPDATE',
                model='Product',
                details=f'Bulk import failed: {len(errors)} validation errors'
            )
            
            return Response({
                'valid': False,
                'errors': errors,
                'total_rows': len(rows),
                'valid_rows': len(validated_rows),
                'error_rows': len(errors)
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Return preview if requested
        if preview_only:
            return Response({
                'valid': True,
                'preview': validated_rows,
                'total_rows': len(validated_rows),
                'download_images': download_images
            }, status=status.HTTP_200_OK)
        
        # Perform actual import
        imported_products = []
        skipped_products = []
        
        with transaction.atomic():
            for row_info in validated_rows:
                row_data = row_info['data']
                name = row_data['name']
                barcode = row_data.get('barcode')
                
                # Final duplicate check within transaction
                if Product.objects.filter(is_active=True, name=name).exists():
                    skipped_products.append({
                        'row': row_info['row'],
                        'name': name,
                        'reason': 'Product with this name already exists'
                    })
                    continue
                
                if barcode and Product.objects.filter(is_active=True, barcode=barcode).exists():
                    skipped_products.append({
                        'row': row_info['row'],
                        'name': name,
                        'reason': 'Product with this barcode already exists'
                    })
                    continue
                
                # Create product
                product_data = {
                    'name': name,
                    'barcode': barcode,
                    'category': row_data.get('category', ''),
                    'unit_type': row_data.get('unit_type', 'piece'),
                    'pricing_model': row_data.get('pricing_model', 'fixed_per_unit'),
                    'price': row_data['price'],
                    'cost_price': row_data.get('cost_price'),
                    'stock_quantity': row_data['stock_quantity'],
                    'min_stock_level': row_data.get('min_stock_level', Decimal('5')),
                    'is_active': True
                }
                
                # Handle image download
                image_path = None
                if download_images and row_data.get('image_url'):
                    image_path = download_and_save_image(row_data['image_url'], name)
                
                # Create and save product
                product = Product(**product_data)
                if image_path:
                    product.image.name = image_path
                product.save()
                
                imported_products.append({
                    'row': row_info['row'],
                    'id': product.id,
                    'name': product.name,
                    'barcode': product.barcode
                })
        
        # Log successful import
        AuditLog.objects.create(
            user=request.user,
            action='INVENTORY_UPDATE',
            model='Product',
            details=f'Bulk import successful: {len(imported_products)} products imported, {len(skipped_products)} skipped'
        )
        
        return Response({
            'success': True,
            'imported': len(imported_products),
            'skipped': len(skipped_products),
            'total_rows': len(rows),
            'imported_products': imported_products,
            'skipped_products': skipped_products
        }, status=status.HTTP_201_CREATED)
        
    except UnicodeDecodeError:
        return Response({'error': 'Invalid file encoding. Please use UTF-8 encoded CSV file.'}, status=status.HTTP_400_BAD_REQUEST)
    except Exception as e:
        # Log the error
        AuditLog.objects.create(
            user=request.user,
            action='INVENTORY_UPDATE',
            model='Product',
            details=f'Bulk import error: {str(e)}'
        )
        return Response({'error': f'Error processing CSV file: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

def download_and_save_image(image_url, product_name):
    """Helper function to download and save product image"""
    try:
        resp = requests.get(image_url, timeout=15)
        if resp.status_code == 200 and resp.headers.get('Content-Type', '').startswith('image'):
            # Determine file extension
            content_type = resp.headers.get('Content-Type', '')
            ext = '.jpg'  # default
            if 'png' in content_type:
                ext = '.png'
            elif 'webp' in content_type:
                ext = '.webp'
            elif 'gif' in content_type:
                ext = '.gif'
            
            filename = f"{slugify(product_name) or 'product'}{ext}"
            relative_path = f"products/{filename}"
            storage_path = default_storage.get_available_name(relative_path)
            saved_path = default_storage.save(storage_path, ContentFile(resp.content))
            return saved_path
    except Exception as e:
        print(f"Failed to download image for {product_name}: {str(e)}")
    return None

# Authentication Views
class CustomTokenObtainPairView(TokenObtainPairView):
    """Custom login view that returns user data along with tokens"""
    permission_classes = [AllowAny]
    
    def post(self, request, *args, **kwargs):
        response = super().post(request, *args, **kwargs)
        if response.status_code == 200:
            # Get user data
            username = request.data.get('username')
            try:
                user = User.objects.get(username=username)
                user_serializer = UserSerializer(user)
                response.data['user'] = user_serializer.data
            except User.DoesNotExist:
                pass
        return response


class CustomTokenRefreshView(BaseTokenRefreshView):
    """Custom token refresh view that allows public access"""
    permission_classes = [AllowAny]


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_current_user(request):
    """Get current authenticated user information"""
    serializer = UserSerializer(request.user)
    return Response(serializer.data)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def logout(request):
    """Logout endpoint (JWT is stateless, but we can blacklist token if needed)"""
    try:
        refresh_token = request.data.get('refresh_token')
        if refresh_token:
            token = RefreshToken(refresh_token)
            token.blacklist()
        return Response({'message': 'Successfully logged out'}, status=status.HTTP_200_OK)
    except Exception as e:
        return Response({'message': 'Successfully logged out'}, status=status.HTTP_200_OK)
    
@api_view(['GET'])
@drf_role_required(['admin', 'manager'])
def sales_performance_report(request):
    """Report showing sales per cashier"""
    days = int(request.GET.get('days', 30))
    start_date = timezone.now() - timedelta(days=days)

    sales_data = Sale.objects.filter(
        date_created__gte=start_date
    ).values(
        'cashier__username',
        'cashier__first_name',
        'cashier__last_name',
        'cashier__profile__role'
    ).annotate(
        total_sales=Count('id'),
        total_revenue=Sum('total_amount'),
        average_sale=Avg('total_amount')
    ).order_by('-total_revenue')

    return Response({
        'period_days': days,
        'start_date': start_date,
        'data': list(sales_data)
    })


# Admin ViewSets
class UserViewSet(viewsets.ModelViewSet):
    """
    ViewSet for user management (admin only)
    """
    queryset = User.objects.all().order_by('-date_joined')
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated, RoleRequiredPermission]
    allowed_roles = ['admin', 'manager']
    
    def get_serializer_class(self):
        if self.action == 'create':
            return UserCreateSerializer
        return UserSerializer
    
    def perform_update(self, serializer):
        # Don't allow password updates through this endpoint
        serializer.save()


class ShiftViewSet(viewsets.ModelViewSet):
    """
    ViewSet for shift management and reporting
    """
    queryset = Shift.objects.all().order_by('-start_time')
    serializer_class = ShiftSerializer
    permission_classes = [IsAuthenticated, RoleRequiredPermission]
    allowed_roles = ['admin', 'manager']
    
    def get_permissions(self):
        # Allow all authenticated users to start/end their own shifts
        if self.action in ['start_shift', 'end_shift', 'my_shift']:
            return [IsAuthenticated()]
        return super().get_permissions()
    
    def get_queryset(self):
        queryset = Shift.objects.all().order_by('-start_time')
        
        # Filter by date range if provided
        start_date = self.request.query_params.get('start_date')
        end_date = self.request.query_params.get('end_date')
        
        if start_date:
            queryset = queryset.filter(start_time__date__gte=start_date)
        if end_date:
            queryset = queryset.filter(start_time__date__lte=end_date)
            
        return queryset
    
    @action(detail=False, methods=['get'], url_path='active')
    def active(self, request):
        """Get all currently active shifts"""
        active_shifts = Shift.objects.filter(end_time__isnull=True).order_by('-start_time')
        serializer = self.get_serializer(active_shifts, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'], url_path='my-shift')
    def my_shift(self, request):
        """Get current user's active shift"""
        shift = Shift.objects.filter(user=request.user, end_time__isnull=True).first()
        if shift:
            serializer = self.get_serializer(shift)
            return Response(serializer.data)
        return Response(None, status=status.HTTP_204_NO_CONTENT)
    
    @action(detail=False, methods=['post'], url_path='start')
    def start_shift(self, request):
        """Start a new shift for the current user"""
        # Check if user already has an active shift
        existing_shift = Shift.objects.filter(user=request.user, end_time__isnull=True).first()
        if existing_shift:
            return Response(
                {'error': 'You already have an active shift'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        serializer = ShiftStartSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        shift = Shift.objects.create(
            user=request.user,
            opening_cash=serializer.validated_data.get('opening_cash', 0),
            notes=serializer.validated_data.get('notes', ''),
            terminal_id=serializer.validated_data.get('terminal_id', ''),
            status='open'
        )
        
        # Broadcast shift update
        try:
            shift_data = ShiftSerializer(shift).data
            print(f"DEBUG: shift_data type: {type(shift_data)}")
            print(f"DEBUG: shift_data keys: {shift_data.keys() if hasattr(shift_data, 'keys') else 'N/A'}")
            
            # Check for Decimal values
            for key, value in shift_data.items():
                print(f"DEBUG: {key} = {value} (type: {type(value)})")
            
            # Convert to dict to ensure proper serialization
            broadcast_shift_update({
                'action': 'started',
                'shift': dict(shift_data)
            })
        except Exception as e:
            print(f"WebSocket broadcast error: {e}")
            import traceback
            traceback.print_exc()
        
        return Response(ShiftSerializer(shift).data, status=status.HTTP_201_CREATED)
    
    @action(detail=True, methods=['post'], url_path='end')
    def end_shift(self, request, pk=None):
        """End the shift with closing cash count"""
        shift = self.get_object()
        
        # Only the shift owner or admin/manager can end it
        if shift.user != request.user and not request.user.profile.role in ['admin', 'manager']:
            return Response(
                {'error': 'You can only end your own shift'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        if shift.end_time:
            return Response(
                {'error': 'Shift already ended'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        serializer = ShiftEndSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        shift.closing_cash = serializer.validated_data['closing_cash']
        shift.notes = serializer.validated_data.get('notes', shift.notes)
        shift.end_time = timezone.now()
        shift.status = 'closed'
        shift.save()
        
        # Broadcast shift update
        try:
            shift_data = ShiftSerializer(shift).data
            # Convert to dict to ensure proper serialization
            broadcast_shift_update({
                'action': 'ended',
                'shift': dict(shift_data)
            })
        except Exception as e:
            print(f"WebSocket broadcast error: {e}")
            import traceback
            traceback.print_exc()
        
        return Response(ShiftSerializer(shift).data)
    
    @action(detail=False, methods=['get'], url_path='employee-performance')
    def employee_performance(self, request):
        """Get employee performance metrics"""
        from django.db.models import Sum, Count, Avg, Max
        
        # Filter by date range if provided
        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')
        
        shifts = Shift.objects.all()
        if start_date:
            shifts = shifts.filter(start_time__date__gte=start_date)
        if end_date:
            shifts = shifts.filter(start_time__date__lte=end_date)
        
        # Aggregate performance by user using Sale model directly
        performance = shifts.values(
            'user__id',
            'user__username',
            'user__first_name',
            'user__last_name'
        ).annotate(
            shift_count=Count('id', distinct=True),
            total_sales=Count('sales__id'),
            total_revenue=Sum('sales__total_amount'),
            last_shift=Max('start_time')
        ).order_by('-total_revenue')
        
        # Calculate average sale
        result = []
        for perf in performance:
            avg_sale = (
                float(perf['total_revenue'] or 0) / perf['total_sales'] 
                if perf['total_sales'] and perf['total_sales'] > 0 
                else 0
            )
            result.append({
                'user_id': perf['user__id'],
                'user_name': f"{perf['user__first_name']} {perf['user__last_name']}".strip() or perf['user__username'],
                'shift_count': perf['shift_count'],
                'total_sales': perf['total_sales'] or 0,
                'total_revenue': float(perf['total_revenue'] or 0),
                'avg_sale': float(avg_sale),
                'last_shift': perf['last_shift']
            })
        
        return Response(result)
