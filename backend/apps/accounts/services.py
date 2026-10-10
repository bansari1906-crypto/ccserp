import random
import hashlib
from datetime import timedelta
from django.utils import timezone
from django.core.mail import send_mail
from django.conf import settings
from .models import UserStatus
from .repositories import UserRepository, ProfileRepository, OTPRepository

class OTPService:
    OTP_EXPIRY_MINUTES = 10

    @staticmethod
    def _hash_otp(otp: str) -> str:
        return hashlib.sha256(otp.encode()).hexdigest()

    @staticmethod
    def generate_and_send_otp(email: str):
        # Generate 6 digit OTP
        otp = str(random.randint(100000, 999999))
        
        # Save to DB
        expires_at = timezone.now() + timedelta(minutes=OTPService.OTP_EXPIRY_MINUTES)
        OTPRepository.create_otp_record(
            email=email,
            otp_hash=OTPService._hash_otp(otp),
            expires_at=expires_at
        )
        
        # Send email
        send_mail(
            subject="Your Registration OTP - CCS Connect ERP",
            message=f"Your OTP for registration is: {otp}. It expires in {OTPService.OTP_EXPIRY_MINUTES} minutes.",
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[email],
            fail_silently=False,
        )

    @staticmethod
    def verify_otp(email: str, otp: str) -> bool:
        record = OTPRepository.get_valid_otp_record(email)
        if not record:
            return False
            
        if record.expires_at < timezone.now():
            return False
            
        if record.otp_hash == OTPService._hash_otp(otp):
            OTPRepository.mark_as_used(record)
            return True
            
        return False

class AuthService:
    @staticmethod
    def register_user(email, username, password, phone, role):
        # User is created with PENDING status as per rules
        user = UserRepository.create_user(
            email=email,
            username=username,
            password=password,
            phone=phone,
            role=role,
            status=UserStatus.PENDING
        )
        user.is_verified = True # Email is verified since OTP was checked
        user.save()
        
        # Create corresponding profile
        ProfileRepository.create_profile(user)
        # Create KYC profile
        from .models import KYCProfile
        KYCProfile.objects.create(user=user)
        return user

    @staticmethod
    def authenticate_user(email_or_username, password):
        user = UserRepository.get_user_by_email(email_or_username)
        if not user:
            user = UserRepository.get_user_by_username(email_or_username)
            
        if user and user.check_password(password):
            return user
        return None

class AdminService:
    @staticmethod
    def generate_ccs_id(user):
        if user.ccs_id:
            return user.ccs_id
            
        role_map = {
            'Super Admin': 'SADM',
            'Admin': 'ADM',
            'Distributor': 'DST',
            'Dealer': 'DLR',
            'Employee': 'EMP'
        }
        prefix = role_map.get(user.role, 'USR')
        
        # Simple sequence logic based on user ID for now
        from .models import User
        count = User.objects.filter(role=user.role, status=UserStatus.APPROVED).count() + 1
        new_id = f"CCS-{prefix}-{count:04d}"
        
        # Ensure unique
        while User.objects.filter(ccs_id=new_id).exists():
            count += 1
            new_id = f"CCS-{prefix}-{count:04d}"
            
        return new_id

    @staticmethod
    def approve_user(user, credit_limit=0.0):
        user.status = UserStatus.APPROVED
        if not user.ccs_id:
            user.ccs_id = AdminService.generate_ccs_id(user)
        user.is_active = True
        user.save()
        
        if hasattr(user, 'kyc_profile'):
            from .models import KYCStatus
            user.kyc_profile.kyc_status = KYCStatus.APPROVED
            user.kyc_profile.save()
            
        if user.role in [UserRole.DISTRIBUTOR, 'Dealer']:
            from apps.wallet.models import Wallet
            wallet, _ = Wallet.objects.get_or_create(dealer=user)
            wallet.credit_limit = credit_limit
            wallet.save()
            from .models import DealerProfile
            dp, _ = DealerProfile.objects.get_or_create(user=user)
            dp.credit_limit = credit_limit
            dp.save()
            
        # Send Email
        send_mail(
            subject="Your Account is Approved - CCS Connect ERP",
            message=f"Your account has been approved. Your CCS ID is: {user.ccs_id}. You can now login.",
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[user.email],
            fail_silently=True,
        )
        return user

    @staticmethod
    def reject_user(user):
        user.status = UserStatus.REJECTED
        user.is_active = False
        user.save()
        
        if hasattr(user, 'kyc_profile'):
            from .models import KYCStatus
            user.kyc_profile.kyc_status = KYCStatus.REJECTED
            user.kyc_profile.save()
            
        return user

    @staticmethod
    def suspend_user(user):
        user.is_active = False
        user.save()
        return user
