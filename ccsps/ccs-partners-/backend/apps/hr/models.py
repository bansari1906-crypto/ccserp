import uuid
from django.db import models
from apps.accounts.models import User
from apps.orders.models import Order

class Attendance(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    employee = models.ForeignKey(User, on_delete=models.CASCADE, related_name='attendances')
    date = models.DateField(auto_now_add=True)
    status = models.CharField(max_length=20, default='Present')
    
    check_in = models.TimeField(null=True, blank=True)
    check_out = models.TimeField(null=True, blank=True)
    
    check_in_location = models.CharField(max_length=255, null=True, blank=True)
    check_in_latitude = models.DecimalField(max_digits=10, decimal_places=6, null=True, blank=True)
    check_in_longitude = models.DecimalField(max_digits=10, decimal_places=6, null=True, blank=True)
    
    check_out_location = models.CharField(max_length=255, null=True, blank=True)
    check_out_latitude = models.DecimalField(max_digits=10, decimal_places=6, null=True, blank=True)
    check_out_longitude = models.DecimalField(max_digits=10, decimal_places=6, null=True, blank=True)
    
    current_location = models.CharField(max_length=255, null=True, blank=True)
    current_latitude = models.DecimalField(max_digits=10, decimal_places=6, null=True, blank=True)
    current_longitude = models.DecimalField(max_digits=10, decimal_places=6, null=True, blank=True)
    current_location_timestamp = models.DateTimeField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    
    check_in_photo = models.ImageField(upload_to='attendance_photos/', null=True, blank=True)
    back_camera_photo = models.ImageField(upload_to='attendance_photos/', null=True, blank=True)
    check_out_photo = models.ImageField(upload_to='attendance_photos/', null=True, blank=True)
    
    working_hours = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    travel_time = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    
    # Advanced Tracking
    face_verified = models.BooleanField(default=False)
    geo_fence_status = models.CharField(max_length=50, default='Inside') # Inside, Outside
    distance_travelled = models.DecimalField(max_digits=7, decimal_places=2, null=True, blank=True)
    late_mark = models.BooleanField(default=False)
    
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.employee.email} - {self.date}"

class DealerVisit(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    employee = models.ForeignKey(User, on_delete=models.CASCADE, related_name='dealer_visits')
    dealer = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='visits_received')
    
    visit_type = models.CharField(max_length=50, default='Distributor') # Distributor, Farmer, New Onboard
    customer_name = models.CharField(max_length=255, blank=True, null=True)
    customer_mobile = models.CharField(max_length=20, blank=True, null=True)
    visit_purpose = models.CharField(max_length=150, blank=True, null=True)
    
    date = models.DateField(auto_now_add=True)
    start_time = models.TimeField(null=True, blank=True)
    end_time = models.TimeField(null=True, blank=True)
    location = models.CharField(max_length=255, null=True, blank=True)
    latitude = models.DecimalField(max_digits=10, decimal_places=6, null=True, blank=True)
    longitude = models.DecimalField(max_digits=10, decimal_places=6, null=True, blank=True)
    
    notes = models.TextField(blank=True, null=True)
    voice_note = models.FileField(upload_to='visit_voice_notes/', null=True, blank=True)
    products_discussed = models.TextField(blank=True, null=True)
    next_follow_up = models.DateField(null=True, blank=True)
    
    photo = models.ImageField(upload_to='visit_photos/', null=True, blank=True)
    video = models.FileField(upload_to='visit_videos/', null=True, blank=True)
    order = models.ForeignKey(Order, on_delete=models.SET_NULL, null=True, blank=True, related_name='visit_orders')
    
    collection_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    farmer_meeting_flag = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)

class ExpenseCategory(models.TextChoices):
    FUEL = 'Fuel', 'Fuel'
    FOOD = 'Food', 'Food'
    HOTEL = 'Hotel', 'Hotel'
    TRAVEL = 'Travel', 'Travel'
    PARKING = 'Parking', 'Parking'
    MISC = 'Misc', 'Misc'
    OTHER = 'Other', 'Other'

class ExpenseStatus(models.TextChoices):
    PENDING = 'Pending', 'Pending'
    APPROVED = 'Approved', 'Approved'
    REJECTED = 'Rejected', 'Rejected'

class Expense(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    employee = models.ForeignKey(User, on_delete=models.CASCADE, related_name='expenses')
    
    date = models.DateField()
    category = models.CharField(max_length=50, choices=ExpenseCategory.choices)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    description = models.TextField(blank=True, null=True)
    bill = models.FileField(upload_to='expense_bills/', null=True, blank=True)
    
    # Travel & Vehicle KM fields
    # Starting and ending KM captured from employee
    starting_km = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True, help_text="Trip starting odometer KM")
    ending_km = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True, help_text="Trip ending odometer KM")
    total_km = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True, help_text="Calculated total KM (Ending - Starting)")
    km_rate = models.DecimalField(max_digits=6, decimal_places=2, null=True, blank=True, help_text="Admin-assigned rate applied at claim submission time")
    km_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0.00, help_text="Total KM * Applied KM Rate")
    
    # Fare breakdown amounts
    bus_train_car_fair = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    fair_cab = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    fair_auto = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    other_vehicle_fair = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    food = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    laundry = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    phone_bill = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    internet_bill = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    local_conveyance = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    courier = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    photocopy = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    other_charge = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)

    status = models.CharField(max_length=20, choices=ExpenseStatus.choices, default=ExpenseStatus.PENDING)
    approved_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='approved_expenses')
    
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.employee.email} - {self.amount}"

class LocationTrack(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    employee = models.ForeignKey(User, on_delete=models.CASCADE, related_name='location_tracks')
    latitude = models.DecimalField(max_digits=9, decimal_places=6)
    longitude = models.DecimalField(max_digits=9, decimal_places=6)
    timestamp = models.DateTimeField(auto_now_add=True)

class DailyTourPlan(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    employee = models.ForeignKey(User, on_delete=models.CASCADE, related_name='tour_plans')
    date = models.DateField()
    area = models.CharField(max_length=255)
    purpose = models.TextField(blank=True, null=True)
    status = models.CharField(max_length=20, default='Pending') # Pending, Approved, Rejected, Completed
    manager_approval = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='approved_plans')
    end_of_day_report = models.TextField(blank=True, null=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
