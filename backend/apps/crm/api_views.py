from decimal import Decimal
from rest_framework import viewsets, permissions, status
from rest_framework.response import Response
from django.db.models import Count, Sum
from apps.accounts.models import User, UserRole, UserStatus, DealerProfile, DistributorProfile
from apps.orders.models import Order
from .models import Lead, Quotation, FollowUp
from .serializers import LeadSerializer, QuotationSerializer, FollowUpSerializer

class LeadViewSet(viewsets.ModelViewSet):
    queryset = Lead.objects.all().order_by('-created_at')
    serializer_class = LeadSerializer
    permission_classes = [permissions.IsAuthenticated]

class QuotationViewSet(viewsets.ModelViewSet):
    queryset = Quotation.objects.all().order_by('-created_at')
    serializer_class = QuotationSerializer
    permission_classes = [permissions.IsAuthenticated]

class FollowUpViewSet(viewsets.ModelViewSet):
    queryset = FollowUp.objects.all().order_by('-followup_date')
    serializer_class = FollowUpSerializer
    permission_classes = [permissions.IsAuthenticated]

class DealerViewSet(viewsets.ViewSet):
    permission_classes = [permissions.IsAuthenticated]

    def list(self, request):
        users = User.objects.filter(role__in=[UserRole.DISTRIBUTOR, UserRole.DEALER]).select_related('dealer_profile')
        results = []
        for user in users:
            dp = getattr(user, 'dealer_profile', None)
            orders_qs = Order.objects.filter(dealer=user)
            total_sales_agg = orders_qs.aggregate(Sum('grand_total'))['grand_total__sum'] or 0.0
            last_order = orders_qs.order_by('-created_at').first()
            
            results.append({
                "id": str(user.id),
                "dealer_code": user.ccs_id or f"DLR-{user.id}",
                "code": user.ccs_id or f"DLR-{user.id}",
                "company_name": dp.company_name if (dp and dp.company_name) else (user.username or 'Distributor'),
                "name": dp.company_name if (dp and dp.company_name) else (user.username or 'Distributor'),
                "contact_person": f"{user.first_name} {user.last_name}".strip() or user.username,
                "phone": user.phone or '',
                "email": user.email,
                "city": dp.city if dp else '',
                "district": dp.district if dp else '',
                "state": dp.state if dp else '',
                "address": dp.address if dp else '',
                "gstin": getattr(dp, 'gstin', '27AAAAA0000A1Z5') if dp else '',
                "pan": getattr(dp, 'pan', 'ABCDE1234F') if dp else '',
                "credit_limit": float(dp.credit_limit) if dp else 500000.0,
                "outstanding_balance": float(dp.outstanding_balance) if dp else 0.0,
                "is_active": user.is_active and user.status == UserStatus.APPROVED,
                "status": "Active" if (user.is_active and user.status == UserStatus.APPROVED) else "Inactive",
                "last_order_date": last_order.created_at.strftime('%Y-%m-%d') if last_order else '',
                "orders_count": orders_qs.count(),
                "total_sales": float(total_sales_agg),
                "loyalty_points": dp.loyalty_points if dp else 0,
            })
        return Response(results)

    def retrieve(self, request, pk=None):
        try:
            user = User.objects.get(id=pk, role__in=[UserRole.DISTRIBUTOR, UserRole.DEALER])
        except (User.DoesNotExist, ValueError):
            return Response({"error": "Distributor not found"}, status=status.HTTP_404_NOT_FOUND)
            
        dp = getattr(user, 'dealer_profile', None)
        orders_qs = Order.objects.filter(dealer=user)
        total_sales_agg = orders_qs.aggregate(Sum('grand_total'))['grand_total__sum'] or 0.0
        last_order = orders_qs.order_by('-created_at').first()
        
        return Response({
            "id": str(user.id),
            "dealer_code": user.ccs_id or f"DLR-{user.id}",
            "code": user.ccs_id or f"DLR-{user.id}",
            "company_name": dp.company_name if (dp and dp.company_name) else (user.username or 'Dealer'),
            "name": dp.company_name if (dp and dp.company_name) else (user.username or 'Dealer'),
            "contact_person": f"{user.first_name} {user.last_name}".strip() or user.username,
            "phone": user.phone or '',
            "email": user.email,
            "city": dp.city if dp else '',
            "district": dp.district if dp else '',
            "state": dp.state if dp else '',
            "address": dp.address if dp else '',
            "gstin": getattr(dp, 'gstin', '27AAAAA0000A1Z5') if dp else '',
            "pan": getattr(dp, 'pan', 'ABCDE1234F') if dp else '',
            "credit_limit": float(dp.credit_limit) if dp else 500000.0,
            "outstanding_balance": float(dp.outstanding_balance) if dp else 0.0,
            "is_active": user.is_active and user.status == UserStatus.APPROVED,
            "status": "Active" if (user.is_active and user.status == UserStatus.APPROVED) else "Inactive",
            "last_order_date": last_order.created_at.strftime('%Y-%m-%d') if last_order else '',
            "orders_count": orders_qs.count(),
            "total_sales": float(total_sales_agg),
            "loyalty_points": dp.loyalty_points if dp else 0,
        })

    def create(self, request):
        data = request.data
        email = data.get('email')
        company_name = data.get('company_name', data.get('name', ''))
        contact_person = data.get('contact_person', data.get('ownerName', ''))
        phone = data.get('phone', '')
        
        # Enforce that only Admins can create or specify credit limits
        if 'credit_limit' in data:
            user_role = getattr(request.user, 'role', '')
            if user_role not in [UserRole.SUPER_ADMIN, UserRole.ADMIN, 'Admin', 'Super Admin']:
                return Response(
                    {"error": "Permission denied: Only administrators can create or set distributor credit limits."},
                    status=status.HTTP_403_FORBIDDEN
                )

        if not email:
            email = f"dealer_{User.objects.count() + 1}@ccs.com"
            
        username = email.split('@')[0]
        user, created = User.objects.get_or_create(
            email=email,
            defaults={
                'username': username,
                'role': UserRole.DEALER,
                'status': UserStatus.APPROVED,
                'is_active': True,
                'phone': phone,
                'first_name': contact_person,
            }
        )
        if created:
            user.set_password("Ccs@12345")
            user.save()

        dp, _ = DealerProfile.objects.get_or_create(user=user)
        dp.company_name = company_name
        dp.city = data.get('city', dp.city)
        dp.state = data.get('state', dp.state)
        dp.address = data.get('address', dp.address)
        
        # Enforce: Non-admin cannot specify or create credit limits
        user_role = getattr(request.user, 'role', '')
        if 'credit_limit' in data:
            if user_role not in [UserRole.SUPER_ADMIN, UserRole.ADMIN, 'Admin', 'Super Admin']:
                return Response(
                    {"error": "Permission denied: Only administrators can create or configure distributor credit limits."},
                    status=status.HTTP_403_FORBIDDEN
                )
            dp.credit_limit = Decimal(str(data['credit_limit']))
            from apps.wallet.models import Wallet
            wallet, _ = Wallet.objects.get_or_create(dealer=user)
            wallet.credit_limit = dp.credit_limit
            wallet.save()
        elif created:
            dp.credit_limit = Decimal('0.00')

        dp.save()

        return Response({
            "id": str(user.id),
            "dealer_code": user.ccs_id or f"DLR-{user.id}",
            "code": user.ccs_id or f"DLR-{user.id}",
            "company_name": dp.company_name,
            "name": dp.company_name,
            "contact_person": contact_person,
            "phone": user.phone,
            "email": user.email,
            "city": dp.city,
            "state": dp.state,
            "address": dp.address,
            "credit_limit": float(dp.credit_limit),
            "outstanding_balance": float(dp.outstanding_balance),
            "is_active": True,
            "orders_count": 0,
            "total_sales": 0.0,
            "loyalty_points": dp.loyalty_points
        }, status=status.HTTP_201_CREATED)

    def update(self, request, pk=None):
        return self._handle_update(request, pk, partial=False)

    def partial_update(self, request, pk=None):
        return self._handle_update(request, pk, partial=True)

    def _handle_update(self, request, pk=None, partial=False):
        try:
            user = User.objects.get(id=pk, role__in=[UserRole.DEALER, UserRole.DISTRIBUTOR])
        except (User.DoesNotExist, ValueError):
            return Response({"error": "Distributor not found"}, status=status.HTTP_404_NOT_FOUND)

        data = request.data
        user_role = getattr(request.user, 'role', '')

        # Enforce: Non-admin cannot modify credit limit
        if 'credit_limit' in data:
            if user_role not in [UserRole.SUPER_ADMIN, UserRole.ADMIN, 'Admin', 'Super Admin']:
                return Response(
                    {"error": "Permission denied: Only administrators can modify distributor credit limits."},
                    status=status.HTTP_403_FORBIDDEN
                )

        dp, _ = DealerProfile.objects.get_or_create(user=user)

        if 'credit_limit' in data and user_role in [UserRole.SUPER_ADMIN, UserRole.ADMIN, 'Admin', 'Super Admin']:
            new_limit = Decimal(str(data['credit_limit']))
            dp.credit_limit = new_limit
            from apps.wallet.models import Wallet
            Wallet.objects.filter(dealer=user).update(credit_limit=new_limit)

        if 'company_name' in data:
            dp.company_name = data['company_name']
        if 'city' in data:
            dp.city = data['city']
        if 'state' in data:
            dp.state = data['state']
        if 'address' in data:
            dp.address = data['address']
        dp.save()

        return self.retrieve(request, pk=pk)

class DistributorViewSet(viewsets.ViewSet):
    permission_classes = [permissions.IsAuthenticated]

    def list(self, request):
        users = User.objects.filter(role=UserRole.DISTRIBUTOR).select_related('distributor_profile', 'employee_profile')
        results = []
        for user in users:
            dp = getattr(user, 'distributor_profile', None)
            ep = getattr(user, 'employee_profile', None)
            dealers_count = User.objects.filter(role=UserRole.DEALER).count() # Assigned or total
            orders_qs = Order.objects.filter(created_by=user)
            monthly_sales = orders_qs.aggregate(Sum('grand_total'))['grand_total__sum'] or 0.0

            company = (dp.company_name if dp and dp.company_name else None) or f"{user.first_name} {user.last_name}".strip() or user.username
            territory = (dp.territory if dp else None) or (ep.territory if ep else 'General Territory')

            results.append({
                "id": str(user.id),
                "code": user.ccs_id or f"DST-{user.id}",
                "company_name": company,
                "name": company,
                "contact_person": f"{user.first_name} {user.last_name}".strip() or user.username,
                "phone": user.phone or '',
                "email": user.email,
                "territory": territory,
                "city": dp.district if dp else (ep.district if ep else 'HQ'),
                "state": dp.state if dp else (ep.state if ep else 'State'),
                "dealers_count": dealers_count,
                "monthly_sales": float(monthly_sales),
                "outstanding_balance": 0.0,
                "km_rate": float(user.km_rate) if user.km_rate is not None else 5.0,
                "is_active": user.is_active and user.status == UserStatus.APPROVED,
                "status": "Active" if (user.is_active and user.status == UserStatus.APPROVED) else "Inactive"
            })
        return Response(results)

    def retrieve(self, request, pk=None):
        try:
            user = User.objects.get(id=pk, role=UserRole.DISTRIBUTOR)
        except (User.DoesNotExist, ValueError):
            return Response({"error": "Distributor not found"}, status=status.HTTP_404_NOT_FOUND)
            
        dp = getattr(user, 'distributor_profile', None)
        ep = getattr(user, 'employee_profile', None)
        dealers_count = User.objects.filter(role=UserRole.DEALER).count()
        orders_qs = Order.objects.filter(created_by=user)
        monthly_sales = orders_qs.aggregate(Sum('grand_total'))['grand_total__sum'] or 0.0

        company = (dp.company_name if dp and dp.company_name else None) or f"{user.first_name} {user.last_name}".strip() or user.username
        territory = (dp.territory if dp else None) or (ep.territory if ep else 'General Territory')

        return Response({
            "id": str(user.id),
            "code": user.ccs_id or f"DST-{user.id}",
            "company_name": company,
            "name": company,
            "contact_person": f"{user.first_name} {user.last_name}".strip() or user.username,
            "phone": user.phone or '',
            "email": user.email,
            "territory": territory,
            "city": dp.district if dp else (ep.district if ep else 'HQ'),
            "district": dp.district if dp else (ep.district if ep else 'HQ'),
            "state": dp.state if dp else (ep.state if ep else 'State'),
            "address": dp.address if hasattr(dp, 'address') else '',
            "dealers_count": dealers_count,
            "monthly_sales": float(monthly_sales),
            "monthly_sales_plan": float(dp.monthly_sales_plan if dp and dp.monthly_sales_plan else 0.0),
            "monthly_collection_plan": float(dp.monthly_collection_plan if dp and dp.monthly_collection_plan else 0.0),
            "outstanding_balance": 0.0,
            "credit_limit": float(dp.monthly_sales_plan if dp and dp.monthly_sales_plan else 500000.0),
            "km_rate": float(user.km_rate) if user.km_rate is not None else 5.0,
            "is_active": user.is_active and user.status == UserStatus.APPROVED,
            "status": "Active" if (user.is_active and user.status == UserStatus.APPROVED) else "Inactive"
        })

