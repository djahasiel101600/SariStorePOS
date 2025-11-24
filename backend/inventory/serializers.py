# serializers.py
from rest_framework import serializers
from django.contrib.auth.models import User
from .models import Product, Customer, Sale, SaleItem, Purchase, PurchaseItem, Payment
from .models import Shift

class ShiftSerializer(serializers.ModelSerializer):
    user_name = serializers.SerializerMethodField()
    
    def get_user_name(self, obj):
        return f"{obj.user.first_name} {obj.user.last_name}".strip() or obj.user.username

    class Meta:
        model = Shift
        fields = [
            'id', 'user', 'user_name', 'start_time', 'end_time', 
            'opening_cash', 'closing_cash', 'expected_cash', 'cash_difference',
            'sales_count', 'total_sales', 'notes', 'status'
        ]
        read_only_fields = ['sales_count', 'total_sales', 'expected_cash', 'cash_difference']

class ShiftStartSerializer(serializers.ModelSerializer):
    """Serializer for starting a new shift"""
    class Meta:
        model = Shift
        fields = ['opening_cash', 'notes', 'terminal_id']
        
class ShiftEndSerializer(serializers.Serializer):
    """Serializer for ending a shift"""
    closing_cash = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=0)
    notes = serializers.CharField(required=False, allow_blank=True)

class ProductSerializer(serializers.ModelSerializer):
    needs_restock = serializers.ReadOnlyField()
    profit_margin = serializers.ReadOnlyField()
    unit_type_display = serializers.CharField(source='get_unit_type_display', read_only=True)
    pricing_model_display = serializers.CharField(source='get_pricing_model_display', read_only=True)
    
    class Meta:
        model = Product
        fields = '__all__'

class CustomerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Customer
        fields = '__all__'

class PaymentSerializer(serializers.ModelSerializer):
    customer_name = serializers.CharField(source='customer.name', read_only=True)
    sale_id = serializers.IntegerField(source='sale.id', read_only=True)

    class Meta:
        model = Payment
        fields = '__all__'

class SaleItemSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source='product.name', read_only=True)
    total_price = serializers.ReadOnlyField()
    
    class Meta:
        model = SaleItem
        fields = '__all__'

class SaleSerializer(serializers.ModelSerializer):
    items = SaleItemSerializer(many=True, read_only=True)
    customer_name = serializers.CharField(source='customer.name', read_only=True)
    payments = PaymentSerializer(many=True, read_only=True)
    # allow exposing the idempotency key in responses (write handled by view)
    idempotency_key = serializers.CharField(read_only=True)
    shift = serializers.PrimaryKeyRelatedField(read_only=True)

    class Meta:
        model = Sale
        fields = '__all__'

class PurchaseItemSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source='product.name', read_only=True)
    
    class Meta:
        model = PurchaseItem
        fields = '__all__'

class PurchaseSerializer(serializers.ModelSerializer):
    items = PurchaseItemSerializer(many=True, read_only=True)
    
    class Meta:
        model = Purchase
        fields = '__all__'

class UserSerializer(serializers.ModelSerializer):
    # expose role from related UserProfile so frontend can make role-based UI decisions
    role = serializers.SerializerMethodField(read_only=True)

    def get_role(self, obj):
        try:
            return getattr(obj.profile, 'role', None)
        except Exception:
            return None

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'is_staff', 'is_active', 'date_joined', 'role']
        read_only_fields = ['id', 'date_joined', 'role']


class UserCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating users with password"""
    password = serializers.CharField(write_only=True, required=True, style={'input_type': 'password'})

    class Meta:
        model = User
        fields = ['id', 'username', 'password', 'email', 'first_name', 'last_name', 'is_staff']
        read_only_fields = ['id']
    
    def create(self, validated_data):
        password = validated_data.pop('password')
        user = User.objects.create_user(**validated_data)
        user.set_password(password)
        user.save()
        return user