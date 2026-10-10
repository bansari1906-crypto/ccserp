import base64
import uuid
from datetime import datetime, date
from django.utils import timezone
from django.core.files.base import ContentFile
from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from apps.accounts.models import UserRole
from .models import Attendance, DealerVisit, Expense, ExpenseStatus, LocationTrack, DailyTourPlan
from .serializers import AttendanceSerializer, DealerVisitSerializer, ExpenseSerializer, LocationTrackSerializer, DailyTourPlanSerializer

def save_base64_image(image_data, prefix="attendance"):
    if not image_data or not isinstance(image_data, str):
        return None
    if "base64," in image_data:
        try:
            fmt, imgstr = image_data.split(";base64,")
            ext = fmt.split("/")[-1].lower()
            if ext == "jpeg":
                ext = "jpg"
            file_name = f"{prefix}_{uuid.uuid4().hex[:8]}.{ext}"
            return ContentFile(base64.b64decode(imgstr), name=file_name)
        except Exception:
            return None
    return None

class LocationTrackViewSet(viewsets.ModelViewSet):
    serializer_class = LocationTrackSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        user = self.request.user
        if user.role in [UserRole.SUPER_ADMIN, UserRole.ADMIN]:
            return LocationTrack.objects.all().order_by('-timestamp')
        return LocationTrack.objects.filter(employee=user).order_by('-timestamp')
        
    def perform_create(self, serializer):
        serializer.save(employee=self.request.user)

class DailyTourPlanViewSet(viewsets.ModelViewSet):
    serializer_class = DailyTourPlanSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ['status', 'date', 'employee']
    
    def get_queryset(self):
        user = self.request.user
        if user.role in [UserRole.SUPER_ADMIN, UserRole.ADMIN]:
            return DailyTourPlan.objects.all().order_by('-date', '-created_at')
        return DailyTourPlan.objects.filter(employee=user).order_by('-date', '-created_at')
        
    def perform_create(self, serializer):
        serializer.save(employee=self.request.user)

class HRBaseViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        if request.user.role == UserRole.DEALER:
            self.permission_denied(request, message="Dealers are not allowed to access HR modules.")

    def perform_create(self, serializer):
        serializer.save(employee=self.request.user)

class AttendanceViewSet(HRBaseViewSet):
    serializer_class = AttendanceSerializer
    filterset_fields = ['status', 'date', 'employee']

    def get_queryset(self):
        user = self.request.user
        qs = Attendance.objects.select_related('employee').order_by('-date', '-created_at')
        if user.role in [UserRole.SUPER_ADMIN, UserRole.ADMIN]:
            return qs
        return qs.filter(employee=user)

    def create(self, request, *args, **kwargs):
        # Prevent multiple attendances for the same day for an employee
        today = date.today()
        existing = Attendance.objects.filter(employee=request.user, date=today).first()
        if existing:
            return Response(
                {
                    "error": "Attendance already recorded for today.",
                    "already_recorded": True,
                    "attendance": AttendanceSerializer(existing).data
                },
                status=status.HTTP_400_BAD_REQUEST
            )
        
        check_in_location = request.data.get('check_in_location') or request.data.get('location') or 'Current Location'
        latitude = request.data.get('check_in_latitude') or request.data.get('latitude')
        longitude = request.data.get('check_in_longitude') or request.data.get('longitude')
        
        photo_raw = request.data.get('check_in_photo') or request.data.get('photo')
        back_photo_raw = request.data.get('back_camera_photo') or request.data.get('back_photo')
        
        photo_file = save_base64_image(photo_raw, prefix="checkin_front")
        back_photo_file = save_base64_image(back_photo_raw, prefix="checkin_back")
        
        # Support multipart file uploads directly if provided
        if not photo_file and 'check_in_photo' in request.FILES:
            photo_file = request.FILES['check_in_photo']
        elif not photo_file and 'photo' in request.FILES:
            photo_file = request.FILES['photo']
            
        if not back_photo_file and 'back_camera_photo' in request.FILES:
            back_photo_file = request.FILES['back_camera_photo']
        elif not back_photo_file and 'back_photo' in request.FILES:
            back_photo_file = request.FILES['back_photo']

        attendance = Attendance(
            employee=request.user,
            date=today,
            status='Working',
            check_in=datetime.now().time(),
            check_in_location=check_in_location,
            check_in_latitude=latitude if latitude not in [None, ''] else None,
            check_in_longitude=longitude if longitude not in [None, ''] else None,
            current_location=check_in_location,
            current_latitude=latitude if latitude not in [None, ''] else None,
            current_longitude=longitude if longitude not in [None, ''] else None,
            current_location_timestamp=timezone.now(),
            is_active=True
        )
        if photo_file:
            attendance.check_in_photo = photo_file
        if back_photo_file:
            attendance.back_camera_photo = back_photo_file
            
        attendance.save()

        # Record initial location track
        if latitude and longitude:
            try:
                LocationTrack.objects.create(
                    employee=request.user,
                    latitude=latitude,
                    longitude=longitude
                )
            except Exception:
                pass

        return Response(AttendanceSerializer(attendance).data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['get'])
    def active(self, request):
        today = date.today()
        attendance = Attendance.objects.filter(
            employee=request.user,
            date=today,
            check_out__isnull=True,
            is_active=True
        ).first()

        if attendance:
            return Response({
                "active": True,
                "attendance": AttendanceSerializer(attendance).data
            })
        
        # Check if already completed today
        completed = Attendance.objects.filter(employee=request.user, date=today).first()
        if completed:
            return Response({
                "active": False,
                "completed": True,
                "attendance": AttendanceSerializer(completed).data
            })

        return Response({"active": False, "completed": False, "attendance": None})

    @action(detail=False, methods=['post'])
    def update_location(self, request):
        today = date.today()
        attendance = Attendance.objects.filter(
            employee=request.user,
            date=today,
            check_out__isnull=True,
            is_active=True
        ).first()

        latitude = request.data.get('latitude')
        longitude = request.data.get('longitude')
        location = request.data.get('location')

        if attendance:
            if latitude not in [None, '']:
                attendance.current_latitude = latitude
            if longitude not in [None, '']:
                attendance.current_longitude = longitude
            if location:
                attendance.current_location = location
            attendance.current_location_timestamp = timezone.now()
            attendance.save()

        if latitude and longitude:
            try:
                LocationTrack.objects.create(
                    employee=request.user,
                    latitude=latitude,
                    longitude=longitude
                )
            except Exception:
                pass

        return Response({
            "status": "success",
            "current_location": attendance.current_location if attendance else location,
            "current_latitude": str(attendance.current_latitude) if attendance and attendance.current_latitude else str(latitude or ''),
            "current_longitude": str(attendance.current_longitude) if attendance and attendance.current_longitude else str(longitude or ''),
            "timestamp": timezone.now().isoformat()
        })

    @action(detail=False, methods=['post'])
    def check_out(self, request):
        today = date.today()
        attendance = Attendance.objects.filter(
            employee=request.user,
            date=today,
            check_out__isnull=True
        ).first()

        if not attendance:
            # Check if already checked out today
            completed = Attendance.objects.filter(employee=request.user, date=today).first()
            if completed and completed.check_out:
                return Response(
                    {"error": "Already checked out today.", "attendance": AttendanceSerializer(completed).data},
                    status=status.HTTP_400_BAD_REQUEST
                )
            return Response({"error": "No active check-in found for today."}, status=status.HTTP_400_BAD_REQUEST)

        attendance.check_out = datetime.now().time()
        
        location = request.data.get('check_out_location') or request.data.get('location')
        if location:
            attendance.check_out_location = location
            attendance.current_location = location

        latitude = request.data.get('check_out_latitude') or request.data.get('latitude')
        longitude = request.data.get('check_out_longitude') or request.data.get('longitude')
        if latitude not in [None, '']:
            attendance.check_out_latitude = latitude
            attendance.current_latitude = latitude
        if longitude not in [None, '']:
            attendance.check_out_longitude = longitude
            attendance.current_longitude = longitude
        
        photo_raw = request.data.get('check_out_photo') or request.data.get('photo')
        if photo_raw:
            photo_file = save_base64_image(photo_raw, prefix="checkout")
            if photo_file:
                attendance.check_out_photo = photo_file

        # Calculate working hours
        if attendance.check_in and attendance.check_out:
            td = datetime.combine(date.today(), attendance.check_out) - datetime.combine(date.today(), attendance.check_in)
            attendance.working_hours = max(round(td.total_seconds() / 3600.0, 2), 0.01)

        attendance.status = 'Present'
        attendance.is_active = False
        attendance.current_location_timestamp = timezone.now()
        attendance.save()

        # Log location track on checkout
        if latitude and longitude:
            try:
                LocationTrack.objects.create(
                    employee=request.user,
                    latitude=latitude,
                    longitude=longitude
                )
            except Exception:
                pass

        return Response(AttendanceSerializer(attendance).data)

class DealerVisitViewSet(HRBaseViewSet):
    serializer_class = DealerVisitSerializer
    filterset_fields = ['dealer', 'date', 'employee']

    def get_queryset(self):
        user = self.request.user
        qs = DealerVisit.objects.select_related('employee', 'dealer').order_by('-date', '-created_at')
        if user.role in [UserRole.SUPER_ADMIN, UserRole.ADMIN]:
            return qs
        return qs.filter(employee=user)

class ExpenseViewSet(HRBaseViewSet):
    serializer_class = ExpenseSerializer
    filterset_fields = ['status', 'category', 'date', 'employee']

    def get_queryset(self):
        user = self.request.user
        qs = Expense.objects.select_related('employee', 'approved_by').order_by('-date', '-created_at')
        if user.role in [UserRole.SUPER_ADMIN, UserRole.ADMIN]:
            return qs
        return qs.filter(employee=user)

    def perform_create(self, serializer):
        user = self.request.user
        starting_km = serializer.validated_data.get('starting_km')
        ending_km = serializer.validated_data.get('ending_km')

        # Use employee's current admin-assigned rate to preserve historical claims
        # Default to user's assigned km_rate (or 5.00)
        assigned_rate = user.km_rate if user.km_rate is not None else 5.00
        
        extra_kwargs = {'employee': user}

        if not serializer.validated_data.get('date'):
            extra_kwargs['date'] = timezone.now().date()

        km_amount = 0
        if starting_km is not None and ending_km is not None:
            if ending_km < starting_km:
                from rest_framework.exceptions import ValidationError
                raise ValidationError({"ending_km": "Ending KM cannot be less than Starting KM."})
            total_km = max(round(ending_km - starting_km, 2), 0)
            km_amount = round(total_km * assigned_rate, 2)
            extra_kwargs['total_km'] = total_km
            extra_kwargs['km_rate'] = assigned_rate
            extra_kwargs['km_amount'] = km_amount
        elif serializer.validated_data.get('km_rate') is None:
            extra_kwargs['km_rate'] = assigned_rate

        # If amount not explicitly passed or 0, auto-sum km_amount + breakdown fares
        if not serializer.validated_data.get('amount'):
            other_fares = sum([
                float(serializer.validated_data.get('bus_train_car_fair') or 0),
                float(serializer.validated_data.get('fair_cab') or 0),
                float(serializer.validated_data.get('fair_auto') or 0),
                float(serializer.validated_data.get('other_vehicle_fair') or 0),
                float(serializer.validated_data.get('food') or 0),
                float(serializer.validated_data.get('laundry') or 0),
                float(serializer.validated_data.get('phone_bill') or 0),
                float(serializer.validated_data.get('internet_bill') or 0),
                float(serializer.validated_data.get('local_conveyance') or 0),
                float(serializer.validated_data.get('courier') or 0),
                float(serializer.validated_data.get('photocopy') or 0),
                float(serializer.validated_data.get('other_charge') or 0),
            ])
            extra_kwargs['amount'] = round(float(km_amount) + other_fares, 2)

        serializer.save(**extra_kwargs)

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        if request.user.role not in [UserRole.SUPER_ADMIN, UserRole.ADMIN]:
            return Response({"error": "Unauthorized"}, status=status.HTTP_403_FORBIDDEN)
            
        expense = self.get_object()
        expense.status = ExpenseStatus.APPROVED
        expense.approved_by = request.user
        expense.save()
        return Response(ExpenseSerializer(expense).data)

    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        if request.user.role not in [UserRole.SUPER_ADMIN, UserRole.ADMIN]:
            return Response({"error": "Unauthorized"}, status=status.HTTP_403_FORBIDDEN)
            
        expense = self.get_object()
        expense.status = ExpenseStatus.REJECTED
        expense.approved_by = request.user
        expense.save()
        return Response(ExpenseSerializer(expense).data)
