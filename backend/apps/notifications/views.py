from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils import timezone
from .models import Notification, DeviceToken
from .serializers import NotificationSerializer, DeviceTokenSerializer
from .services import run_start_day_reminder_job
from apps.accounts.models import UserRole

class NotificationViewSet(viewsets.ModelViewSet):
    serializer_class = NotificationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Notification.objects.filter(user=self.request.user).order_by('-created_at')

    @action(detail=False, methods=['get'])
    def unread_count(self, request):
        count = self.get_queryset().filter(is_read=False).count()
        return Response({"unread_count": count})

    @action(detail=False, methods=['post'])
    def mark_all_read(self, request):
        count = self.get_queryset().filter(is_read=False).update(is_read=True)
        return Response({"status": "success", "marked_read_count": count})

    @action(detail=True, methods=['post'])
    def mark_read(self, request, pk=None):
        notification = self.get_object()
        notification.is_read = True
        notification.save(update_fields=['is_read'])
        return Response(NotificationSerializer(notification).data)

    @action(detail=False, methods=['post'])
    def run_reminders(self, request):
        """
        Admin endpoint to manually trigger or test the 10:00 AM Start Day reminder job.
        Accepts optional 'date' (YYYY-MM-DD) and 'force' (boolean).
        """
        if request.user.role not in [UserRole.SUPER_ADMIN, UserRole.ADMIN]:
            return Response(
                {"error": "Unauthorized. Only Admins can invoke the reminder scheduler."},
                status=status.HTTP_403_FORBIDDEN
            )

        target_date_str = request.data.get('date')
        force = bool(request.data.get('force', False))

        target_date = None
        if target_date_str:
            try:
                from datetime import datetime
                target_date = datetime.strptime(target_date_str, '%Y-%m-%d').date()
            except ValueError:
                return Response({"error": "Invalid date format. Use YYYY-MM-DD."}, status=status.HTTP_400_BAD_REQUEST)

        summary = run_start_day_reminder_job(target_date=target_date, force=force)
        return Response(summary, status=status.HTTP_200_OK)


class DeviceTokenViewSet(viewsets.ModelViewSet):
    serializer_class = DeviceTokenSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return DeviceToken.objects.filter(user=self.request.user)

    def create(self, request, *args, **kwargs):
        token = request.data.get('token')
        platform = request.data.get('platform', 'android')

        if not token:
            return Response({"error": "Device token is required."}, status=status.HTTP_400_BAD_REQUEST)

        device_token, created = DeviceToken.objects.update_or_create(
            token=token,
            defaults={
                'user': request.user,
                'platform': platform,
                'is_active': True,
                'last_seen': timezone.now()
            }
        )

        return Response(
            DeviceTokenSerializer(device_token).data,
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK
        )

    @action(detail=False, methods=['post'])
    def unregister(self, request):
        token = request.data.get('token')
        if token:
            DeviceToken.objects.filter(token=token, user=request.user).update(is_active=False)
        else:
            # Unregister all tokens for this user on logout
            DeviceToken.objects.filter(user=request.user).update(is_active=False)

        return Response({"status": "unregistered", "message": "Device token successfully detached on logout."})
