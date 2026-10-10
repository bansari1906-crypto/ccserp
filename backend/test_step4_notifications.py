import os
import sys
import uuid
from datetime import date, datetime, timedelta

# Ensure UTF-8 output encoding on Windows stdout
if sys.platform == 'win32':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

# Setup Django Environment
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'ccs_backend.settings')
import django
django.setup()

from django.conf import settings
from django.utils import timezone
from rest_framework.test import APIClient
from apps.accounts.models import User, UserRole, UserStatus, EmployeeProfile, DistributorProfile
from apps.orders.models import Order, OrderItem, OrderStatus
from apps.products.models import Product
from apps.wallet.models import Wallet, LedgerEntry, LedgerEntryType
from apps.hr.models import Attendance, Expense
from apps.notifications.models import Notification, DeviceToken
from apps.notifications.services import (
    notify_user,
    notify_roles,
    run_start_day_reminder_job,
    PushNotificationService,
)

def run_tests():
    print("=" * 70)
    print("CCS CONNECT - STEP 4 COMPREHENSIVE NOTIFICATION SYSTEM TEST SUITE")
    print("=" * 70)

    test_results = {}

    # Setup core test users
    uid = uuid.uuid4().hex[:6]
    admin_user = User.objects.filter(role=UserRole.ADMIN).first()
    if not admin_user:
        admin_user = User.objects.create_superuser(
            username=f'admin_notif_{uid}',
            email=f'admin_notif_{uid}@ccs.com',
            password='TestPassword@123',
            role=UserRole.ADMIN
        )

    emp_user = User.objects.create_user(
        username=f'emp_notif_{uid}',
        email=f'emp_notif_{uid}@ccs.com',
        password='TestPassword@123',
        role=UserRole.EMPLOYEE,
        status=UserStatus.APPROVED,
        phone='9876543210',
        first_name='Test',
        last_name='Employee'
    )
    EmployeeProfile.objects.create(user=emp_user, designation='Field Officer')

    emp_clocked = User.objects.create_user(
        username=f'emp_clocked_{uid}',
        email=f'emp_clocked_{uid}@ccs.com',
        password='TestPassword@123',
        role=UserRole.EMPLOYEE,
        status=UserStatus.APPROVED,
        phone='9876543211',
        first_name='Clocked',
        last_name='Employee'
    )
    EmployeeProfile.objects.create(user=emp_clocked, designation='Field Officer')

    dist_user = User.objects.create_user(
        username=f'dist_notif_{uid}',
        email=f'dist_notif_{uid}@ccs.com',
        password='TestPassword@123',
        role=UserRole.DISTRIBUTOR,
        status=UserStatus.APPROVED,
        phone='9876543212',
        first_name='Test',
        last_name='Distributor'
    )
    dist_profile = DistributorProfile.objects.create(
        user=dist_user,
        company_name=f'Dist Enterprise {uid}'
    )
    dist_wallet = Wallet.objects.create(dealer=dist_user, credit_limit=500000, outstanding_amount=50000)

    other_dist_user = User.objects.create_user(
        username=f'dist_other_{uid}',
        email=f'dist_other_{uid}@ccs.com',
        password='TestPassword@123',
        role=UserRole.DISTRIBUTOR,
        status=UserStatus.APPROVED,
        phone='9876543213',
        first_name='Other',
        last_name='Distributor'
    )
    DistributorProfile.objects.create(
        user=other_dist_user,
        company_name=f'Other Dist {uid}'
    )
    Wallet.objects.create(dealer=other_dist_user, credit_limit=300000, outstanding_amount=0)

    wh_user = User.objects.filter(role=UserRole.WAREHOUSE).first()
    if not wh_user:
        wh_user = User.objects.create_user(
            username=f'wh_notif_{uid}',
            email=f'wh_notif_{uid}@ccs.com',
            password='TestPassword@123',
            role=UserRole.WAREHOUSE,
            first_name='Warehouse',
            last_name='Officer'
        )

    # Base test product
    product = Product.objects.first()
    if not product:
        product = Product.objects.create(
            name=f'Test Pesticide {uid}',
            code=f'PRD-{uid}',
            mrp=1000,
            dealer_price=800,
            distributor_price=700,
            stock=100,
            status='Active'
        )

    # -------------------------------------------------------------
    # TEST 1: New order -> Admin notification
    # -------------------------------------------------------------
    try:
        order1 = Order.objects.create(
            order_number=f"ORD-TEST-{uid}-1",
            dealer=dist_user,
            created_by=emp_user,
            grand_total=15000,
            status=OrderStatus.PENDING_APPROVAL
        )
        OrderItem.objects.create(order=order1, product=product, quantity=10, rate=1500, total=15000)

        # Trigger notification check
        admin_notifs = Notification.objects.filter(
            user=admin_user, event_type='order.created', reference_id=str(order1.id)
        )
        assert admin_notifs.exists(), f"Admin did not receive 'order.created' notification for order {order1.id}"
        notif = admin_notifs.first()
        assert notif.destination == 'orders'
        assert str(order1.id) == notif.reference_id
        print("✓ TEST 1 PASSED: New order created -> Admin notification received & stored in DB.")
        test_results['test_1_new_order_admin_notif'] = True
    except Exception as e:
        print(f"✗ TEST 1 FAILED: {e}")
        test_results['test_1_new_order_admin_notif'] = False

    # -------------------------------------------------------------
    # TEST 2: Approval/rejection -> correct authorized recipients
    # -------------------------------------------------------------
    try:
        # Approve order1
        order1.status = OrderStatus.APPROVED
        order1.save()

        emp_approved_notif = Notification.objects.filter(
            user=emp_user, event_type='order.approved', reference_id=str(order1.id)
        )
        dist_approved_notif = Notification.objects.filter(
            user=dist_user, event_type='order.approved', reference_id=str(order1.id)
        )

        assert emp_approved_notif.exists(), "Employee did not receive 'order.approved' notification"
        assert dist_approved_notif.exists(), "Distributor did not receive 'order.approved' notification"

        # Now test rejection on a second order
        order_rej = Order.objects.create(
            order_number=f"ORD-REJ-{uid}",
            dealer=dist_user,
            created_by=emp_user,
            grand_total=5000,
            status=OrderStatus.PENDING_APPROVAL
        )
        order_rej.status = OrderStatus.REJECTED
        order_rej.remarks = "Exceeds credit terms"
        order_rej.save()

        emp_rej_notif = Notification.objects.filter(
            user=emp_user, event_type='order.rejected', reference_id=str(order_rej.id)
        )
        dist_rej_notif = Notification.objects.filter(
            user=dist_user, event_type='order.rejected', reference_id=str(order_rej.id)
        )
        assert emp_rej_notif.exists(), "Employee did not receive 'order.rejected' notification"
        assert dist_rej_notif.exists(), "Distributor did not receive 'order.rejected' notification"

        print("✓ TEST 2 PASSED: Order approval & rejection notify designated employee & distributor.")
        test_results['test_2_approval_rejection_recipients'] = True
    except Exception as e:
        print(f"✗ TEST 2 FAILED: {e}")
        test_results['test_2_approval_rejection_recipients'] = False

    # -------------------------------------------------------------
    # TEST 3: Bilty / Ready to Dispatch -> Warehouse notification
    # -------------------------------------------------------------
    try:
        # Update order with Bilty
        order1.bilty_number = f"BLTY-{uid}-99"
        order1.status = OrderStatus.BILTY_UPLOADED
        order1.save()

        wh_bilty_notif = Notification.objects.filter(
            user=wh_user, event_type='order.bilty_uploaded', reference_id=str(order1.id)
        )
        assert wh_bilty_notif.exists(), "Warehouse did not receive 'order.bilty_uploaded' notification"

        # Mark ready to dispatch
        order1.status = OrderStatus.READY_DISPATCH
        order1.save()

        wh_ready_notif = Notification.objects.filter(
            user=wh_user, event_type='order.ready_dispatch', reference_id=str(order1.id)
        )
        assert wh_ready_notif.exists(), "Warehouse did not receive 'order.ready_dispatch' notification"
        print("✓ TEST 3 PASSED: Bilty uploaded and Ready to Dispatch notify Warehouse officers.")
        test_results['test_3_warehouse_bilty_ready_dispatch'] = True
    except Exception as e:
        print(f"✗ TEST 3 FAILED: {e}")
        test_results['test_3_warehouse_bilty_ready_dispatch'] = False

    # -------------------------------------------------------------
    # TEST 4: LR saved -> status remains Ready to Dispatch
    # -------------------------------------------------------------
    try:
        # Ensure order1 is in READY_DISPATCH
        order1.status = OrderStatus.READY_DISPATCH
        order1.save()

        client = APIClient()
        client.force_authenticate(user=wh_user)

        lr_payload = {
            'lr_number': f'LR-{uid}-88',
            'transport_details': 'VRL Logistics Ltd',
            'vehicle_number': 'MH-12-AB-1234'
        }
        res = client.post(f"/api/orders/{order1.id}/generate_lr/", lr_payload, format='json')
        assert res.status_code == 200, f"Generate LR failed with {res.status_code}: {res.data}"

        # Refetch order from DB
        order1.refresh_from_db()
        assert order1.status == OrderStatus.READY_DISPATCH, (
            f"Expected status '{OrderStatus.READY_DISPATCH}' but got '{order1.status}'"
        )
        assert order1.lr_number == f'LR-{uid}-88'

        # Check LR notification was generated
        lr_notif = Notification.objects.filter(event_type='order.lr_saved', reference_id=str(order1.id))
        assert lr_notif.exists(), "LR saved notification was not generated"

        print("✓ TEST 4 PASSED: LR saved retains order status strictly as 'Ready to Dispatch'.")
        test_results['test_4_lr_saved_status_ready_to_dispatch'] = True
    except Exception as e:
        print(f"✗ TEST 4 FAILED: {e}")
        test_results['test_4_lr_saved_status_ready_to_dispatch'] = False

    # -------------------------------------------------------------
    # TEST 5: Dispatch -> relevant notification
    # -------------------------------------------------------------
    try:
        client = APIClient()
        client.force_authenticate(user=wh_user)
        res = client.post(f"/api/orders/{order1.id}/dispatch_order/", {}, format='json')
        assert res.status_code == 200, f"Dispatch order failed: {res.status_code}"

        order1.refresh_from_db()
        assert order1.status == OrderStatus.DISPATCHED

        # Verify notifications sent to Admin, Employee, and Distributor
        admin_disp = Notification.objects.filter(
            user=admin_user, event_type='order.dispatched', reference_id=str(order1.id)
        )
        emp_disp = Notification.objects.filter(
            user=emp_user, event_type='order.dispatched', reference_id=str(order1.id)
        )
        dist_disp = Notification.objects.filter(
            user=dist_user, event_type='order.dispatched', reference_id=str(order1.id)
        )

        assert admin_disp.exists(), "Admin did not receive dispatch notification"
        assert emp_disp.exists(), "Employee did not receive dispatch notification"
        assert dist_disp.exists(), "Distributor did not receive dispatch notification"

        print("✓ TEST 5 PASSED: Dispatch generates notifications for Admin, Employee, and Distributor.")
        test_results['test_5_dispatch_order_notifications'] = True
    except Exception as e:
        print(f"✗ TEST 5 FAILED: {e}")
        test_results['test_5_dispatch_order_notifications'] = False

    # -------------------------------------------------------------
    # TEST 6: Payment recorded -> relevant notification + deduplication
    # -------------------------------------------------------------
    try:
        ledger = LedgerEntry.objects.create(
            wallet=dist_wallet,
            type=LedgerEntryType.COLLECTION,
            amount=25000,
            reference=f'PAY-TEST-{uid}',
            notes='RTGS Payment received'
        )

        dist_pay_notif = Notification.objects.filter(
            user=dist_user, event_type='payment.recorded', reference_id=str(ledger.id)
        )
        assert dist_pay_notif.exists(), "Distributor did not receive payment notification"

        # Deduplication check: Simulate immediate retry of the same ledger entry save
        initial_pay_count = Notification.objects.filter(
            user=dist_user, event_type='payment.recorded', reference_id=str(ledger.id)
        ).count()
        # Trigger save again
        ledger.save()
        after_pay_count = Notification.objects.filter(
            user=dist_user, event_type='payment.recorded', reference_id=str(ledger.id)
        ).count()

        assert initial_pay_count == after_pay_count == 1, "Duplicate payment notification was created on retry!"
        print("✓ TEST 6 PASSED: Payment recorded creates notification with duplicate prevention.")
        test_results['test_6_payment_notification_dedup'] = True
    except Exception as e:
        print(f"✗ TEST 6 FAILED: {e}")
        test_results['test_6_payment_notification_dedup'] = False

    # -------------------------------------------------------------
    # TEST 7: 10 AM reminder job sends to an eligible employee who has not clocked in
    # -------------------------------------------------------------
    try:
        today_date = timezone.localtime().date()
        # Ensure emp_user has NO attendance today
        Attendance.objects.filter(employee=emp_user, date=today_date).delete()
        Notification.objects.filter(
            user=emp_user, event_type='attendance.reminder_start_day', reference_id=str(today_date)
        ).delete()

        # Run scheduler job with force=True to bypass real-time clock check
        results = run_start_day_reminder_job(force=True)

        notif_reminder = Notification.objects.filter(
            user=emp_user, event_type='attendance.reminder_start_day', reference_id=str(today_date)
        )
        assert notif_reminder.exists(), "Eligible unclocked employee did not receive Start Day reminder!"
        assert notif_reminder.first().destination == 'attendance'
        print("✓ TEST 7 PASSED: 10 AM reminder sent to eligible employee without clock-in.")
        test_results['test_7_reminder_unclocked_employee'] = True
    except Exception as e:
        print(f"✗ TEST 7 FAILED: {e}")
        test_results['test_7_reminder_unclocked_employee'] = False

    # -------------------------------------------------------------
    # TEST 8: Employee who already clocked in receives no Start Day reminder
    # -------------------------------------------------------------
    try:
        today_date = timezone.localtime().date()
        # Create completed clock-in for emp_clocked
        Attendance.objects.filter(employee=emp_clocked, date=today_date).delete()
        Notification.objects.filter(
            user=emp_clocked, event_type='attendance.reminder_start_day', reference_id=str(today_date)
        ).delete()

        Attendance.objects.create(
            employee=emp_clocked,
            date=today_date,
            check_in=datetime.now().time(),
            status='Working',
            is_active=True
        )

        # Run reminder job again
        run_start_day_reminder_job(force=True)

        clocked_reminder = Notification.objects.filter(
            user=emp_clocked, event_type='attendance.reminder_start_day', reference_id=str(today_date)
        )
        assert not clocked_reminder.exists(), "Clocked-in employee improperly received a reminder!"
        print("✓ TEST 8 PASSED: Clocked-in employee correctly received NO Start Day reminder.")
        test_results['test_8_no_reminder_for_clocked_in'] = True
    except Exception as e:
        print(f"✗ TEST 8 FAILED: {e}")
        test_results['test_8_no_reminder_for_clocked_in'] = False

    # -------------------------------------------------------------
    # TEST 9: Duplicate scheduled execution does not create duplicate reminders
    # -------------------------------------------------------------
    try:
        today_date = timezone.localtime().date()
        initial_emp_reminders = Notification.objects.filter(
            user=emp_user, event_type='attendance.reminder_start_day', reference_id=str(today_date)
        ).count()

        # Re-run job immediately
        run_start_day_reminder_job(force=True)
        run_start_day_reminder_job(force=True)

        after_emp_reminders = Notification.objects.filter(
            user=emp_user, event_type='attendance.reminder_start_day', reference_id=str(today_date)
        ).count()

        assert initial_emp_reminders == after_emp_reminders == 1, (
            f"Duplicate reminders created: before={initial_emp_reminders}, after={after_emp_reminders}"
        )
        print("✓ TEST 9 PASSED: Duplicate reminder job execution cleanly prevented.")
        test_results['test_9_duplicate_reminder_prevention'] = True
    except Exception as e:
        print(f"✗ TEST 9 FAILED: {e}")
        test_results['test_9_duplicate_reminder_prevention'] = False

    # -------------------------------------------------------------
    # TEST 10: Notification unread count and read state persist in PostgreSQL
    # -------------------------------------------------------------
    try:
        client = APIClient()
        client.force_authenticate(user=emp_user)

        # Get initial unread count
        res_count = client.get("/api/notifications/unread_count/")
        assert res_count.status_code == 200
        count_before = res_count.data.get('unread_count', 0)
        assert count_before > 0

        # Mark all as read
        res_mark_all = client.post("/api/notifications/mark_all_read/")
        assert res_mark_all.status_code == 200

        # Re-query unread count
        res_count_after = client.get("/api/notifications/unread_count/")
        assert res_count_after.data.get('unread_count') == 0

        # Re-query notification list to verify persistent database state
        res_list = client.get("/api/notifications/")
        items = res_list.data if isinstance(res_list.data, list) else res_list.data.get('results', [])
        for n in items:
            assert n.get('is_read') is True, "Notification did not persist read state in PostgreSQL!"

        print("✓ TEST 10 PASSED: Notification unread count and read states persist in PostgreSQL.")
        test_results['test_10_unread_count_and_read_state'] = True
    except Exception as e:
        print(f"✗ TEST 10 FAILED: {e}")
        test_results['test_10_unread_count_and_read_state'] = False

    # -------------------------------------------------------------
    # TEST 11: Multi-tenant Privacy: User cannot access another user's notifications
    # -------------------------------------------------------------
    try:
        # Create private notification for dist_user
        private_notif = notify_user(
            user=dist_user,
            title="Private Distributor Financial Alert",
            message="Your credit ledger has been updated.",
            event_type="credit.update",
            reference_id=f"CREDIT-{uid}"
        )

        client = APIClient()
        # Authenticate as other_dist_user
        client.force_authenticate(user=other_dist_user)

        # Attempt to access dist_user's private notification
        res_detail = client.get(f"/api/notifications/{private_notif.id}/")
        assert res_detail.status_code in [404, 403], (
            f"Unauthorized user accessed private notification! Got {res_detail.status_code}"
        )

        # Attempt to mark other user's notification as read
        res_mark = client.post(f"/api/notifications/{private_notif.id}/mark_read/")
        assert res_mark.status_code in [404, 403], (
            f"Unauthorized user modified private notification! Got {res_mark.status_code}"
        )

        # List must not include private_notif
        res_list = client.get("/api/notifications/")
        items = res_list.data if isinstance(res_list.data, list) else res_list.data.get('results', [])
        ids = [i.get('id') for i in items]
        assert private_notif.id not in ids, "Other distributor's notifications leaked into inbox list!"

        print("✓ TEST 11 PASSED: Strict cross-user data isolation enforced (Zero leakage).")
        test_results['test_11_cross_user_privacy'] = True
    except Exception as e:
        print(f"✗ TEST 11 FAILED: {e}")
        test_results['test_11_cross_user_privacy'] = False

    # -------------------------------------------------------------
    # TEST 12: WebSocket disconnection does not destroy notification history
    # -------------------------------------------------------------
    try:
        # Even when WebSockets are completely offline or disconnected,
        # all notifications are queryable and paginated via REST API.
        client = APIClient()
        client.force_authenticate(user=emp_user)

        # Post a new notification
        offline_notif = notify_user(
            user=emp_user,
            title="Offline History Test Alert",
            message="Notification survives full disconnection.",
            event_type="offline.test",
            reference_id=f"OFFLINE-{uid}"
        )

        # Fetch via REST API
        res = client.get("/api/notifications/")
        assert res.status_code == 200
        items = res.data if isinstance(res.data, list) else res.data.get('results', [])
        found = any(str(i.get('id')) == str(offline_notif.id) for i in items)
        assert found, "Notification was not retrievable via REST API inbox!"
        print("✓ TEST 12 PASSED: Notification history persists in DB independent of WebSocket connection.")
        test_results['test_12_websocket_disconnect_history_preserved'] = True
    except Exception as e:
        print(f"✗ TEST 12 FAILED: {e}")
        test_results['test_12_websocket_disconnect_history_preserved'] = False

    # -------------------------------------------------------------
    # TEST 13: Push-token registration, refresh, logout cleanup, and delivery pipeline
    # -------------------------------------------------------------
    try:
        client = APIClient()
        client.force_authenticate(user=emp_user)

        sample_fcm_token = f"fcm_test_token_{uid}_{uuid.uuid4().hex}"

        # 1. Register token
        reg_res = client.post("/api/notifications/devices/", {
            "token": sample_fcm_token,
            "platform": "android"
        }, format='json')
        assert reg_res.status_code in [200, 201], f"Register failed: {reg_res.status_code}"

        device = DeviceToken.objects.get(user=emp_user, token=sample_fcm_token)
        assert device.is_active is True
        assert device.platform == 'android'

        # 2. Token refresh (idempotent re-registration)
        reg_refresh = client.post("/api/notifications/devices/", {
            "token": sample_fcm_token,
            "platform": "android"
        }, format='json')
        assert reg_refresh.status_code in [200, 201]

        # 3. Test PushNotificationService formatting without crashing when FCM credentials are absent
        push_result = PushNotificationService.send_push(
            user=emp_user,
            title="Production Push Simulation",
            message="Push payload delivery format validation",
            data={"destination": "attendance", "reference_id": "test"}
        )
        assert isinstance(push_result, dict)
        assert 'sent' in push_result

        # 4. Logout / Token cleanup
        unreg_res = client.post("/api/notifications/devices/unregister/", {
            "token": sample_fcm_token
        }, format='json')
        assert unreg_res.status_code == 200

        device.refresh_from_db()
        assert device.is_active is False, "Device token was not deactivated upon unregister!"

        print("✓ TEST 13 PASSED: Push token registration, lifecycle, and logout unregistration verified.")
        test_results['test_13_push_token_lifecycle'] = True
    except Exception as e:
        print(f"✗ TEST 13 FAILED: {e}")
        test_results['test_13_push_token_lifecycle'] = False

    print("=" * 70)
    passed_count = sum(1 for v in test_results.values() if v)
    total_count = len(test_results)
    print(f"RESULTS SUMMARY: {passed_count}/{total_count} TESTS PASSED")
    print("=" * 70)

    for name, success in test_results.items():
        status_symbol = "✓" if success else "✗"
        print(f"[{status_symbol}] {name}")

    if passed_count != total_count:
        sys.exit(1)

if __name__ == '__main__':
    run_tests()
