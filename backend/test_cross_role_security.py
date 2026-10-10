import requests

def test_cross_role():
    print("=== TESTING CROSS-ROLE PERMISSIONS ===")
    
    # 1. Employee
    r = requests.post('http://127.0.0.1:8000/api/auth/login/', json={'email_or_username': 'TESTEMP001', 'password': 'TestEmp@2026'}).json()
    emp_token = r['access_token']
    emp_headers = {'Authorization': f'Bearer {emp_token}'}

    # Employee tries Admin API
    r1 = requests.get('http://127.0.0.1:8000/api/admin/dashboard/stats/', headers=emp_headers)
    p1 = "PASS" if r1.status_code == 403 else "FAIL"
    print(f"Employee -> Admin Stats API: Status {r1.status_code} (Expected 403) - {p1}")

    # Employee tries Warehouse API
    r2 = requests.get('http://127.0.0.1:8000/api/inventory/warehouses/', headers=emp_headers)
    p2 = "PASS" if r2.status_code == 403 else "FAIL"
    print(f"Employee -> Warehouse API: Status {r2.status_code} (Expected 403) - {p2}")

    # Employee accesses HR Attendance
    r3 = requests.get('http://127.0.0.1:8000/api/hr/attendance/active/', headers=emp_headers)
    p3 = "PASS" if r3.status_code == 200 else "FAIL"
    print(f"Employee -> HR Attendance API: Status {r3.status_code} (Expected 200) - {p3}")

    # 2. Distributor
    r = requests.post('http://127.0.0.1:8000/api/auth/login/', json={'email_or_username': 'TESTDIST001', 'password': 'TestDist@2026'}).json()
    dist_token = r['access_token']
    dist_headers = {'Authorization': f'Bearer {dist_token}'}

    # Distributor tries Admin API
    r4 = requests.get('http://127.0.0.1:8000/api/admin/dashboard/stats/', headers=dist_headers)
    p4 = "PASS" if r4.status_code == 403 else "FAIL"
    print(f"Distributor -> Admin Stats API: Status {r4.status_code} (Expected 403) - {p4}")

    # Distributor tries HR Attendance
    r5 = requests.get('http://127.0.0.1:8000/api/hr/attendance/active/', headers=dist_headers)
    p5 = "PASS" if r5.status_code == 403 else "FAIL"
    print(f"Distributor -> HR Attendance API: Status {r5.status_code} (Expected 403) - {p5}")

    # Distributor tries Warehouse API
    r6 = requests.get('http://127.0.0.1:8000/api/inventory/warehouses/', headers=dist_headers)
    p6 = "PASS" if r6.status_code == 403 else "FAIL"
    print(f"Distributor -> Warehouse API: Status {r6.status_code} (Expected 403) - {p6}")

    # 3. Warehouse
    r = requests.post('http://127.0.0.1:8000/api/auth/login/', json={'email_or_username': 'TESTWH001', 'password': 'TestWh@2026'}).json()
    wh_token = r['access_token']
    wh_headers = {'Authorization': f'Bearer {wh_token}'}

    # Warehouse tries Admin API
    r7 = requests.get('http://127.0.0.1:8000/api/admin/dashboard/stats/', headers=wh_headers)
    p7 = "PASS" if r7.status_code == 403 else "FAIL"
    print(f"Warehouse -> Admin Stats API: Status {r7.status_code} (Expected 403) - {p7}")

    # Warehouse tries HR Attendance
    r8 = requests.get('http://127.0.0.1:8000/api/hr/attendance/active/', headers=wh_headers)
    p8 = "PASS" if r8.status_code == 403 else "FAIL"
    print(f"Warehouse -> HR Attendance API: Status {r8.status_code} (Expected 403) - {p8}")

    # Warehouse accesses Warehouse API
    r9 = requests.get('http://127.0.0.1:8000/api/inventory/warehouses/', headers=wh_headers)
    p9 = "PASS" if r9.status_code == 200 else "FAIL"
    print(f"Warehouse -> Warehouse API: Status {r9.status_code} (Expected 200) - {p9}")

    # 4. Admin
    r = requests.post('http://127.0.0.1:8000/api/auth/login/', json={'email_or_username': 'CCSADMIN001', 'password': 'CCSAdmin@2026'}).json()
    adm_token = r['access_token']
    adm_headers = {'Authorization': f'Bearer {adm_token}'}

    # Admin accesses Admin API
    r10 = requests.get('http://127.0.0.1:8000/api/admin/dashboard/stats/', headers=adm_headers)
    p10 = "PASS" if r10.status_code == 200 else "FAIL"
    print(f"Admin -> Admin Stats API: Status {r10.status_code} (Expected 200) - {p10}")

    all_passed = all(p == "PASS" for p in [p1, p2, p3, p4, p5, p6, p7, p8, p9, p10])
    print(f"\nOVERALL CROSS-ROLE SECURITY RESULT: {'ALL PASS' if all_passed else 'SOME FAILED'}")

if __name__ == '__main__':
    test_cross_role()
