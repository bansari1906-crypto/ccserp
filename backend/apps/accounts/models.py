import uuid
from django.db import models
from django.contrib.auth.models import AbstractUser
from django.utils.translation import gettext_lazy as _

class UserRole(models.TextChoices):
    SUPER_ADMIN = 'Super Admin', _('Super Admin')
    ADMIN = 'Admin', _('Admin')
    EMPLOYEE = 'Employee', _('Employee')
    DISTRIBUTOR = 'Distributor', _('Distributor')
    DEALER = 'Dealer', _('Dealer')
    WAREHOUSE = 'Warehouse', _('Warehouse')

class UserStatus(models.TextChoices):
    PENDING = 'Pending', _('Pending')
    APPROVED = 'Approved', _('Approved')
    REJECTED = 'Rejected', _('Rejected')
    SUSPENDED = 'Suspended', _('Suspended')

class KYCStatus(models.TextChoices):
    PENDING = 'Pending', _('Pending')
    UNDER_REVIEW = 'Under Review', _('Under Review')
    APPROVED = 'Approved', _('Approved')
    REJECTED = 'Rejected', _('Rejected')

class User(AbstractUser):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    ccs_id = models.CharField(max_length=50, unique=True, blank=True, null=True)
    email = models.EmailField(_('email address'), unique=True)
    phone = models.CharField(max_length=20, blank=True, null=True)
    role = models.CharField(max_length=20, choices=UserRole.choices, default=UserRole.EMPLOYEE)
    status = models.CharField(max_length=20, choices=UserStatus.choices, default=UserStatus.PENDING)
    is_verified = models.BooleanField(default=False)
    joining_date = models.DateField(blank=True, null=True)
    km_rate = models.DecimalField(max_digits=6, decimal_places=2, default=5.00, blank=True, null=True, help_text="Admin-controlled reimbursement rate per KM")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['username']

    def __str__(self):
        return f"{self.email} - {self.role}"

    def save(self, *args, **kwargs):
        if self.status == UserStatus.APPROVED and not self.ccs_id:
            prefix = "EMP"
            if self.role == UserRole.DISTRIBUTOR:
                prefix = "DIST"
            elif self.role == UserRole.WAREHOUSE:
                prefix = "WH"
            elif self.role in [UserRole.ADMIN, UserRole.SUPER_ADMIN]:
                prefix = "ADM"
            elif self.role == UserRole.DEALER:
                prefix = "DL"

            last_id = 0
            existing_ids = User.objects.filter(ccs_id__startswith=f"CCS-{prefix}-").values_list('ccs_id', flat=True)
            for cid in existing_ids:
                try:
                    num = int(cid.split('-')[-1])
                    if num > last_id:
                        last_id = num
                except (ValueError, IndexError):
                    pass

            new_id = last_id + 1
            candidate_id = f"CCS-{prefix}-{new_id:04d}"
            while User.objects.filter(ccs_id=candidate_id).exists():
                new_id += 1
                candidate_id = f"CCS-{prefix}-{new_id:04d}"

            self.ccs_id = candidate_id

        super().save(*args, **kwargs)

class DealerProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='dealer_profile')
    assigned_distributor = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='dealers')
    assigned_employee = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='assigned_dealers')
    company_name = models.CharField(max_length=255, blank=True, null=True)
    address = models.TextField(blank=True, null=True)
    city = models.CharField(max_length=100, blank=True, null=True)
    district = models.CharField(max_length=100, blank=True, null=True)
    state = models.CharField(max_length=100, blank=True, null=True)
    pincode = models.CharField(max_length=10, blank=True, null=True)
    
    # Financial & Business
    credit_limit = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    outstanding_balance = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    loyalty_points = models.IntegerField(default=0)
    
    # Agronomy Info
    land_area = models.CharField(max_length=50, blank=True, null=True)
    preferred_crop = models.CharField(max_length=100, blank=True, null=True)
    preferred_products = models.TextField(blank=True, null=True)
    
    # Location
    gps_location = models.CharField(max_length=255, blank=True, null=True)

    def __str__(self):
        return f"Dealer: {self.user.email}"

class DistributorProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='distributor_profile')
    company_name = models.CharField(max_length=255, blank=True, null=True)
    state = models.CharField(max_length=100, blank=True, null=True)
    district = models.CharField(max_length=100, blank=True, null=True)
    territory = models.CharField(max_length=100, blank=True, null=True)
    distributor_area = models.CharField(max_length=255, blank=True, null=True)
    manager = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='managed_distributors', limit_choices_to={'role': UserRole.ADMIN})
    
    # Operations
    daily_sales_target = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    monthly_sales_plan = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    monthly_collection_plan = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    has_warehouse = models.BooleanField(default=False)
    vehicles_count = models.IntegerField(default=0)

    def __str__(self):
        return f"Distributor: {self.user.email}"

class EmployeeProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='employee_profile')
    designation = models.CharField(max_length=255, blank=True, null=True)
    state = models.CharField(max_length=100, blank=True, null=True)
    district = models.CharField(max_length=100, blank=True, null=True)
    territory = models.CharField(max_length=100, blank=True, null=True)
    
    # HR & Performance
    leave_balance = models.IntegerField(default=0)
    performance_score = models.DecimalField(max_digits=3, decimal_places=1, default=0.0)
    sales_target = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    monthly_sales_plan = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    monthly_collection_plan = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    employee_document = models.FileField(upload_to='employee/documents/', null=True, blank=True)

    def __str__(self):
        return f"Employee: {self.user.email}"

class AdminProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='admin_profile')
    
    def __str__(self):
        return f"Admin: {self.user.email}"

class OTPRecord(models.Model):
    email = models.EmailField()
    otp_hash = models.CharField(max_length=128)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    is_used = models.BooleanField(default=False)

    def __str__(self):
        return f"OTP for {self.email}"

class KYCProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='kyc_profile')
    kyc_status = models.CharField(max_length=20, choices=KYCStatus.choices, default=KYCStatus.PENDING)
    aadhaar_file = models.FileField(upload_to='kyc/aadhaar/', blank=True, null=True)
    pan_file = models.FileField(upload_to='kyc/pan/', blank=True, null=True)
    gst_file = models.FileField(upload_to='kyc/gst/', blank=True, null=True)
    fertilizer_license = models.FileField(upload_to='kyc/fertilizer/', blank=True, null=True)
    pesticide_license = models.FileField(upload_to='kyc/pesticide/', blank=True, null=True)
    shop_photo = models.FileField(upload_to='kyc/shop/', blank=True, null=True)
    profile_photo = models.FileField(upload_to='profile_photos/', blank=True, null=True)

    def __str__(self):
        return f"KYC for {self.user.email}"

class LoginHistory(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='login_history')
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(blank=True, null=True)
    timestamp = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.user.email} login at {self.timestamp}"

