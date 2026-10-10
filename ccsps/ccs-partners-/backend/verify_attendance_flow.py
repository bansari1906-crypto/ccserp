import os
import django
import json

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'ccs_backend.settings')
django.setup()

from apps.accounts.models import User, UserRole
from apps.hr.models import Attendance, LocationTrack
from rest_framework.test import APIClient
from datetime import date

print("=== VERIFYING ATTENDANCE BACKEND WORKFLOW ===")

# Clean up today's test records for distributor to test cleanly
today = date.today()
emp = User.objects.filter(role=UserRole.DISTRIBUTOR).first()
if not emp:
    emp = User.objects.create(email="testemp@ccs.com", username="testemp", role=UserRole.DISTRIBUTOR)
    emp.set_password("Testing@123")
    emp.save()

admin_user = User.objects.filter(role=UserRole.ADMIN).first()
if not admin_user:
    admin_user = User.objects.create(email="admin@ccs.com", username="admin", role=UserRole.ADMIN)
    admin_user.set_password("Testing@123")
    admin_user.save()

# Clean existing today's attendance for this test employee
Attendance.objects.filter(employee=emp, date=today).delete()
print(f"Testing with Employee: {emp.email} ({emp.username})")
print(f"Testing with Admin: {admin_user.email} ({admin_user.username})")

client_emp = APIClient()
client_emp.force_authenticate(user=emp)

client_admin = APIClient()
client_admin.force_authenticate(user=admin_user)

# Test 1: Check active session before clock in
res = client_emp.get('/api/hr/attendance/active/')
print("\n[TEST 1: Initial Active Check]")
print("Response:", res.status_code, res.data)
assert res.status_code == 200
assert res.data.get('active') is False

# Test 2: Clock In / Start Day with photo and coords
dummy_b64 = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA="
res = client_emp.post('/api/hr/attendance/', {
    'check_in_location': 'Pune Depot (18.5204° N, 73.8567° E)',
    'check_in_latitude': 18.5204,
    'check_in_longitude': 73.8567,
    'check_in_photo': dummy_b64,
    'back_camera_photo': dummy_b64
}, format='json')
print("\n[TEST 2: Clock-In / Start Day with Front Selfie & Back Camera Photo]")
print("Response:", res.status_code, res.data.get('status'), res.data.get('check_in'), res.data.get('current_location'))
assert res.status_code == 201
attendance_id = res.data.get('id')
assert res.data.get('status') == 'Working'
assert res.data.get('is_active') is True

# Directly verify DB record in PostgreSQL / SQLite
att_db = Attendance.objects.get(id=attendance_id)
assert att_db.check_in_photo, "Front selfie was not saved to DB"
assert att_db.back_camera_photo, "Back camera photo was not saved to DB"
print(f"DB Confirmation: Front photo: {att_db.check_in_photo.name}, Back photo: {att_db.back_camera_photo.name}")

# Test 3: Active session check after clock in
res = client_emp.get('/api/hr/attendance/active/')
print("\n[TEST 3: Active Session Check After Clock In]")
print("Active:", res.data.get('active'), "Status:", res.data.get('attendance', {}).get('status'))
assert res.data.get('active') is True
assert res.data.get('attendance', {}).get('status') == 'Working'

# Test 4: Duplicate Clock-In Prevention
res = client_emp.post('/api/hr/attendance/', {
    'check_in_location': 'Another Checkin',
}, format='json')
print("\n[TEST 4: Duplicate Clock-In Prevention]")
print("Response code:", res.status_code, "Error:", res.data.get('error'))
assert res.status_code == 400
assert "already recorded" in res.data.get('error', '').lower()

# Test 5: Live Location Update
res = client_emp.post('/api/hr/attendance/update_location/', {
    'latitude': 18.5310,
    'longitude': 73.8650,
    'location': 'Shivajinagar Market, Pune'
}, format='json')
print("\n[TEST 5: Live Location Update]")
print("Response:", res.status_code, res.data.get('current_location'))
assert res.status_code == 200

# Test 6: Admin Portal Sees Same Real Record
res = client_admin.get('/api/hr/attendance/')
print("\n[TEST 6: Admin Portal Data Sync]")
print("Admin records count:", len(res.data))
emp_records = [r for r in res.data if str(r.get('id')) == str(attendance_id)]
assert len(emp_records) == 1
admin_view = emp_records[0]
print("Admin saw employee record:", admin_view.get('employee_name'), "Status:", admin_view.get('status'), "Location:", admin_view.get('current_location'))
assert admin_view.get('status') == 'Working'
assert 'Shivajinagar' in admin_view.get('current_location')

# Test 7: End Day / Clock Out
res = client_emp.post('/api/hr/attendance/check_out/', {
    'check_out_location': 'Pune Depot Head Office',
    'check_out_latitude': 18.5204,
    'check_out_longitude': 73.8567,
    'check_out_photo': dummy_b64
}, format='json')
print("\n[TEST 7: Clock-Out / End Day]")
print("Response:", res.status_code, "Status:", res.data.get('status'), "Working Hours:", res.data.get('working_hours'), "Check out time:", res.data.get('check_out'))
assert res.status_code == 200
assert res.data.get('status') == 'Present'
assert res.data.get('is_active') is False

# Test 8: Active Session After Clock Out
res = client_emp.get('/api/hr/attendance/active/')
print("\n[TEST 8: Active Session After Clock Out]")
print("Active:", res.data.get('active'), "Completed:", res.data.get('completed'))
assert res.data.get('active') is False
assert res.data.get('completed') is True

# Test 9: Admin Sees Completed Attendance with Final Hours
res = client_admin.get('/api/hr/attendance/')
emp_records = [r for r in res.data if str(r.get('id')) == str(attendance_id)]
assert len(emp_records) == 1
admin_view = emp_records[0]
print("\n[TEST 9: Admin Sees Final Record]")
print("Status:", admin_view.get('status'), "Working hours:", admin_view.get('working_hours'), "Check out:", admin_view.get('check_out'))
assert admin_view.get('status') == 'Present'
assert admin_view.get('check_out') is not None

print("\n>>> ALL 9 BACKEND WORKFLOW TESTS PASSED SUCCESSFULLY! <<<")
