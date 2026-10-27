from rest_framework import serializers
from .models import Order, OrderItem, OrderTimeline, Invoice
from apps.products.serializers import ProductSerializer

class OrderItemSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source='product.name', read_only=True)
    product_code = serializers.SerializerMethodField()
    pack_size = serializers.CharField(source='product.pack_size', read_only=True)
    packing = serializers.CharField(source='product.packing', read_only=True)
    bottles_per_case = serializers.SerializerMethodField()
    case_size = serializers.SerializerMethodField()
    total_bottles = serializers.SerializerMethodField()

    def get_product_code(self, obj):
        if not obj.product:
            return "PRD-01"
        return getattr(obj.product, 'code', None) or getattr(obj.product, 'barcode', None) or f"PRD-{str(obj.product.id)[:6].upper()}"

    def get_bottles_per_case(self, obj):
        return obj.product.bottles_per_case if obj.product else 10

    def get_case_size(self, obj):
        return obj.product.case_size if obj.product else "10 units/case"

    def get_total_bottles(self, obj):
        bpc = obj.product.bottles_per_case if obj.product else 10
        return obj.quantity * bpc
    
    class Meta:
        model = OrderItem
        fields = '__all__'
        read_only_fields = ('order',)

class OrderSerializer(serializers.ModelSerializer):
    items = OrderItemSerializer(many=True, read_only=True)
    dealer_name = serializers.CharField(source='dealer.username', read_only=True)
    created_by_name = serializers.CharField(source='created_by.username', read_only=True)
    bilty_uploaded_by_name = serializers.CharField(source='bilty_uploaded_by.username', read_only=True)
    lr_generated_by_name = serializers.CharField(source='lr_generated_by.username', read_only=True)
    
    class Meta:
        model = Order
        fields = '__all__'
        read_only_fields = ('order_number', 'status', 'payment_status', 'subtotal', 'discount', 'gst_total', 'grand_total', 'created_by')

    def create(self, validated_data):
        return super().create(validated_data)

class OrderTimelineSerializer(serializers.ModelSerializer):
    created_by_name = serializers.CharField(source='created_by.username', read_only=True)

    class Meta:
        model = OrderTimeline
        fields = '__all__'

class InvoiceSerializer(serializers.ModelSerializer):
    order_number = serializers.CharField(source='order.order_number', read_only=True)
    dealer_id = serializers.UUIDField(source='order.dealer.id', read_only=True)
    dealer = serializers.CharField(source='order.dealer.username', read_only=True)
    dealer_name = serializers.SerializerMethodField()
    total_amount = serializers.DecimalField(source='order.grand_total', max_digits=12, decimal_places=2, read_only=True)
    balance_due = serializers.SerializerMethodField()
    status = serializers.CharField(source='order.payment_status', read_only=True)
    lr_number = serializers.CharField(source='order.lr_number', read_only=True)
    bilty_no = serializers.CharField(source='order.bilty_number', read_only=True)
    created_at = serializers.DateTimeField(source='generated_at', read_only=True)

    def get_dealer_name(self, obj):
        dealer = getattr(obj.order, 'dealer', None) if obj.order else None
        if not dealer:
            return "N/A"
        profile = getattr(dealer, 'dealer_profile', None)
        if profile and getattr(profile, 'company_name', None):
            return profile.company_name
        return dealer.get_full_name() or dealer.username

    def get_balance_due(self, obj):
        if not obj.order:
            return 0.00
        if getattr(obj.order, 'payment_status', '') == 'Paid':
            return 0.00
        return float(obj.order.grand_total or 0.00)

    class Meta:
        model = Invoice
        fields = '__all__'
