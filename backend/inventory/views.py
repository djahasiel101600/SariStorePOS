# backend/inventory/views.py
from rest_framework import viewsets, status
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView as BaseTokenRefreshView
from rest_framework_simplejwt.tokens import RefreshToken
from django.db.models import Sum, Count, Q, F
from django.utils import timezone
from datetime import timedelta
from django.db import transaction
from decimal import Decimal, InvalidOperation
from django.contrib.auth.models import User
from .models import Product, Customer, Sale, SaleItem, Purchase, PurchaseItem, Payment, UNIT_TYPES, PRICING_MODELS
from .serializers import *
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from django.utils.text import slugify
import requests
import os
import csv
import io

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


@api_view(['POST'])
def bulk_import_products(request):
    """
    Bulk import products from CSV file.
    
    Expected CSV columns:
    - Required: name, price, stock_quantity
    - Optional: barcode, category, unit_type, pricing_model, cost_price, min_stock_level, image_url
    
    Request body:
    - file: CSV file
    - download_images: boolean (default: False)
    - preview_only: boolean (default: False) - if True, only validate and return preview
    
    Returns preview/validation results or import results.
    """
    MAX_FILE_SIZE = 5 * 1024 * 1024  # 5MB
    MAX_ROWS = 1000
    
    if 'file' not in request.FILES:
        return Response({'error': 'CSV file is required'}, status=status.HTTP_400_BAD_REQUEST)
    
    csv_file = request.FILES['file']
    download_images = request.data.get('download_images', 'false').lower() == 'true'
    preview_only = request.data.get('preview_only', 'false').lower() == 'true'
    
    # Check file size
    if csv_file.size > MAX_FILE_SIZE:
        return Response(
            {'error': f'File size exceeds maximum allowed size of {MAX_FILE_SIZE / 1024 / 1024}MB'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # Check file extension
    if not csv_file.name.lower().endswith('.csv'):
        return Response({'error': 'File must be a CSV file'}, status=status.HTTP_400_BAD_REQUEST)
    
    try:
        # Read CSV file
        decoded_file = csv_file.read().decode('utf-8-sig')  # Handle BOM
        csv_reader = csv.DictReader(io.StringIO(decoded_file))
        
        rows = list(csv_reader)
        
        # Check row limit
        if len(rows) > MAX_ROWS:
            return Response(
                {'error': f'CSV file contains {len(rows)} rows. Maximum allowed is {MAX_ROWS} rows.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if len(rows) == 0:
            return Response({'error': 'CSV file is empty'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Validate headers
        required_headers = ['name', 'price', 'stock_quantity']
        optional_headers = ['barcode', 'category', 'unit_type', 'pricing_model', 'cost_price', 'min_stock_level', 'image_url']
        all_headers = required_headers + optional_headers
        
        csv_headers = [h.strip().lower() for h in csv_reader.fieldnames] if csv_reader.fieldnames else []
        
        missing_headers = [h for h in required_headers if h not in csv_headers]
        if missing_headers:
            return Response(
                {'error': f'Missing required columns: {", ".join(missing_headers)}'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Validate and process rows
        validated_rows = []
        errors = []
        existing_products = set()
        
        # Get existing product names and barcodes for duplicate checking
        existing_names = set(Product.objects.filter(is_active=True).values_list('name', flat=True))
        existing_barcodes = set(
            Product.objects.filter(is_active=True, barcode__isnull=False)
            .exclude(barcode='')
            .values_list('barcode', flat=True)
        )
        
        for row_num, row in enumerate(rows, start=2):  # Start at 2 (row 1 is header)
            row_errors = []
            row_data = {}
            
            # Required fields
            name = row.get('name', '').strip()
            if not name:
                row_errors.append('name is required')
            else:
                row_data['name'] = name
            
            # Check for duplicate name
            if name and name in existing_names:
                row_errors.append(f'Product with name "{name}" already exists')
            
            # Price validation
            price_str = row.get('price', '').strip()
            if not price_str:
                row_errors.append('price is required')
            else:
                try:
                    price = Decimal(price_str)
                    if price < 0:
                        row_errors.append('price must be >= 0')
                    else:
                        row_data['price'] = price
                except (InvalidOperation, ValueError):
                    row_errors.append(f'invalid price value: {price_str}')
            
            # Stock quantity validation
            stock_str = row.get('stock_quantity', '').strip()
            if not stock_str:
                row_errors.append('stock_quantity is required')
            else:
                try:
                    stock = Decimal(stock_str)
                    if stock < 0:
                        row_errors.append('stock_quantity must be >= 0')
                    else:
                        row_data['stock_quantity'] = stock
                except (InvalidOperation, ValueError):
                    row_errors.append(f'invalid stock_quantity value: {stock_str}')
            
            # Optional fields with defaults
            barcode = row.get('barcode', '').strip() or None
            if barcode:
                # Check for duplicate barcode
                if barcode in existing_barcodes:
                    row_errors.append(f'Product with barcode "{barcode}" already exists')
                row_data['barcode'] = barcode
            else:
                row_data['barcode'] = None
            
            category = row.get('category', '').strip() or ''
            row_data['category'] = category
            
            unit_type = row.get('unit_type', '').strip().lower() or 'piece'
            if unit_type not in [ut[0] for ut in UNIT_TYPES]:
                row_errors.append(f'invalid unit_type: {unit_type}. Must be one of: {", ".join([ut[0] for ut in UNIT_TYPES])}')
            else:
                row_data['unit_type'] = unit_type
            
            pricing_model = row.get('pricing_model', '').strip().lower() or 'fixed_per_unit'
            if pricing_model not in [pm[0] for pm in PRICING_MODELS]:
                row_errors.append(f'invalid pricing_model: {pricing_model}. Must be one of: {", ".join([pm[0] for pm in PRICING_MODELS])}')
            else:
                row_data['pricing_model'] = pricing_model
            
            # Cost price (optional)
            cost_price_str = row.get('cost_price', '').strip()
            if cost_price_str:
                try:
                    cost_price = Decimal(cost_price_str)
                    if cost_price < 0:
                        row_errors.append('cost_price must be >= 0')
                    else:
                        row_data['cost_price'] = cost_price
                except (InvalidOperation, ValueError):
                    row_errors.append(f'invalid cost_price value: {cost_price_str}')
            else:
                row_data['cost_price'] = None
            
            # Min stock level (optional, default 5)
            min_stock_str = row.get('min_stock_level', '').strip()
            if min_stock_str:
                try:
                    min_stock = Decimal(min_stock_str)
                    if min_stock < 0:
                        row_errors.append('min_stock_level must be >= 0')
                    else:
                        row_data['min_stock_level'] = min_stock
                except (InvalidOperation, ValueError):
                    row_errors.append(f'invalid min_stock_level value: {min_stock_str}')
            else:
                row_data['min_stock_level'] = Decimal('5')
            
            # Image URL (optional)
            image_url = row.get('image_url', '').strip() or None
            row_data['image_url'] = image_url
            
            if row_errors:
                errors.append({
                    'row': row_num,
                    'errors': row_errors,
                    'data': row_data
                })
            else:
                validated_rows.append({
                    'row': row_num,
                    'data': row_data
                })
                # Track for duplicate checking within CSV
                if name:
                    existing_products.add(name.lower())
                if barcode:
                    existing_products.add(barcode)
        
        # If there are validation errors, return them (fail entirely)
        if errors:
            return Response({
                'valid': False,
                'errors': errors,
                'total_rows': len(rows),
                'valid_rows': len(validated_rows),
                'error_rows': len(errors)
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # If preview only, return preview
        if preview_only:
            return Response({
                'valid': True,
                'preview': validated_rows,
                'total_rows': len(validated_rows),
                'download_images': download_images
            }, status=status.HTTP_200_OK)
        
        # Actually import the products
        imported_products = []
        skipped_products = []
        
        with transaction.atomic():
            for row_info in validated_rows:
                row_data = row_info['data']
                
                # Double-check for duplicates (in case of race condition)
                name = row_data['name']
                barcode = row_data.get('barcode')
                
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
                    'name': row_data['name'],
                    'barcode': row_data.get('barcode'),
                    'category': row_data.get('category', ''),
                    'unit_type': row_data.get('unit_type', 'piece'),
                    'pricing_model': row_data.get('pricing_model', 'fixed_per_unit'),
                    'price': row_data.get('price'),
                    'cost_price': row_data.get('cost_price'),
                    'stock_quantity': row_data.get('stock_quantity', 0),
                    'min_stock_level': row_data.get('min_stock_level', 5),
                    'is_active': True
                }
                
                # Handle image if provided and download_images is enabled
                image_path = None
                if download_images and row_data.get('image_url'):
                    try:
                        image_url = row_data['image_url']
                        resp = requests.get(image_url, timeout=15)
                        if resp.status_code == 200:
                            content_type = resp.headers.get('Content-Type', '')
                            if content_type.startswith('image'):
                                # Determine extension
                                ext = '.jpg'
                                if 'png' in content_type:
                                    ext = '.png'
                                elif 'webp' in content_type:
                                    ext = '.webp'
                                elif 'gif' in content_type:
                                    ext = '.gif'
                                
                                filename = f"{slugify(row_data['name']) or 'product'}{ext}"
                                relative_path = f"products/{filename}"
                                storage_path = default_storage.get_available_name(relative_path)
                                saved_path = default_storage.save(storage_path, ContentFile(resp.content))
                                image_path = saved_path
                    except Exception as e:
                        # Log error but don't fail the import
                        print(f"Failed to download image for {row_data['name']}: {str(e)}")
                
                # Create product
                product = Product(**product_data)
                if image_path:
                    product.image.name = image_path
                product.save()
                
                imported_products.append({
                    'row': row_info['row'],
                    'id': product.id,
                    'name': product.name
                })
        
        return Response({
            'success': True,
            'imported': len(imported_products),
            'skipped': len(skipped_products),
            'total_rows': len(validated_rows),
            'imported_products': imported_products,
            'skipped_products': skipped_products
        }, status=status.HTTP_201_CREATED)
        
    except UnicodeDecodeError:
        return Response({'error': 'Invalid file encoding. Please use UTF-8 encoded CSV file.'}, status=status.HTTP_400_BAD_REQUEST)
    except Exception as e:
        return Response({'error': f'Error processing CSV file: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


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