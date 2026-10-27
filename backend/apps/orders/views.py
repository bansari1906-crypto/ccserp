import json
from decimal import Decimal
from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from apps.accounts.models import UserRole
from apps.products.models import Product
from .models import Order, OrderItem, OrderStatus
from .serializers import OrderSerializer, OrderItemSerializer
from apps.common.events import broadcast_erp_event

class OrderViewSet(viewsets.ModelViewSet):
    serializer_class = OrderSerializer
    permission_classes = [IsAuthenticated]
    search_fields = ['order_number', 'dealer__username']
    filterset_fields = ['status', 'payment_status', 'dealer']

    def get_queryset(self):
        user = self.request.user
        qs = Order.objects.select_related('dealer', 'created_by').prefetch_related('items__product').order_by('-created_at')
        if user.role in [UserRole.SUPER_ADMIN, UserRole.ADMIN]:
            return qs
        elif user.role == UserRole.WAREHOUSE:
            if self.action in ['generate_lr', 'dispatch_order', 'dispatch_details']:
                return qs
            return qs.filter(status__in=[
                OrderStatus.READY_DISPATCH,
                OrderStatus.BILTY_UPLOADED,
                OrderStatus.DISPATCHED,
                OrderStatus.DELIVERED
            ])
        elif user.role in [UserRole.DISTRIBUTOR, UserRole.DEALER]:
            return qs.filter(dealer=user)
        else: # Employee
            return qs.filter(created_by=user)

    def create(self, request, *args, **kwargs):
        data = request.data
        if request.user.role in [UserRole.DISTRIBUTOR, UserRole.DEALER]:
            dealer_id = request.user.id
        else:
            dealer_id = data.get('dealer') or data.get('dealer_id')
            if not dealer_id:
                from apps.accounts.models import User
                first_dealer = User.objects.filter(role__in=[UserRole.DISTRIBUTOR, UserRole.DEALER]).first()
                dealer_id = first_dealer.id if first_dealer else request.user.id
        items_data = data.get('items', [])
        
        if not items_data:
            return Response({"error": "Order must have at least one item."}, status=status.HTTP_400_BAD_REQUEST)
            
        order = Order.objects.create(
            dealer_id=dealer_id,
            created_by=request.user,
            payment_terms=data.get('payment_terms', data.get('paymentTerms', 'Cash (15 Days)')),
            remarks=data.get('remarks', ''),
            status=OrderStatus.PENDING_APPROVAL
        )
        
        subtotal = Decimal('0.00')
        gst_total = Decimal('0.00')
        grand_total = Decimal('0.00')
        
        for item in items_data:
            product_id = item.get('product') or item.get('product_id')
            if not product_id:
                order.delete()
                return Response({"error": "Product ID is required for each order item."}, status=status.HTTP_400_BAD_REQUEST)

            try:
                product = Product.objects.get(id=product_id)
            except (Product.DoesNotExist, ValueError):
                order.delete()
                return Response({"error": f"Product with ID '{product_id}' was not found."}, status=status.HTTP_400_BAD_REQUEST)

            if not product.is_available:
                order.delete()
                return Response({"error": f"Product '{product.name}' is currently Unavailable ({product.status}) and cannot be ordered."}, status=status.HTTP_400_BAD_REQUEST)

            try:
                qty = int(item.get('quantity', 0))
            except (ValueError, TypeError):
                qty = 0

            if qty <= 0:
                order.delete()
                return Response({"error": f"Quantity for product '{product.name}' must be at least 1."}, status=status.HTTP_400_BAD_REQUEST)
                
            # Enforce full master case pricing: rate = case_price, qty = number of cases
            rate = Decimal(str(product.case_price))
            discount = Decimal('0.00')
            base_price = rate * qty - discount
            gst = base_price * (product.gst / Decimal('100.00'))
            total = base_price + gst
            
            OrderItem.objects.create(
                order=order,
                product=product,
                quantity=qty,
                rate=rate,
                discount=discount,
                gst_percent=product.gst,
                total=total
            )
            
            subtotal += base_price
            gst_total += gst
            grand_total += total
            
        order.subtotal = subtotal
        order.gst_total = gst_total
        order.grand_total = grand_total
        order.save()
        
        serializer = self.get_serializer(order)
        broadcast_erp_event(
            event_type='order.created',
            payload=serializer.data,
            target_roles=['Admin'],
            target_user_ids=[str(order.dealer_id), str(order.created_by_id) if order.created_by_id else None]
        )
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        if request.user.role not in [UserRole.SUPER_ADMIN, UserRole.ADMIN]:
            return Response({"error": "Unauthorized. Only Admin can approve orders."}, status=status.HTTP_403_FORBIDDEN)
            
        order = self.get_object()
        if order.status not in [OrderStatus.PENDING_APPROVAL, OrderStatus.DRAFT, OrderStatus.SUBMITTED]:
            return Response({"error": f"Can only approve orders in Pending Approval status. Current: {order.status}"}, status=status.HTTP_400_BAD_REQUEST)
            
        # Validate that every ordered product is still available
        unavailable_products = []
        for item in order.items.all():
            product = item.product
            if not product.is_available:
                unavailable_products.append(f"{product.name} ({product.status})")

        if unavailable_products:
            return Response({
                "error": f"Cannot approve order: The following product(s) are currently Unavailable: {', '.join(unavailable_products)}. Please resolve product availability before approval.",
                "unavailable_products": unavailable_products
            }, status=status.HTTP_400_BAD_REQUEST)
            
        order.status = OrderStatus.APPROVED
        order.save()

        from .models import OrderTimeline
        OrderTimeline.objects.create(
            order=order,
            status=OrderStatus.APPROVED,
            remarks="Order approved by Admin",
            created_by=request.user
        )

        broadcast_erp_event(
            event_type='order.approved',
            payload={
                "id": str(order.id),
                "order_id": str(order.id),
                "order_number": order.order_number,
                "status": order.status,
                "dealer_id": str(order.dealer_id),
                "created_by_id": str(order.created_by_id) if order.created_by_id else None
            },
            target_roles=['Admin', 'Distributor'],
            target_user_ids=[str(order.dealer_id), str(order.created_by_id) if order.created_by_id else None]
        )

        return Response({"message": "Order approved successfully.", "status": order.status})

    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        if request.user.role not in [UserRole.SUPER_ADMIN, UserRole.ADMIN]:
            return Response({"error": "Unauthorized. Only Admin can reject orders."}, status=status.HTTP_403_FORBIDDEN)
            
        order = self.get_object()
        if order.status != OrderStatus.PENDING_APPROVAL:
            return Response({"error": f"Can only reject Pending Approval orders. Current: {order.status}"}, status=status.HTTP_400_BAD_REQUEST)
            
        order.status = OrderStatus.REJECTED
        order.save()

        from .models import OrderTimeline
        OrderTimeline.objects.create(
            order=order,
            status=OrderStatus.REJECTED,
            remarks=request.data.get('remarks', 'Order rejected by Admin'),
            created_by=request.user
        )

        broadcast_erp_event(
            event_type='order.updated',
            payload={
                "order_id": str(order.id),
                "order_number": order.order_number,
                "status": order.status,
                "dealer_id": str(order.dealer_id),
                "created_by_id": str(order.created_by_id) if order.created_by_id else None
            },
            target_roles=['Admin'],
            target_user_ids=[str(order.dealer_id), str(order.created_by_id) if order.created_by_id else None]
        )

        return Response({"message": "Order rejected by Admin.", "status": order.status})

    @action(detail=True, methods=['post'])
    def upload_bilty(self, request, pk=None):
        if request.user.role not in [UserRole.SUPER_ADMIN, UserRole.ADMIN]:
            return Response({"error": "Unauthorized. Only Admin can generate/upload Bilty."}, status=status.HTTP_403_FORBIDDEN)
            
        order = self.get_object()
        if order.status not in [OrderStatus.APPROVED, OrderStatus.BILTY_UPLOADED, OrderStatus.READY_DISPATCH]:
            return Response({"error": f"Bilty can only be generated for Approved orders (Current status: {order.status})."}, status=status.HTTP_400_BAD_REQUEST)
            
        from django.utils import timezone
        order.bilty_number = request.data.get('bilty_number', order.bilty_number or f"BILTY-{order.order_number}")
        if 'bilty_pdf' in request.FILES:
            order.bilty_pdf = request.FILES['bilty_pdf']
        order.bilty_date = timezone.now()
        order.bilty_uploaded_by = request.user
        # Admin generates Bilty -> order becomes BILTY_UPLOADED
        order.status = OrderStatus.BILTY_UPLOADED
        order.save()

        from .models import OrderTimeline
        OrderTimeline.objects.create(
            order=order,
            status=OrderStatus.BILTY_UPLOADED,
            remarks=f"Admin Bilty generated: {order.bilty_number}. Office stage complete.",
            created_by=request.user
        )

        broadcast_erp_event(
            event_type='order.bilty_created',
            payload={
                "id": str(order.id),
                "order_id": str(order.id),
                "order_number": order.order_number,
                "bilty_number": order.bilty_number,
                "status": order.status,
                "dealer_id": str(order.dealer_id),
                "created_by_id": str(order.created_by_id) if order.created_by_id else None
            },
            target_roles=['Admin', 'Warehouse'],
            target_user_ids=[str(order.dealer_id), str(order.created_by_id) if order.created_by_id else None]
        )

        return Response({
            "message": "Bilty generated successfully. Order is now Ready to Dispatch.",
            "status": order.status,
            "bilty_number": order.bilty_number
        })

    @action(detail=True, methods=['post'])
    def generate_bilty(self, request, pk=None):
        return self.upload_bilty(request, pk)

    @action(detail=True, methods=['post'])
    def mark_ready_dispatch(self, request, pk=None):
        if request.user.role not in [UserRole.SUPER_ADMIN, UserRole.ADMIN]:
            return Response({"error": "Unauthorized. Only Admin can set Ready to Dispatch."}, status=status.HTTP_403_FORBIDDEN)
            
        order = self.get_object()
        order.status = OrderStatus.READY_DISPATCH
        order.save()

        from .models import OrderTimeline
        OrderTimeline.objects.create(
            order=order,
            status=OrderStatus.READY_DISPATCH,
            remarks="Order marked Ready to Dispatch by Admin",
            created_by=request.user
        )

        return Response({"message": "Order is now Ready to Dispatch for Warehouse.", "status": order.status})

    @action(detail=True, methods=['post'])
    def generate_lr(self, request, pk=None):
        if request.user.role not in [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.WAREHOUSE]:
            return Response({"error": "Unauthorized. Only Warehouse or Admin can generate LR."}, status=status.HTTP_403_FORBIDDEN)
            
        order = self.get_object()
        
        # LOCKED CHECK: LR Generation is locked before Ready to Dispatch stage!
        if order.status != OrderStatus.READY_DISPATCH:
            return Response({
                "error": f"LR Generation is LOCKED! Order must be in 'Ready to Dispatch' status (Current: {order.status})."
            }, status=status.HTTP_400_BAD_REQUEST)
            
        from django.utils import timezone
        order.lr_number = request.data.get('lr_number', order.lr_number or f"LR-{order.order_number}")
        order.transport_details = request.data.get('transport_details', order.transport_details or 'Standard Logistics')
        order.vehicle_number = request.data.get('vehicle_number', order.vehicle_number or '')
        if 'lr_receipt_upload' in request.FILES:
            order.lr_receipt_upload = request.FILES['lr_receipt_upload']
            
        order.lr_date = timezone.now()
        order.lr_generated_by = request.user
        # STRICT BUSINESS RULE: LR creation/upload MUST NOT automatically dispatch the order!
        order.status = OrderStatus.READY_DISPATCH
        order.save()
        
        from .models import OrderTimeline
        OrderTimeline.objects.create(
            order=order,
            status=OrderStatus.READY_DISPATCH,
            remarks=f"Warehouse LR Generated: {order.lr_number} via {order.transport_details} (Vehicle: {order.vehicle_number}). Awaiting authorized dispatch.",
            created_by=request.user
        )
        
        broadcast_erp_event(
            event_type='order.lr_created',
            payload={
                "id": str(order.id),
                "order_id": str(order.id),
                "order_number": order.order_number,
                "lr_number": order.lr_number,
                "status": order.status,
                "transport_details": order.transport_details,
                "vehicle_number": order.vehicle_number,
                "dealer_id": str(order.dealer_id),
                "created_by_id": str(order.created_by_id) if order.created_by_id else None
            },
            target_roles=['Admin', 'Warehouse', 'Distributor'],
            target_user_ids=[str(order.dealer_id), str(order.created_by_id) if order.created_by_id else None]
        )

        from apps.notifications.services import notify_roles, notify_user
        from apps.notifications.models import NotificationType
        notify_roles(
            roles=['Admin', 'Warehouse'],
            title="LR Saved",
            message=f"LR #{order.lr_number} generated for Order #{order.order_number} via {order.transport_details}. Status remains Ready to Dispatch.",
            type=NotificationType.DISPATCH,
            event_type='order.lr_saved',
            reference_id=str(order.id),
            reference_type='order',
            destination='dispatch'
        )
        if order.dealer:
            notify_user(
                user=order.dealer,
                title="LR Generated",
                message=f"LR #{order.lr_number} generated for your order #{order.order_number} via {order.transport_details}.",
                type=NotificationType.DISPATCH,
                event_type='order.lr_saved',
                reference_id=str(order.id),
                reference_type='order',
                destination='orders'
            )

        return Response({
            "message": "LR Generated successfully. Ready for final authorized dispatch.",
            "status": order.status,
            "lr_number": order.lr_number,
            "transport_details": order.transport_details,
            "vehicle_number": order.vehicle_number
        })

    @action(detail=True, methods=['post'])
    def dispatch_details(self, request, pk=None):
        return self.generate_lr(request, pk)

    @action(detail=True, methods=['post'])
    def dispatch_order(self, request, pk=None):
        if request.user.role not in [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.WAREHOUSE]:
            return Response({"error": "Unauthorized. Only Warehouse or Admin can perform order dispatch."}, status=status.HTTP_403_FORBIDDEN)
            
        order = self.get_object()
        if order.status != OrderStatus.READY_DISPATCH:
            return Response({"error": f"Order cannot be dispatched. Status must be 'Ready to Dispatch' (Current: {order.status})."}, status=status.HTTP_400_BAD_REQUEST)
            
        lr_num = request.data.get('lr_number') or order.lr_number
        if not lr_num:
            return Response({"error": "Cannot dispatch order without LR details. Please generate LR first."}, status=status.HTTP_400_BAD_REQUEST)
            
        if request.data.get('lr_number'):
            order.lr_number = request.data.get('lr_number')
        if request.data.get('transport_details'):
            order.transport_details = request.data.get('transport_details')
        if request.data.get('vehicle_number'):
            order.vehicle_number = request.data.get('vehicle_number')
        if 'lr_receipt_upload' in request.FILES:
            order.lr_receipt_upload = request.FILES['lr_receipt_upload']

        order.status = OrderStatus.DISPATCHED
        order.save()
        
        from .models import OrderTimeline
        OrderTimeline.objects.create(
            order=order,
            status=OrderStatus.DISPATCHED,
            remarks=f"Order Dispatched by {request.user.role} ({request.user.username}) with LR: {order.lr_number}",
            created_by=request.user
        )
        
        broadcast_erp_event(
            event_type='order.dispatched',
            payload={
                "id": str(order.id),
                "order_id": str(order.id),
                "order_number": order.order_number,
                "lr_number": order.lr_number,
                "status": order.status,
                "dealer_id": str(order.dealer_id),
                "created_by_id": str(order.created_by_id) if order.created_by_id else None
            },
            target_roles=['Admin', 'Warehouse', 'Distributor'],
            target_user_ids=[str(order.dealer_id), str(order.created_by_id) if order.created_by_id else None]
        )

        return Response({
            "message": "Order successfully marked as Dispatched.",
            "status": order.status,
            "lr_number": order.lr_number
        })

    @action(detail=True, methods=['post'], url_path='dispatch')
    def perform_dispatch(self, request, pk=None):
        return self.dispatch_order(request, pk)

    @action(detail=True, methods=['post'])
    def update_status(self, request, pk=None):
        new_status = request.data.get('status')
        if not new_status:
            return Response({"error": "Missing status parameter."}, status=status.HTTP_400_BAD_REQUEST)
        if new_status == OrderStatus.APPROVED:
            return self.approve(request, pk)
        elif new_status == OrderStatus.REJECTED:
            return self.reject(request, pk)
        elif new_status in [OrderStatus.READY_DISPATCH, 'Ready Dispatch', OrderStatus.BILTY_UPLOADED]:
            return self.upload_bilty(request, pk)
        elif new_status == OrderStatus.DISPATCHED:
            return self.dispatch_order(request, pk)
        else:
            return Response({"error": f"Unsupported or restricted status transition to '{new_status}'."}, status=status.HTTP_400_BAD_REQUEST)
        
    @action(detail=True, methods=['get'])
    def timeline(self, request, pk=None):
        order = self.get_object()
        from .models import OrderTimeline
        from .serializers import OrderTimelineSerializer
        timeline = OrderTimeline.objects.filter(order=order).order_by('-created_at')
        return Response(OrderTimelineSerializer(timeline, many=True).data)

from .models import Invoice
from .serializers import InvoiceSerializer

class InvoiceViewSet(viewsets.ModelViewSet):
    serializer_class = InvoiceSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        user = self.request.user
        if user.role in [UserRole.SUPER_ADMIN, UserRole.ADMIN]:
            return Invoice.objects.all().order_by('-generated_at')
        elif user.role in [UserRole.DISTRIBUTOR, UserRole.DEALER]:
            return Invoice.objects.filter(order__dealer=user).order_by('-generated_at')
        return Invoice.objects.none()
        
    @action(detail=True, methods=['get'])
    def generate_pdf(self, request, pk=None):
        invoice = self.get_object()
        # In a real app, you would use reportlab, weasyprint or xhtml2pdf here.
        # For now, we will return a mock URL or base64 structure.
        return Response({
            "message": "PDF generated",
            "invoice_number": invoice.invoice_number,
            "download_url": f"/media/invoices/{invoice.invoice_number}.pdf"
        })
