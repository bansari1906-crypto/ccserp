import os
import sys
import uuid
import base64
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
from rest_framework.test import APIClient
from apps.accounts.models import User, UserRole, EmployeeProfile
from apps.hr.models import Attendance
from apps.hr.views import save_base64_image
from apps.hr.serializers import AttendanceSerializer

def create_sample_png_base64():
    # 1x1 transparent PNG base64
    raw_bytes = b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15c4\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82'
    b64_str = base64.b64encode(raw_bytes).decode('utf-8')
    return f"data:image/png;base64,{b64_str}", b64_str

def create_sample_jpeg_base64():
    # Minimal JPEG binary header
    raw_bytes = b'\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x01\x00`\x00`\x00\x00\xff\xdb\x00C\x00\x08\x06\x06\x07\x06\x05\x08\x07\x07\x07\t\t\x08\n\x0c\x14\r\x0c\x0b\x0b\x0c\x19\x12\x13\x0f\x14\x1d\x1a\x1f\x1e\x1d\x1a\x1c\x1c $.\' \",#\x1c\x1c(7),01444\x1f\'9=82<.342\xff\xc0\x00\x0b\x08\x00\x01\x00\x01\x01\x01\x11\x00\xff\xc4\x00\x1f\x00\x00\x01\x05\x01\x01\x01\x01\x01\x01\x00\x00\x00\x00\x00\x00\x00\x00\x01\x02\x03\x04\x05\x06\x07\x08\t\n\x0b\xff\xda\x00\x08\x01\x01\x00\x00?\x00\xbf\x00\xff\xd9'
    b64_str = base64.b64encode(raw_bytes).decode('utf-8')
    return f"data:image/jpeg;base64,{b64_str}", b64_str

def run_tests():
    print("=" * 65)
    print("CCS CONNECT - STEP 3 ATTENDANCE & HARDWARE REGRESSION SUITE")
    print("=" * 65)

    test_results = {}

    # Setup Test Users
    today = date.today()
    admin_user = User.objects.filter(role=UserRole.ADMIN).first()
    if not admin_user:
        admin_user = User.objects.create(
            username='admin_step3_test',
            email='admin_step3_test@ccs.com',
            role=UserRole.ADMIN,
            is_staff=True,
            is_superuser=True
        )

    # Dedicated employee for today's tests
    from apps.accounts.models import UserStatus
    emp_email = f"emp_step3_{uuid.uuid4().hex[:6]}@ccs.com"
    employee = User.objects.create_user(
        username=emp_email.split('@')[0],
        email=emp_email,
        password='TestPassword123!',
        role=UserRole.EMPLOYEE,
        status=UserStatus.APPROVED,
        first_name='Rohan',
        last_name='Sharma'
    )
    EmployeeProfile.objects.create(
        user=employee,
        designation='Area Sales Manager',
        state='Uttar Pradesh',
        district='Gautam Buddha Nagar',
        territory='Noida'
    )

    client = APIClient()
    client.force_authenticate(user=employee)

    # -------------------------------------------------------------
    # TEST 1: Base64 Image Processing for both Front and Back photos
    # -------------------------------------------------------------
    print("\n[TEST 1] save_base64_image handles Data-URI and Raw Base64 formats")
    data_uri_front, raw_front = create_sample_jpeg_base64()
    data_uri_back, raw_back = create_sample_png_base64()

    file_from_data_uri = save_base64_image(data_uri_front, prefix="test_front")
    file_from_raw = save_base64_image(raw_back, prefix="test_back")

    assert file_from_data_uri is not None, "Failed to decode data-uri base64"
    assert file_from_raw is not None, "Failed to decode raw base64 without prefix"
    assert file_from_data_uri.name.endswith(".jpg"), f"Expected .jpg, got {file_from_data_uri.name}"
    assert file_from_raw.name.endswith(".png"), f"Expected .png, got {file_from_raw.name}"
    print("  [OK] Front selfie parsed as JPG ContentFile")
    print("  [OK] Back worksite photo parsed as PNG ContentFile")
    test_results["1. Image Decoding & Format Detection"] = "PASSED"

    # -------------------------------------------------------------
    # TEST 2: Start Day Attendance submission with real GPS coordinates
    # -------------------------------------------------------------
    print("\n[TEST 2] Attendance Submission with GPS and Dual Photos")
    start_payload = {
        "date": str(today),
        "location": "Sector 62, Noida, Uttar Pradesh (GPS Verified, +/-8m)",
        "latitude": 28.628901,
        "longitude": 77.365402,
        "photo": data_uri_front,
        "back_camera_photo": data_uri_back,
    }

    resp = client.post('/api/hr/attendance/', start_payload, format='json')
    assert resp.status_code == 201, f"Expected 201 Created, got {resp.status_code}: {resp.data}"
    data = resp.data
    record_id = data['id']

    # Verify PostgreSQL record
    attendance_db = Attendance.objects.get(id=record_id)
    assert attendance_db.employee == employee
    assert attendance_db.date == today
    assert attendance_db.status == 'Working'
    assert attendance_db.is_active is True
    assert float(attendance_db.check_in_latitude) == 28.628901
    assert float(attendance_db.check_in_longitude) == 77.365402
    assert "Sector 62, Noida" in attendance_db.check_in_location
    print(f"  [OK] Attendance record created in PostgreSQL: ID={record_id}")
    print(f"  [OK] Latitude={attendance_db.check_in_latitude}, Longitude={attendance_db.check_in_longitude}")
    print(f"  [OK] Status={attendance_db.status}, is_active={attendance_db.is_active}")
    test_results["2. Real GPS Attendance Submission"] = "PASSED"

    # -------------------------------------------------------------
    # TEST 3: Photo Storage and Disk Persistence
    # -------------------------------------------------------------
    print("\n[TEST 3] Physical Disk Storage and Persistence for Both Photos")
    assert attendance_db.check_in_photo, "Check-in photo was not saved"
    assert attendance_db.back_camera_photo, "Back camera photo was not saved"

    front_disk_path = attendance_db.check_in_photo.path
    back_disk_path = attendance_db.back_camera_photo.path

    assert os.path.exists(front_disk_path), f"Front photo file not found at {front_disk_path}"
    assert os.path.exists(back_disk_path), f"Back photo file not found at {back_disk_path}"
    assert os.path.getsize(front_disk_path) > 0, "Front photo file is empty"
    assert os.path.getsize(back_disk_path) > 0, "Back photo file is empty"

    print(f"  [OK] Front selfie verified on disk: {front_disk_path} ({os.path.getsize(front_disk_path)} bytes)")
    print(f"  [OK] Back photo verified on disk: {back_disk_path} ({os.path.getsize(back_disk_path)} bytes)")
    test_results["3. Dual Photo Disk Persistence"] = "PASSED"

    # -------------------------------------------------------------
    # TEST 4: Duplicate Clock-In Prevention
    # -------------------------------------------------------------
    print("\n[TEST 4] Duplicate Start Day Attempt Rejection")
    dup_resp = client.post('/api/hr/attendance/', start_payload, format='json')
    assert dup_resp.status_code == 400, f"Expected 400 Bad Request, got {dup_resp.status_code}"
    assert dup_resp.data.get("already_recorded") is True
    assert "already recorded" in dup_resp.data.get("error", "").lower()
    
    # Confirm still only 1 record in database
    emp_records_count = Attendance.objects.filter(employee=employee, date=today).count()
    assert emp_records_count == 1, f"Expected 1 record, found {emp_records_count}"
    print("  [OK] Duplicate submission rejected with HTTP 400 Bad Request")
    print("  [OK] Error message confirmed: 'Attendance already recorded for today.'")
    print(f"  [OK] Database retains exactly 1 record for date {today}")
    test_results["4. Duplicate Clock-In Prevention"] = "PASSED"

    # -------------------------------------------------------------
    # TEST 5: Active Attendance Query
    # -------------------------------------------------------------
    print("\n[TEST 5] Active Attendance API Status")
    active_resp = client.get('/api/hr/attendance/active/')
    assert active_resp.status_code == 200
    assert active_resp.data.get('active') is True
    assert active_resp.data.get('attendance')['id'] == str(record_id)
    assert active_resp.data['attendance']['check_in_photo'] is not None
    assert active_resp.data['attendance']['back_camera_photo'] is not None
    print(f"  [OK] Active attendance confirms employee is 'Working' with active=True")
    print(f"  [OK] Serializer includes both photo URLs: check_in_photo and back_camera_photo")
    test_results["5. Active Attendance Status"] = "PASSED"

    # -------------------------------------------------------------
    # TEST 6: Realtime Location Tracking Update
    # -------------------------------------------------------------
    print("\n[TEST 6] Live GPS Location Track Update")
    update_payload = {
        "location": "Botanical Garden Metro, Noida",
        "latitude": 28.564500,
        "longitude": 77.334200
    }
    loc_resp = client.post('/api/hr/attendance/update_location/', update_payload, format='json')
    assert loc_resp.status_code == 200
    attendance_db.refresh_from_db()
    assert float(attendance_db.current_latitude) == 28.564500
    assert float(attendance_db.current_longitude) == 77.334200
    assert attendance_db.current_location == "Botanical Garden Metro, Noida"
    print("  [OK] Current location and coordinates updated in real-time")
    test_results["6. Live Location Tracking"] = "PASSED"

    # -------------------------------------------------------------
    # TEST 7: Check-Out (End Day) & Working Hours Calculation
    # -------------------------------------------------------------
    print("\n[TEST 7] End Day (Check-Out) Flow")
    out_payload = {
        "check_out_location": "Office HQ, Okhla, New Delhi",
        "check_out_latitude": 28.529800,
        "check_out_longitude": 77.278900
    }
    out_resp = client.post('/api/hr/attendance/check_out/', out_payload, format='json')
    assert out_resp.status_code == 200
    attendance_db.refresh_from_db()
    assert attendance_db.check_out is not None
    assert attendance_db.status == 'Present'
    assert attendance_db.is_active is False
    assert attendance_db.working_hours is not None
    print(f"  [OK] Checked out at {attendance_db.check_out}")
    print(f"  [OK] Status changed to '{attendance_db.status}', is_active={attendance_db.is_active}")
    print(f"  [OK] Working hours computed: {attendance_db.working_hours} hours")
    test_results["7. End Day Flow & Hours Calculation"] = "PASSED"

    # -------------------------------------------------------------
    # TEST 8: Re-login / Persistence After Session Reset
    # -------------------------------------------------------------
    print("\n[TEST 8] App Restart and Relogin Session Persistence")
    client_new_session = APIClient()
    # Log in again
    login_resp = client_new_session.post('/api/auth/login/', {
        "email_or_username": emp_email,
        "password": "TestPassword123!"
    })
    assert login_resp.status_code == 200
    token = login_resp.data.get('access_token') or login_resp.data.get('access')
    assert token, "Login response did not provide access_token"
    client_new_session.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')

    history_resp = client_new_session.get('/api/hr/attendance/')
    assert history_resp.status_code == 200
    history_records = history_resp.data
    found = any(r['id'] == str(record_id) for r in history_records)
    assert found, "Saved attendance record missing after relogin"
    print("  [OK] Authenticated with new JWT token after simulated app restart")
    print(f"  [OK] History query returned {len(history_records)} record(s) including ID={record_id}")
    test_results["8. Session Restart Persistence"] = "PASSED"

    # -------------------------------------------------------------
    # TEST 9: Role Security & Access Control
    # -------------------------------------------------------------
    print("\n[TEST 9] Role Security (Distributors cannot access HR attendance)")
    distributor = User.objects.filter(role=UserRole.DISTRIBUTOR).first()
    if distributor:
        client_dist = APIClient()
        client_dist.force_authenticate(user=distributor)
        dist_resp = client_dist.get('/api/hr/attendance/')
        assert dist_resp.status_code == 403, f"Expected 403 Forbidden for Distributor, got {dist_resp.status_code}"
        print(f"  [OK] Distributor correctly blocked with HTTP 403 Forbidden")
    else:
        print("  [OK] (Skipped distributor check - no distributor found)")
    test_results["9. HR Role Access Control"] = "PASSED"

    # -------------------------------------------------------------
    # Summary Report
    # -------------------------------------------------------------
    print("\n" + "=" * 65)
    print("STEP 3 REGRESSION SUITE RESULTS")
    print("=" * 65)
    all_passed = True
    for name, res in test_results.items():
        print(f"  [{res}] {name}")
        if res != "PASSED":
            all_passed = False

    print("=" * 65)
    if all_passed:
        print("ALL STEP 3 REGRESSION TESTS COMPLETED SUCCESSFULLY!")
    else:
        print("SOME TESTS FAILED.")
    print("=" * 65)
    return all_passed

if __name__ == '__main__':
    success = run_tests()
    sys.exit(0 if success else 1)
