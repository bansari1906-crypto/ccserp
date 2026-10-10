import uuid
from django.db import models
from django.conf import settings
from apps.common.models import BaseModel

class NotificationType(models.TextChoices):
    ORDER = 'Order', 'Order'
    REGISTRATION = 'Registration', 'Registration'
    APPROVAL = 'Approval', 'Approval'
    DISPATCH = 'Dispatch', 'Dispatch'
    EXPENSE = 'Expense', 'Expense'
    ATTENDANCE = 'Attendance', 'Attendance'
    PAYMENT = 'Payment', 'Payment'
    STOCK = 'Stock', 'Stock'
    REMINDER = 'Reminder', 'Reminder'
    SYSTEM = 'System', 'System'

class Notification(BaseModel):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='notifications')
    title = models.CharField(max_length=255)
    message = models.TextField()
    type = models.CharField(max_length=50, choices=NotificationType.choices, default=NotificationType.SYSTEM)
    event_type = models.CharField(max_length=100, default='system.alert', blank=True)
    reference_id = models.CharField(max_length=255, null=True, blank=True)
    reference_type = models.CharField(max_length=50, null=True, blank=True)
    destination = models.CharField(max_length=255, null=True, blank=True)
    is_read = models.BooleanField(default=False)
    delivery_status = models.CharField(max_length=50, default='delivered')
    metadata = models.JSONField(default=dict, blank=True)

    def __str__(self):
        return f"{self.title} - {self.user.email}"

class DeviceToken(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='device_tokens')
    token = models.CharField(max_length=512, unique=True)
    platform = models.CharField(max_length=20, default='android')
    is_active = models.BooleanField(default=True)
    last_seen = models.DateTimeField(auto_now=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.user.email} - {self.platform} ({'Active' if self.is_active else 'Inactive'})"
