from datetime import date, datetime, timedelta
from django.db.models import Sum, Count, Q
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from apps.accounts.models import User, UserRole
from apps.products.models import Product
from apps.orders.models import Order
from apps.hr.models import Attendance, DealerVisit, Expense, ExpenseStatus
from apps.orders.serializers import OrderSerializer
from apps.hr.serializers import AttendanceSerializer, ExpenseSerializer, DealerVisitSerializer

class DashboardAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        role = request.user.role
        
        if role in [UserRole.SUPER_ADMIN, UserRole.ADMIN]:
            return self.get_admin_dashboard()
        elif role == UserRole.DISTRIBUTOR:
            return self.get_employee_dashboard(request.user)
        elif role == UserRole.DEALER:
            return self.get_dealer_dashboard(request.user)
            
        return Response({"error": "Unknown role"}, status=400)

    def get_admin_dashboard(self):
        today = date.today()
        first_of_month = today.replace(day=1)
        
        # Cards
        total_dealers = User.objects.filter(role=UserRole.DEALER).count()
        total_employees = User.objects.filter(role=UserRole.DISTRIBUTOR).count()
        total_products = Product.objects.count()
        total_orders = Order.objects.count()
        pending_orders = Order.objects.filter(status='Pending').count()
        pending_registrations = User.objects.filter(is_active=False).count() # Approximating pending as inactive
        
        today_attendance = Attendance.objects.filter(date=today, check_in__isnull=False).count()
        
        expenses_today_agg = Expense.objects.filter(date=today).aggregate(t=Sum('amount'))['t']
        expenses_today = expenses_today_agg if expenses_today_agg else 0
        
        sales_today_agg = Order.objects.filter(created_at__date=today).aggregate(t=Sum('grand_total'))['t']
        sales_today = sales_today_agg if sales_today_agg else 0
        
        sales_monthly_agg = Order.objects.filter(created_at__gte=first_of_month).aggregate(t=Sum('grand_total'))['t']
        sales_monthly = sales_monthly_agg if sales_monthly_agg else 0
        
        # Tables (Recent 5)
        recent_orders = OrderSerializer(Order.objects.order_by('-created_at')[:5], many=True).data
        recent_attendance = AttendanceSerializer(Attendance.objects.order_by('-created_at')[:5], many=True).data
        recent_expenses = ExpenseSerializer(Expense.objects.order_by('-created_at')[:5], many=True).data
        
        # Simple Charts Data (Last 7 Days Sales)
        last_7_days = [today - timedelta(days=i) for i in range(6, -1, -1)]
        sales_chart = []
        for d in last_7_days:
            daily_total = Order.objects.filter(created_at__date=d).aggregate(t=Sum('grand_total'))['t'] or 0
            sales_chart.append({"name": d.strftime("%a"), "sales": daily_total})
            
        return Response({
            "cards": {
                "total_dealers": total_dealers,
                "total_employees": total_employees,
                "total_products": total_products,
                "total_orders": total_orders,
                "pending_orders": pending_orders,
                "pending_registrations": pending_registrations,
                "today_attendance": today_attendance,
                "today_expenses": expenses_today,
                "sales_today": sales_today,
                "sales_monthly": sales_monthly
            },
            "lists": {
                "recent_orders": recent_orders,
                "recent_attendance": recent_attendance,
                "recent_expenses": recent_expenses
            },
            "charts": {
                "sales": sales_chart
            }
        })

    def get_employee_dashboard(self, user):
        today = date.today()
        first_of_month = today.replace(day=1)
        
        attendance_today = Attendance.objects.filter(employee=user, date=today).first()
        is_checked_in = attendance_today and attendance_today.check_in is not None
        
        today_visits = DealerVisit.objects.filter(employee=user, date=today).count()
        today_orders = Order.objects.filter(created_by=user, created_at__date=today).count()
        pending_expenses = Expense.objects.filter(employee=user, status=ExpenseStatus.PENDING).count()
        monthly_orders_agg = Order.objects.filter(created_by=user, created_at__gte=first_of_month).aggregate(t=Sum('grand_total'))['t']
        monthly_orders = monthly_orders_agg if monthly_orders_agg else 0
        
        recent_orders = OrderSerializer(Order.objects.filter(created_by=user).order_by('-created_at')[:5], many=True).data
        recent_expenses = ExpenseSerializer(Expense.objects.filter(employee=user).order_by('-created_at')[:5], many=True).data
        today_visits_list = DealerVisitSerializer(DealerVisit.objects.filter(employee=user, date=today).order_by('-created_at'), many=True).data
        
        return Response({
            "cards": {
                "is_checked_in": is_checked_in,
                "today_visits": today_visits,
                "today_orders": today_orders,
                "pending_expenses": pending_expenses,
                "monthly_orders": monthly_orders
            },
            "lists": {
                "recent_orders": recent_orders,
                "recent_expenses": recent_expenses,
                "today_visits": today_visits_list
            }
        })

    def get_dealer_dashboard(self, user):
        total_orders = Order.objects.filter(dealer=user).count()
        pending_orders = Order.objects.filter(dealer=user, status='Pending').count()
        
        # Calculate outstanding (Orders that aren't cancelled or rejected. Assuming all approved/dispatched count as outstanding until paid - simple wallet abstraction)
        outstanding_agg = Order.objects.filter(
            dealer=user, 
            status__in=['Pending', 'Approved', 'Packed', 'Dispatched', 'Delivered']
        ).aggregate(t=Sum('grand_total'))['t']
        outstanding_amount = outstanding_agg if outstanding_agg else 0
        
        wallet_balance = 0 # Future module
        
        recent_orders = OrderSerializer(Order.objects.filter(dealer=user).order_by('-created_at')[:5], many=True).data
        
        from apps.products.serializers import ProductSerializer
        latest_products = ProductSerializer(Product.objects.filter(status='Active').order_by('-created_at')[:6], many=True).data
        
        return Response({
            "cards": {
                "total_orders": total_orders,
                "pending_orders": pending_orders,
                "wallet_balance": wallet_balance,
                "outstanding_amount": outstanding_amount
            },
            "lists": {
                "recent_orders": recent_orders,
                "latest_products": latest_products
            }
        })

from rest_framework import viewsets, permissions
from .models import CompanyProfile, AuditLog
from .serializers import CompanyProfileSerializer, AuditLogSerializer

class AuditLogViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = AuditLog.objects.all().order_by('-timestamp')
    serializer_class = AuditLogSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        user = self.request.user
        if user.role in [UserRole.SUPER_ADMIN, UserRole.ADMIN]:
            return super().get_queryset()
        return AuditLog.objects.filter(user=user).order_by('-timestamp')

class CompanyProfileViewSet(viewsets.ModelViewSet):
    serializer_class = CompanyProfileSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return CompanyProfile.objects.all()

    def get_permissions(self):
        if self.action in ['update', 'partial_update', 'create', 'destroy']:
            if self.request.user.role != UserRole.SUPER_ADMIN:
                return [permissions.IsAdminUser()]
        return super().get_permissions()

    def create(self, request, *args, **kwargs):
        if CompanyProfile.objects.exists():
            return Response({"error": "Profile already exists"}, status=400)
        return super().create(request, *args, **kwargs)


class HealthCheckView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        from django.db import connection
        db_ok = False
        try:
            with connection.cursor() as cursor:
                cursor.execute("SELECT 1")
                db_ok = bool(cursor.fetchone())
        except Exception:
            db_ok = False

        status_code = 200 if db_ok else 503
        return Response({
            "status": "healthy" if db_ok else "unhealthy",
            "database": "connected" if db_ok else "error",
            "service": "ccs-connect-erp"
        }, status=status_code)

