from rest_framework import serializers
from .models import Category, SubCategory, Brand, Product

class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = '__all__'

class SubCategorySerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source='category.name', read_only=True)
    
    class Meta:
        model = SubCategory
        fields = '__all__'

class BrandSerializer(serializers.ModelSerializer):
    class Meta:
        model = Brand
        fields = '__all__'

class ProductSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source='category.name', read_only=True)
    sub_category_name = serializers.CharField(source='sub_category.name', read_only=True)
    brand_name = serializers.CharField(source='brand.name', read_only=True)
    code = serializers.SerializerMethodField()
    price = serializers.SerializerMethodField()
    is_available = serializers.BooleanField(read_only=True)
    bottles_per_case = serializers.SerializerMethodField()
    case_size = serializers.SerializerMethodField()
    case_price = serializers.SerializerMethodField()
    
    class Meta:
        model = Product
        fields = '__all__'

    def get_code(self, obj):
        if obj.barcode:
            return obj.barcode
        return f"PRD-{str(obj.id)[:8].upper()}"

    def get_price(self, obj):
        return float(obj.dealer_price)

    def get_bottles_per_case(self, obj):
        return obj.bottles_per_case

    def get_case_size(self, obj):
        return obj.case_size

    def get_case_price(self, obj):
        return float(obj.case_price)

    def to_internal_value(self, data):
        data = data.copy() if hasattr(data, 'copy') else dict(data)
        import uuid
        cat_val = data.get('category')
        if isinstance(cat_val, str) and cat_val.strip():
            try:
                uuid.UUID(cat_val)
            except ValueError:
                category_obj, _ = Category.objects.get_or_create(name=cat_val.strip())
                data['category'] = str(category_obj.id)
                
        if 'code' in data and not data.get('barcode'):
            data['barcode'] = data['code']
            
        if 'pack_size' in data and not data.get('packing'):
            data['packing'] = data['pack_size']
        elif 'packing' in data and not data.get('pack_size'):
            data['pack_size'] = data['packing']

        return super().to_internal_value(data)
