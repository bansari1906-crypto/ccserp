from rest_framework import viewsets, filters
from rest_framework.permissions import IsAuthenticated, BasePermission, SAFE_METHODS
from django_filters.rest_framework import DjangoFilterBackend
from apps.accounts.models import UserRole
from .models import Category, SubCategory, Brand, Product
from .serializers import CategorySerializer, SubCategorySerializer, BrandSerializer, ProductSerializer

class IsAdminOrReadOnly(BasePermission):
    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return request.user.is_authenticated
        return request.user.is_authenticated and request.user.role in [UserRole.SUPER_ADMIN, UserRole.ADMIN]

class CategoryViewSet(viewsets.ModelViewSet):
    queryset = Category.objects.all().order_by('-created_at')
    serializer_class = CategorySerializer
    permission_classes = [IsAdminOrReadOnly]
    filter_backends = [filters.SearchFilter, DjangoFilterBackend]
    search_fields = ['name']

class SubCategoryViewSet(viewsets.ModelViewSet):
    queryset = SubCategory.objects.select_related('category').all().order_by('-created_at')
    serializer_class = SubCategorySerializer
    permission_classes = [IsAdminOrReadOnly]
    filter_backends = [filters.SearchFilter, DjangoFilterBackend]
    filterset_fields = ['category']
    search_fields = ['name']

class BrandViewSet(viewsets.ModelViewSet):
    queryset = Brand.objects.all().order_by('-created_at')
    serializer_class = BrandSerializer
    permission_classes = [IsAdminOrReadOnly]
    filter_backends = [filters.SearchFilter, DjangoFilterBackend]
    search_fields = ['name']

from rest_framework.response import Response
from rest_framework import status
from apps.orders.models import OrderItem
from apps.inventory.models import StockLedger

class ProductViewSet(viewsets.ModelViewSet):
    queryset = Product.objects.select_related('category', 'sub_category', 'brand').all().order_by('-created_at')
    serializer_class = ProductSerializer
    permission_classes = [IsAdminOrReadOnly]
    filter_backends = [filters.SearchFilter, DjangoFilterBackend]
    filterset_fields = ['category', 'sub_category', 'brand', 'status']
    search_fields = ['name', 'technical_name', 'pack_size', 'crop', 'disease']

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        
        has_orders = OrderItem.objects.filter(product=instance).exists()
        has_stock_tx = StockLedger.objects.filter(product=instance).exists()

        if has_orders or has_stock_tx:
            history_type = "order history" if has_orders else "transaction history"
            return Response(
                {
                    "error": f"Cannot permanently delete product '{instance.name}' because it has existing {history_type}. Deactivate (set to Unavailable) instead.",
                    "can_deactivate": True,
                    "product_id": str(instance.id),
                    "product_name": instance.name,
                    "status": instance.status
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        return super().destroy(request, *args, **kwargs)

