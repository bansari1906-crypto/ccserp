from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.parsers import MultiPartParser, FormParser
from django.utils import timezone
from django.db.models import Count, Sum
from datetime import timedelta

from ..models import User, UserStatus, UserRole, KYCProfile, KYCStatus, LoginHistory
from ..services import AdminService
from apps.orders.models import Order, OrderStatus
from apps.hr.models import Attendance, Expense

class IsAdminUser:
    """Custom permission check for Admin/Super Admin"""
    @staticmethod
    def has_permission(request):
        return request.user.is_authenticated and request.user.role in [UserRole.ADMIN, UserRole.SUPER_ADMIN]

class DashboardStatsView(APIView):
    def get(self, request):
        if not IsAdminUser.has_permission(request):
            return Response({"error": "Unauthorized"}, status=status.HTTP_403_FORBIDDEN)
            
        today = timezone.now().date()
        
        # User Stats
        total_dealers = User.objects.filter(role=UserRole.DEALER, status=UserStatus.APPROVED).count()
        total_distributors = User.objects.filter(role=UserRole.DISTRIBUTOR, status=UserStatus.APPROVED).count()
        total_employees = User.objects.filter(role=UserRole.EMPLOYEE, status=UserStatus.APPROVED).count()
        pending_registrations = User.objects.filter(status=UserStatus.PENDING).count()
        
        # Order Stats
        total_orders = Order.objects.count()
        today_orders = Order.objects.filter(created_at__date=today).count()
        
        # HR Stats
        attendance_today = Attendance.objects.filter(date=today, status='Present').count()
        expenses_today_agg = Expense.objects.filter(date=today).aggregate(Sum('amount'))
        expenses_today = expenses_today_agg['amount__sum'] or 0.00
        
        # Basic Graph Data (Mocked for 7 days based on real data if any)
        sales_graph = []
        for i in range(6, -1, -1):
            d = today - timedelta(days=i)
            day_orders = Order.objects.filter(created_at__date=d).count()
            sales_graph.append({'name': d.strftime('%a'), 'orders': day_orders})
            
        return Response({
            "total_dealers": total_dealers,
            "total_distributors": total_distributors,
            "total_employees": total_employees,
            "pending_registrations": pending_registrations,
            "total_orders": total_orders,
            "today_orders": today_orders,
            "attendance_today": attendance_today,
            "expenses_today": expenses_today,
            "sales_graph": sales_graph
        })

class ApprovalsListView(APIView):
    def get(self, request):
        if not IsAdminUser.has_permission(request):
            return Response({"error": "Unauthorized"}, status=status.HTTP_403_FORBIDDEN)
            
        role = request.query_params.get('role', None)
        qs = User.objects.filter(status=UserStatus.PENDING)
        if role:
            qs = qs.filter(role=role)
            
        data = []
        for user in qs.select_related('kyc_profile'):
            item = {
                "id": user.id,
                "email": user.email,
                "username": user.username,
                "phone": user.phone,
                "role": user.role,
                "created_at": user.created_at,
                "kyc_status": user.kyc_profile.kyc_status if hasattr(user, 'kyc_profile') else 'None'
            }
            data.append(item)
            
        return Response(data)

class ApprovalActionView(APIView):
    def post(self, request, user_id, action):
        if not IsAdminUser.has_permission(request):
            return Response({"error": "Unauthorized"}, status=status.HTTP_403_FORBIDDEN)
            
        try:
            user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            return Response({"error": "User not found"}, status=status.HTTP_404_NOT_FOUND)
            
        if action == 'approve':
            credit_limit = float(request.data.get('credit_limit', 0.0))
            AdminService.approve_user(user, credit_limit=credit_limit)
            return Response({"message": f"User {user.email} approved successfully."})
        elif action == 'reject':
            AdminService.reject_user(user)
            return Response({"message": f"User {user.email} rejected."})
        elif action == 'suspend':
            AdminService.suspend_user(user)
            return Response({"message": f"User {user.email} suspended."})
            
        return Response({"error": "Invalid action"}, status=status.HTTP_400_BAD_REQUEST)

class UserManagementListView(APIView):
    def get(self, request):
        if not IsAdminUser.has_permission(request):
            return Response({"error": "Unauthorized"}, status=status.HTTP_403_FORBIDDEN)
            
        qs = User.objects.all().order_by('-created_at')
        from ..serializers import UserSerializer
        return Response(UserSerializer(qs, many=True).data)

    def post(self, request):
        if not IsAdminUser.has_permission(request):
            return Response({"error": "Unauthorized"}, status=status.HTTP_403_FORBIDDEN)
            
        from ..services import AuthService
        from ..models import UserRole, DistributorProfile, EmployeeProfile
        
        email = request.data.get('email')
        username = request.data.get('username')
        password = request.data.get('password', 'ccs12345') # Default password
        phone = request.data.get('phone', '')
        raw_role = request.data.get('role', 'Employee').upper()
        role_map = {
            'ADMIN': UserRole.ADMIN,
            'EMPLOYEE': UserRole.EMPLOYEE,
            'DISTRIBUTOR': UserRole.DISTRIBUTOR,
            'WAREHOUSE': UserRole.WAREHOUSE,
        }
        if raw_role not in role_map:
            return Response(
                {"error": f"Invalid role '{raw_role}'. Allowed roles are: ADMIN, EMPLOYEE, DISTRIBUTOR, WAREHOUSE. (Dealer role is discontinued)"},
                status=status.HTTP_400_BAD_REQUEST
            )
        role = role_map[raw_role]
        
        name = request.data.get('name', '').strip()
        first_name = name
        last_name = ''
        if ' ' in name:
            parts = name.split(' ', 1)
            first_name, last_name = parts[0], parts[1]

        email = request.data.get('email')
        if not email:
            email = f"{username.lower()}@chitracropscience.com"

        try:
            user = User.objects.create(
                username=username,
                email=email,
                first_name=first_name,
                last_name=last_name,
                phone=phone,
                role=role,
                status=UserStatus.APPROVED,
                is_active=request.data.get('is_active', True),
                is_verified=True,
                is_staff=(role == UserRole.ADMIN),
                is_superuser=(role == UserRole.ADMIN),
                joining_date=request.data.get('joining_date')
            )
            user.set_password(password)
            user.save()
            
            # Update Profiles
            from ..models import KYCProfile
            KYCProfile.objects.get_or_create(user=user)

            if role == UserRole.DISTRIBUTOR:
                profile, _ = DistributorProfile.objects.get_or_create(user=user)
                profile.company_name = name or username
                profile.state = request.data.get('state')
                profile.district = request.data.get('district')
                profile.territory = request.data.get('territory')
                profile.monthly_sales_plan = request.data.get('monthly_sales_plan', 0.00) or 0.00
                profile.monthly_collection_plan = request.data.get('monthly_collection_plan', 0.00) or 0.00
                profile.save()
            elif role == UserRole.EMPLOYEE:
                profile, _ = EmployeeProfile.objects.get_or_create(user=user)
                profile.designation = request.data.get('designation', 'Field Executive')
                profile.state = request.data.get('state')
                profile.district = request.data.get('district')
                profile.territory = request.data.get('territory')
                profile.monthly_sales_plan = request.data.get('monthly_sales_plan', 0.00) or 0.00
                profile.monthly_collection_plan = request.data.get('monthly_collection_plan', 0.00) or 0.00
                profile.save()
            elif role == UserRole.ADMIN:
                from ..models import AdminProfile
                AdminProfile.objects.get_or_create(user=user)
                
            from ..serializers import UserSerializer
            return Response(UserSerializer(user).data, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

class UserManagementDetailView(APIView):
    def get(self, request, user_id=None, pk=None):
        if not IsAdminUser.has_permission(request):
            return Response({"error": "Unauthorized"}, status=status.HTTP_403_FORBIDDEN)
            
        uid = user_id or pk
        try:
            user = User.objects.get(id=uid)
        except User.DoesNotExist:
            return Response({"error": "User not found"}, status=status.HTTP_404_NOT_FOUND)
            
        from ..serializers import UserSerializer
        return Response(UserSerializer(user).data)
        
    def put(self, request, user_id=None, pk=None):
        if not IsAdminUser.has_permission(request):
            return Response({"error": "Unauthorized"}, status=status.HTTP_403_FORBIDDEN)
            
        uid = user_id or pk
        try:
            user = User.objects.get(id=uid)
        except User.DoesNotExist:
            return Response({"error": "User not found"}, status=status.HTTP_404_NOT_FOUND)
            
        # Basic update
        user.phone = request.data.get('phone', user.phone)
        user.is_active = request.data.get('is_active', user.is_active)
        user.joining_date = request.data.get('joining_date', user.joining_date)
        
        # Admin assigned KM rate for employee travel reimbursement
        if 'km_rate' in request.data and request.data['km_rate'] is not None:
            try:
                user.km_rate = float(request.data['km_rate'])
            except (ValueError, TypeError):
                pass

        if 'role' in request.data:
            user.role = request.data['role']
            
        if 'password' in request.data and request.data['password']:
            user.set_password(request.data['password'])
            
        user.save()
        
        from ..models import UserRole, DistributorProfile, EmployeeProfile
        
        # Update Profiles
        if user.role == UserRole.DISTRIBUTOR:
            profile, _ = DistributorProfile.objects.get_or_create(user=user)
            profile.state = request.data.get('state', profile.state)
            profile.district = request.data.get('district', profile.district)
            profile.territory = request.data.get('territory', profile.territory)
            if 'monthly_sales_plan' in request.data:
                profile.monthly_sales_plan = request.data.get('monthly_sales_plan') or 0.00
            if 'monthly_collection_plan' in request.data:
                profile.monthly_collection_plan = request.data.get('monthly_collection_plan') or 0.00
            profile.save()
        elif user.role in ['Employee', 'EMPLOYEE']:
            profile, _ = EmployeeProfile.objects.get_or_create(user=user)
            profile.state = request.data.get('state', profile.state)
            profile.district = request.data.get('district', profile.district)
            profile.territory = request.data.get('territory', profile.territory)
            if 'monthly_sales_plan' in request.data:
                profile.monthly_sales_plan = request.data.get('monthly_sales_plan') or 0.00
            if 'monthly_collection_plan' in request.data:
                profile.monthly_collection_plan = request.data.get('monthly_collection_plan') or 0.00
            profile.save()
            
        return Response({"message": "User updated successfully."})
        
    def delete(self, request, user_id):
        if not IsAdminUser.has_permission(request):
            return Response({"error": "Unauthorized"}, status=status.HTTP_403_FORBIDDEN)
            
        try:
            user = User.objects.get(id=user_id)
            user.delete()
            return Response({"message": "User deleted successfully."})
        except User.DoesNotExist:
            return Response({"error": "User not found"}, status=status.HTTP_404_NOT_FOUND)

class ApprovalDetailView(APIView):
    def get(self, request, user_id):
        if not IsAdminUser.has_permission(request):
            return Response({"error": "Unauthorized"}, status=status.HTTP_403_FORBIDDEN)
            
        try:
            user = User.objects.select_related('kyc_profile', 'dealer_profile', 'distributor_profile', 'employee_profile').get(id=user_id)
        except User.DoesNotExist:
            return Response({"error": "User not found"}, status=status.HTTP_404_NOT_FOUND)
            
        kyc = getattr(user, 'kyc_profile', None)
        profile_data = {}
        if user.role == UserRole.DEALER and hasattr(user, 'dealer_profile'):
            profile_data = {"company_name": user.dealer_profile.company_name}
            
        data = {
            "id": user.id,
            "email": user.email,
            "username": user.username,
            "phone": user.phone,
            "role": user.role,
            "status": user.status,
            "profile": profile_data,
            "kyc": {
                "status": kyc.kyc_status if kyc else None,
                "aadhaar": kyc.aadhaar_file.url if kyc and kyc.aadhaar_file else None,
                "pan": kyc.pan_file.url if kyc and kyc.pan_file else None,
                "gst": kyc.gst_file.url if kyc and kyc.gst_file else None,
                "shop_photo": kyc.shop_photo.url if kyc and kyc.shop_photo else None,
                "profile_photo": kyc.profile_photo.url if kyc and kyc.profile_photo else None,
            }
        }
        return Response(data)
