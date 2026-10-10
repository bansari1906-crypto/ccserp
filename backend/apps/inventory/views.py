import uuid
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from apps.accounts.models import UserRole
from apps.products.models import Product
from .models import Warehouse, Godown, StockLedger, StockType
from .serializers import WarehouseSerializer, GodownSerializer, StockLedgerSerializer
from apps.common.events import broadcast_erp_event

class WarehouseViewSet(viewsets.ModelViewSet):
    serializer_class = WarehouseSerializer
    permission_classes = [permissions.IsAuthenticated]

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        if request.user.role not in [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.WAREHOUSE]:
            self.permission_denied(request, message="Unauthorized. Only Warehouse staff and Admin can access Warehouse inventory.")

    def get_queryset(self):
        # Auto-initialize default warehouse if none exists
        if not Warehouse.objects.exists():
            Warehouse.objects.create(
                name='Main Central Warehouse - Ahmedabad',
                location='Ahmedabad Industrial Zone, Gujarat',
                manager='Head of Warehouse Operations'
            )
        return Warehouse.objects.all()

class GodownViewSet(viewsets.ModelViewSet):
    queryset = Godown.objects.all()
    serializer_class = GodownSerializer
    permission_classes = [permissions.IsAuthenticated]

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        if request.user.role not in [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.WAREHOUSE]:
            self.permission_denied(request, message="Unauthorized. Only Warehouse staff and Admin can access Godown inventory.")
    
    def get_queryset(self):
        qs = super().get_queryset()
        warehouse = self.request.query_params.get('warehouse')
        if warehouse:
            qs = qs.filter(warehouse_id=warehouse)
        return qs

class StockLedgerViewSet(viewsets.ModelViewSet):
    serializer_class = StockLedgerSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        user = self.request.user
        if user.role not in [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.WAREHOUSE]:
            return StockLedger.objects.none()

        qs = StockLedger.objects.select_related('product', 'warehouse', 'godown').order_by('-created_at')
        product = self.request.query_params.get('product')
        warehouse = self.request.query_params.get('warehouse')
        if product:
            qs = qs.filter(product_id=product)
        if warehouse:
            qs = qs.filter(warehouse_id=warehouse)
        return qs

    def create(self, request, *args, **kwargs):
        user = request.user
        if user.role not in [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.WAREHOUSE]:
            return Response({"error": "Unauthorized. Only Warehouse staff and Admin can record stock movements."}, status=status.HTTP_403_FORBIDDEN)

        product_id = request.data.get('product') or request.data.get('product_id')
        warehouse_id = request.data.get('warehouse') or request.data.get('warehouse_id')
        godown_id = request.data.get('godown') or request.data.get('godown_id')
        movement_type = request.data.get('type') or request.data.get('stock_type') or request.data.get('movement_type')
        quantity = request.data.get('quantity')
        reference = request.data.get('reference', '').strip()
        remarks = request.data.get('remarks', '').strip()

        if not product_id:
            return Response({"error": "Product is required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            product = Product.objects.get(id=product_id)
        except (Product.DoesNotExist, ValueError):
            return Response({"error": "Product not found."}, status=status.HTTP_400_BAD_REQUEST)

        # Ensure a warehouse exists
        if not warehouse_id:
            warehouse = Warehouse.objects.first()
            if not warehouse:
                warehouse = Warehouse.objects.create(
                    name='Main Central Warehouse - Ahmedabad',
                    location='Ahmedabad Industrial Zone, Gujarat',
                    manager='Head of Warehouse Operations'
                )
        else:
            try:
                warehouse = Warehouse.objects.get(id=warehouse_id)
            except (Warehouse.DoesNotExist, ValueError):
                return Response({"error": "Warehouse not found."}, status=status.HTTP_400_BAD_REQUEST)

        godown = None
        if godown_id:
            try:
                godown = Godown.objects.get(id=godown_id)
            except (Godown.DoesNotExist, ValueError):
                pass

        if not movement_type:
            return Response({"error": "Movement type is required."}, status=status.HTTP_400_BAD_REQUEST)

        valid_types = [choice[0] for choice in StockType.choices]
        if movement_type not in valid_types:
            return Response({"error": f"Invalid stock movement type '{movement_type}'. Valid: {valid_types}"}, status=status.HTTP_400_BAD_REQUEST)

        if quantity is None:
            return Response({"error": "Quantity is required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            qty = int(quantity)
            if qty <= 0:
                return Response({"error": "Quantity must be an integer greater than zero."}, status=status.HTTP_400_BAD_REQUEST)
        except (ValueError, TypeError):
            return Response({"error": "Invalid quantity provided."}, status=status.HTTP_400_BAD_REQUEST)

        # Apply stock updates to Product model
        if movement_type in [StockType.PURCHASE, StockType.PRODUCTION, StockType.OPENING]:
            product.stock += qty
        elif movement_type in [StockType.DAMAGE, StockType.EXPIRY, StockType.SALE]:
            if product.stock < qty:
                return Response({
                    "error": f"Insufficient stock for {product.name}. Current stock: {product.stock}, requested reduction: {qty}."
                }, status=status.HTTP_400_BAD_REQUEST)
            product.stock -= qty
        elif movement_type == StockType.TRANSFER:
            # Transfer out deduction
            if product.stock < qty:
                return Response({
                    "error": f"Insufficient stock to transfer {product.name}. Available: {product.stock}, Transfer requested: {qty}."
                }, status=status.HTTP_400_BAD_REQUEST)
            product.stock -= qty

        product.save()

        entry = StockLedger.objects.create(
            product=product,
            warehouse=warehouse,
            godown=godown,
            type=movement_type,
            quantity=qty,
            reference=reference,
            remarks=remarks
        )

        serializer = self.get_serializer(entry)
        data = serializer.data
        data['current_stock'] = product.stock

        broadcast_erp_event(
            event_type='stock.updated',
            payload={
                "product_id": str(product.id),
                "product_name": product.name,
                "movement_type": movement_type,
                "quantity": qty,
                "current_stock": product.stock,
                "warehouse_id": str(warehouse.id) if warehouse else None
            },
            target_roles=['Admin', 'Warehouse']
        )

        return Response(data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['get'])
    def current_stock(self, request):
        user = request.user
        if user.role not in [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.WAREHOUSE]:
            return Response({"error": "Unauthorized."}, status=status.HTTP_403_FORBIDDEN)

        products = Product.objects.all().order_by('name')
        summary = [{
            'id': str(p.id),
            'name': p.name,
            'sku': getattr(p, 'code', None) or f"SKU-{str(p.id)[:6].upper()}",
            'category': getattr(p, 'category', 'Agri Products'),
            'stock': p.stock,
            'dealerPrice': float(getattr(p, 'dealer_price', 0) or getattr(p, 'price', 0) or 0),
            'mrp': float(getattr(p, 'mrp', 0) or 0),
            'reorderLevel': 20,
            'status': 'In Stock' if p.stock > 20 else ('Low Stock' if p.stock > 0 else 'Out of Stock')
        } for p in products]
        return Response(summary)
