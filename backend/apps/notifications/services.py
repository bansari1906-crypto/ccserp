import logging
import uuid
from datetime import datetime, date, timedelta
from django.conf import settings
from django.utils import timezone
from apps.accounts.models import User, UserRole
from apps.hr.models import Attendance
from .models import Notification, NotificationType, DeviceToken
from apps.common.events import broadcast_erp_event

logger = logging.getLogger(__name__)

class PushNotificationService:
    """
    Handles server-side push notification dispatch to Android/iOS/Web devices.
    Integrates with Firebase Cloud Messaging (FCM) when configured,
    and handles graceful fallback, token lifecycle, and dead-token cleanup.
    """
    _fcm_initialized = False

    @classmethod
    def _init_fcm(cls):
        if cls._fcm_initialized:
            return True
        try:
            import firebase_admin
            from firebase_admin import credentials
            
            # Check for service account key file or env path
            cred_path = getattr(settings, 'FCM_SERVICE_ACCOUNT_KEY', None)
            if cred_path and os.path.exists(cred_path):
                cred = credentials.Certificate(cred_path)
                firebase_admin.initialize_app(cred)
                cls._fcm_initialized = True
                return True
        except Exception as e:
            logger.debug(f"FCM init skipped or failed: {e}")
        return False

    @classmethod
    def send_push(cls, user, title: str, message: str, data: dict = None) -> dict:
        """
        Sends push notification to all active registered devices of the user.
        Cleans up invalid or expired device tokens automatically.
        """
        active_tokens = list(DeviceToken.objects.filter(user=user, is_active=True))
        if not active_tokens:
            return {"sent": 0, "failed": 0, "reason": "No active device tokens"}

        clean_data = {str(k): str(v) for k, v in (data or {}).items() if v is not None}

        # Check if Firebase is available
        fcm_ready = cls._init_fcm()
        sent_count = 0
        failed_count = 0

        for dt in active_tokens:
            if fcm_ready:
                try:
                    from firebase_admin import messaging
                    msg = messaging.Message(
                        notification=messaging.Notification(title=title, body=message),
                        data=clean_data,
                        token=dt.token
                    )
                    messaging.send(msg)
                    sent_count += 1
                except Exception as err:
                    err_str = str(err).lower()
                    logger.warning(f"Failed to send push to device {dt.id}: {err}")
                    # Invalidate token if rejected by provider
                    if 'unregistered' in err_str or 'invalid' in err_str or 'notfound' in err_str:
                        dt.is_active = False
                        dt.save(update_fields=['is_active'])
                    failed_count += 1
            else:
                # FCM provider credentials not uploaded; log simulation
                logger.info(
                    f"[PushService Simulation] Device '{dt.platform}' ({dt.token[:12]}...): "
                    f"Title='{title}', Body='{message}', User='{user.email}'"
                )
                sent_count += 1

        return {"sent": sent_count, "failed": failed_count, "fcm_live": fcm_ready}


def notify_user(
    user,
    title: str,
    message: str,
    type: str = NotificationType.SYSTEM,
    event_type: str = 'system.alert',
    reference_id: str = None,
    reference_type: str = None,
    destination: str = None,
    metadata: dict = None,
    deduplicate: bool = True
) -> Notification:
    """
    Creates a persistent PostgreSQL Notification, broadcasts via WebSockets (Redis/Channels),
    and dispatches Android push notifications to user's registered devices.
    """
    if not user:
        return None

    # Deduplication check: prevent identical alerts within 15 minutes
    if deduplicate and reference_id:
        cutoff = timezone.now() - timedelta(minutes=15)
        existing = Notification.objects.filter(
            user=user,
            event_type=event_type,
            reference_id=str(reference_id),
            created_at__gte=cutoff
        ).first()
        if existing:
            logger.debug(f"Duplicate notification suppressed for user {user.email} (ref: {reference_id})")
            return existing

    notification = Notification.objects.create(
        user=user,
        title=title,
        message=message,
        type=type,
        event_type=event_type,
        reference_id=str(reference_id) if reference_id else None,
        reference_type=reference_type,
        destination=destination,
        metadata=metadata or {},
        delivery_status='delivered'
    )

    # Broadcast live event via Redis Channel Layer
    try:
        broadcast_erp_event(
            event_type='notification.created',
            payload={
                "id": str(notification.id),
                "title": notification.title,
                "message": notification.message,
                "type": notification.type,
                "event_type": notification.event_type,
                "reference_id": notification.reference_id,
                "reference_type": notification.reference_type,
                "destination": notification.destination,
                "is_read": notification.is_read,
                "created_at": notification.created_at.isoformat() if notification.created_at else timezone.now().isoformat()
            },
            target_user_ids=[str(user.id)]
        )
    except Exception as e:
        logger.warning(f"WebSocket notification broadcast error: {e}")

    # Dispatch mobile push notification
    try:
        PushNotificationService.send_push(
            user=user,
            title=title,
            message=message,
            data={
                "notification_id": str(notification.id),
                "destination": destination or "",
                "reference_id": str(reference_id or ""),
                "reference_type": reference_type or "",
                "event_type": event_type
            }
        )
    except Exception as e:
        logger.warning(f"Push dispatch error: {e}")

    return notification


def notify_roles(
    roles: list,
    title: str,
    message: str,
    type: str = NotificationType.SYSTEM,
    event_type: str = 'system.alert',
    reference_id: str = None,
    reference_type: str = None,
    destination: str = None,
    metadata: dict = None,
    exclude_user_ids: list = None
):
    """
    Sends notifications to all active users matching specified roles.
    """
    role_map = {
        'Admin': [UserRole.SUPER_ADMIN, UserRole.ADMIN],
        'Warehouse': [UserRole.WAREHOUSE],
        'Distributor': [UserRole.DISTRIBUTOR],
        'Employee': [UserRole.EMPLOYEE]
    }

    target_roles = []
    for r in roles:
        target_roles.extend(role_map.get(r, [r]))

    qs = User.objects.filter(role__in=target_roles, is_active=True)
    if exclude_user_ids:
        qs = qs.exclude(id__in=exclude_user_ids)

    notifications = []
    for user in qs:
        n = notify_user(
            user=user,
            title=title,
            message=message,
            type=type,
            event_type=event_type,
            reference_id=reference_id,
            reference_type=reference_type,
            destination=destination,
            metadata=metadata
        )
        if n:
            notifications.append(n)
    return notifications


def run_start_day_reminder_job(target_date: date = None, force: bool = False) -> dict:
    """
    Server-side scheduled 10:00 AM Start Day reminder job.
    Targets active employees who have not clocked in for target_date.
    Respects non-working days (Sunday) and avoids duplicate reminders.
    """
    if target_date is None:
        target_date = date.today()

    # Weekend check: Sunday is non-working day in Indian business calendar
    # target_date.weekday() == 6 is Sunday
    if target_date.weekday() == 6 and not force:
        logger.info(f"Start Day reminder skipped for {target_date}: Sunday (Non-working day).")
        return {
            "date": str(target_date),
            "status": "skipped",
            "reason": "Sunday (Non-working day)",
            "eligible_employees": 0,
            "reminders_sent": 0
        }

    # Query active, approved employees
    employees = User.objects.filter(
        role=UserRole.EMPLOYEE,
        is_active=True,
        status='Approved'
    )

    eligible_count = employees.count()
    checked_in_count = 0
    reminders_sent = 0
    duplicate_skipped = 0

    for emp in employees:
        # 1. Check if employee has already clocked in today
        has_clocked_in = Attendance.objects.filter(
            employee=emp,
            date=target_date
        ).exists()

        if has_clocked_in:
            checked_in_count += 1
            continue

        # 2. Check for duplicate reminder on the same date
        already_reminded = Notification.objects.filter(
            user=emp,
            event_type='attendance.reminder_start_day',
            reference_id=str(target_date)
        ).exists()

        if already_reminded:
            duplicate_skipped += 1
            continue

        # 3. Create Start Day reminder
        emp_name = f"{emp.first_name} {emp.last_name}".strip() or emp.username
        notify_user(
            user=emp,
            title="Start Day Reminder",
            message=f"Good morning {emp_name}! Please start your working day and submit your morning attendance selfie.",
            type=NotificationType.REMINDER,
            event_type='attendance.reminder_start_day',
            reference_id=str(target_date),
            reference_type='attendance',
            destination='attendance',
            metadata={"date": str(target_date), "reminder_time": "10:00 AM"},
            deduplicate=True
        )
        reminders_sent += 1

    result = {
        "date": str(target_date),
        "status": "completed",
        "eligible_employees": eligible_count,
        "already_checked_in": checked_in_count,
        "reminders_sent": reminders_sent,
        "duplicate_skipped": duplicate_skipped
    }
    logger.info(f"Start Day reminder job summary for {target_date}: {result}")
    return result
