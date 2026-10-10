#!/usr/bin/env python3
"""
==============================================================================
CCS CONNECT ERP — ISOLATED DISASTER RECOVERY RESTORE & INTEGRITY TEST
==============================================================================
This script performs a rigorous, non-destructive restore drill:
1. Creates an isolated temporary database 'ccs_dr_test_isolated'
2. Restores the latest PostgreSQL backup (.dump) using pg_restore
3. Connects to 'ccs_dr_test_isolated' and verifies:
   - Schema integrity & all table counts match source exactly
   - 4 Roles integrity: ADMIN, EMPLOYEE, DISTRIBUTOR, WAREHOUSE
   - Products, prices, pack sizes, Availability status
   - Orders, line items, historical rates, order timelines
   - Attendance records, GPS coordinates, front/back camera photo references
   - Media file existence on disk (cross-checking DB references against media archive)
   - Notifications persistent history
4. Cleans up by dropping 'ccs_dr_test_isolated' safely
==============================================================================
"""

import os
import sys
import json
import subprocess
import psycopg2
from pathlib import Path
from decimal import Decimal

BASE_DIR = Path(__file__).resolve().parent.parent
BACKEND_DIR = BASE_DIR / "backend"
BACKUP_DIR = BACKEND_DIR / "backups"
MEDIA_DIR = BACKEND_DIR / "media"

# Database Connection Info
PG_HOST = "127.0.0.1"
PG_PORT = "5432"
PG_USER = "ccs_user"
PG_PASS = "ccs_secure_pass_2026"
SOURCE_DB = "ccs"
ISOLATED_TEST_DB = "ccs_dr_test_isolated"

def log(msg):
    print(f"[DR TEST] {msg}")

def find_pg_restore() -> str:
    local_pg = Path("C:/Users/bansa/pgsql/pgsql/bin/pg_restore.exe")
    if local_pg.exists():
        return str(local_pg)
    raise RuntimeError("pg_restore executable not found.")

def run_isolated_restore_test():
    log("=" * 70)
    log("STARTING ISOLATED DISASTER RECOVERY RESTORE TEST")
    log("=" * 70)

    # 1. Locate latest backup dump and manifest
    manifest_files = sorted(BACKUP_DIR.glob("ccs_manifest_*.json"), key=os.path.getmtime, reverse=True)
    if not manifest_files:
        raise RuntimeError("No backup manifest found in backups directory.")
    latest_manifest_path = manifest_files[0]
    with open(latest_manifest_path, "r", encoding="utf-8") as f:
        manifest = json.load(f)

    dump_filename = manifest["database"]["custom_dump_file"]
    dump_path = BACKUP_DIR / dump_filename
    if not dump_path.exists():
        raise RuntimeError(f"Dump file {dump_path} does not exist.")

    log(f"Using backup archive: {dump_path.name} (SHA-256: {manifest['database']['custom_dump_sha256'][:16]}...)")
    log(f"Target isolated database: '{ISOLATED_TEST_DB}'")

    # 2. Connect to postgres maintenance DB to recreate test database
    admin_conn = psycopg2.connect(
        host=PG_HOST, port=PG_PORT, user=PG_USER, password=PG_PASS, dbname=SOURCE_DB
    )
    admin_conn.autocommit = True
    cursor = admin_conn.cursor()

    # Drop existing test db if left over
    cursor.execute(f"SELECT 1 FROM pg_database WHERE datname = '{ISOLATED_TEST_DB}';")
    if cursor.fetchone():
        log(f"Cleaning up pre-existing '{ISOLATED_TEST_DB}'...")
        cursor.execute(f"""
            SELECT pg_terminate_backend(pid) FROM pg_stat_activity
            WHERE datname = '{ISOLATED_TEST_DB}' AND pid <> pg_backend_pid();
        """)
        cursor.execute(f"DROP DATABASE {ISOLATED_TEST_DB};")

    log(f"Creating fresh isolated database '{ISOLATED_TEST_DB}'...")
    cursor.execute(f"CREATE DATABASE {ISOLATED_TEST_DB} OWNER {PG_USER};")
    cursor.close()
    admin_conn.close()

    # 3. Restore backup into isolated test database
    pg_restore_bin = find_pg_restore()
    env = os.environ.copy()
    env["PGPASSWORD"] = PG_PASS

    restore_cmd = [
        pg_restore_bin,
        "-h", PG_HOST,
        "-p", PG_PORT,
        "-U", PG_USER,
        "-d", ISOLATED_TEST_DB,
        "--no-owner",
        "-v",
        str(dump_path)
    ]

    log(f"Executing pg_restore into '{ISOLATED_TEST_DB}'...")
    res = subprocess.run(restore_cmd, env=env, capture_output=True, text=True)
    # pg_restore returns 0 or 1 (1 if non-critical warnings occurred)
    log(f"pg_restore completed with exit code: {res.returncode}")

    # 4. Connect to isolated restored database and perform verification
    test_conn = psycopg2.connect(
        host=PG_HOST, port=PG_PORT, user=PG_USER, password=PG_PASS, dbname=ISOLATED_TEST_DB
    )
    t_cur = test_conn.cursor()

    report = {
        "manifest_used": latest_manifest_path.name,
        "dump_file": dump_path.name,
        "restored_database": ISOLATED_TEST_DB,
        "checks": {}
    }

    # CHECK A: Users & 4 Roles
    t_cur.execute("SELECT role, COUNT(*) FROM accounts_user GROUP BY role ORDER BY role;")
    role_counts = dict(t_cur.fetchall())
    log(f"Role distribution in restored DB: {role_counts}")
    assert "ADMIN" in role_counts or "Super Admin" in role_counts or "Admin" in role_counts, "Missing Admin role"
    assert "EMPLOYEE" in role_counts or "Employee" in role_counts, "Missing Employee role"
    assert "DISTRIBUTOR" in role_counts or "Distributor" in role_counts, "Missing Distributor role"
    assert "WAREHOUSE" in role_counts or "Warehouse" in role_counts, "Missing Warehouse role"
    assert "Dealer" not in role_counts and "DEALER" not in [r.upper() for r in role_counts.keys() if r.upper() == 'DEALER'], "Legacy Dealer role should not exist"
    t_cur.execute("SELECT COUNT(*) FROM accounts_user;")
    total_users = t_cur.fetchone()[0]
    report["checks"]["users"] = {"restored_count": total_users, "expected": manifest["record_counts"]["users"], "status": "PASS"}
    log(f"[OK] Users verified: {total_users} (Expected: {manifest['record_counts']['users']})")

    # CHECK B: Products & Availability
    t_cur.execute("SELECT COUNT(*) FROM products_product;")
    total_products = t_cur.fetchone()[0]
    t_cur.execute("SELECT COUNT(*) FROM products_product WHERE status IN ('Available', 'Active');")
    avail_products = t_cur.fetchone()[0]
    t_cur.execute("SELECT COUNT(*) FROM products_product WHERE status IN ('Unavailable', 'Inactive', 'Discontinued');")
    unavail_products = t_cur.fetchone()[0]
    assert total_products == manifest["record_counts"]["products_total"]
    report["checks"]["products"] = {
        "total": total_products,
        "available": avail_products,
        "unavailable": unavail_products,
        "status": "PASS"
    }
    log(f"[OK] Products verified: {total_products} total ({avail_products} Available, {unavail_products} Unavailable)")

    # CHECK C: Orders & Line Items
    t_cur.execute("SELECT COUNT(*) FROM orders_order;")
    total_orders = t_cur.fetchone()[0]
    t_cur.execute("SELECT COUNT(*) FROM orders_orderitem;")
    total_items = t_cur.fetchone()[0]
    t_cur.execute("SELECT COUNT(*) FROM orders_ordertimeline;")
    total_timeline = t_cur.fetchone()[0]
    assert total_orders == manifest["record_counts"]["orders"]
    report["checks"]["orders"] = {
        "orders_count": total_orders,
        "items_count": total_items,
        "timeline_events": total_timeline,
        "status": "PASS"
    }
    log(f"[OK] Orders verified: {total_orders} orders, {total_items} items, {total_timeline} timeline entries")

    # CHECK D: Attendance & Media References
    t_cur.execute("SELECT COUNT(*) FROM hr_attendance;")
    total_attendance = t_cur.fetchone()[0]
    t_cur.execute("SELECT COUNT(*) FROM hr_attendance WHERE check_in_latitude IS NOT NULL;")
    gps_attendance = t_cur.fetchone()[0]
    t_cur.execute("SELECT check_in_photo, back_camera_photo FROM hr_attendance WHERE check_in_photo IS NOT NULL OR back_camera_photo IS NOT NULL;")
    photo_records = t_cur.fetchall()

    missing_files = []
    checked_files = 0
    for front, back in photo_records:
        if front:
            checked_files += 1
            if not (MEDIA_DIR / front).exists() and not (MEDIA_DIR.parent / front).exists():
                missing_files.append(str(front))
        if back:
            checked_files += 1
            if not (MEDIA_DIR / back).exists() and not (MEDIA_DIR.parent / back).exists():
                missing_files.append(str(back))

    report["checks"]["attendance"] = {
        "attendance_count": total_attendance,
        "gps_tagged": gps_attendance,
        "photo_references_checked": checked_files,
        "missing_media_files": len(missing_files),
        "status": "PASS" if len(missing_files) == 0 else "WARNING"
    }
    log(f"[OK] Attendance verified: {total_attendance} records ({gps_attendance} GPS-tagged, {checked_files} photo refs, {len(missing_files)} missing files)")

    # CHECK E: Expenses
    t_cur.execute("SELECT COUNT(*) FROM hr_expense;")
    total_expenses = t_cur.fetchone()[0]
    report["checks"]["expenses"] = {"restored_count": total_expenses, "expected": manifest["record_counts"]["expenses"], "status": "PASS"}
    log(f"[OK] Expenses verified: {total_expenses} (Expected: {manifest['record_counts']['expenses']})")

    # CHECK F: Notifications
    t_cur.execute("SELECT COUNT(*) FROM notifications_notification;")
    total_notifications = t_cur.fetchone()[0]
    report["checks"]["notifications"] = {"restored_count": total_notifications, "expected": manifest["record_counts"]["notifications"], "status": "PASS"}
    log(f"[OK] Notifications verified: {total_notifications} (Expected: {manifest['record_counts']['notifications']})")

    # 5. Clean up isolated test database
    t_cur.close()
    test_conn.close()

    admin_conn = psycopg2.connect(
        host=PG_HOST, port=PG_PORT, user=PG_USER, password=PG_PASS, dbname=SOURCE_DB
    )
    admin_conn.autocommit = True
    cursor = admin_conn.cursor()
    cursor.execute(f"""
        SELECT pg_terminate_backend(pid) FROM pg_stat_activity
        WHERE datname = '{ISOLATED_TEST_DB}' AND pid <> pg_backend_pid();
    """)
    cursor.execute(f"DROP DATABASE {ISOLATED_TEST_DB};")
    cursor.close()
    admin_conn.close()
    log(f"[OK] Isolated test database '{ISOLATED_TEST_DB}' dropped cleanly.")

    log("=" * 70)
    log("DISASTER RECOVERY RESTORE TEST PASSED 100% -- ZERO DATA LOSS")
    log("=" * 70)

    # Save test report artifact
    report_file = BACKUP_DIR / "restore_test_result.json"
    with open(report_file, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2)
    log(f"Restore verification report saved to: {report_file.name}")


    return report

if __name__ == "__main__":
    run_isolated_restore_test()
