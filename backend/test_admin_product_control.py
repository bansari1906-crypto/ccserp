import os
import django
from decimal import Decimal

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'ccs_backend.settings')
django.setup()

from rest_framework.test import APIClient
from apps.accounts.models import User, UserRole
from apps.products.models import Product, Category
from apps.orders.models import Order, OrderItem, OrderStatus

def cleanup_test_artifacts():
    """Ensure no test products, orders, or items remain in the database."""
    test_products = Product.objects.filter(name__in=["CCS Bio Shield Pro", "Temp Test Product"])
    for tp in test_products:
        order_ids = list(OrderItem.objects.filter(product=tp).values_list('order_id', flat=True))
        OrderItem.objects.filter(product=tp).delete()
        Order.objects.filter(id__in=order_ids).delete()
    test_products.delete()
    
    # Also clean up any TEST-ORD- orders
    test_orders = Order.objects.filter(order_number__icontains="TEST-ORD-")
    for o in test_orders:
        o.items.all().delete()
        o.delete()

def run_tests():
    print("\n" + "=" * 70)
    print("STARTING TEST SUITE: ADMIN PRODUCT CONTROL & AVAILABILITY WORKFLOW")
    print("=" * 70)

    # 0. Clean up any leftover artifacts from previous runs
    cleanup_test_artifacts()

    # 1. Setup accounts
    admin_user, _ = User.objects.get_or_create(
        username="TEST_ADMIN_CTRL",
        defaults={"role": UserRole.ADMIN, "email": "test_admin_ctrl@example.com", "is_staff": True}
    )
    admin_user.set_password("Admin@2026")
    admin_user.role = UserRole.ADMIN
    admin_user.save()

    emp_user, _ = User.objects.get_or_create(
        username="TEST_EMP_CTRL",
        defaults={"role": UserRole.EMPLOYEE, "email": "test_emp_ctrl@example.com"}
    )
    emp_user.set_password("Emp@2026")
    emp_user.role = UserRole.EMPLOYEE
    emp_user.save()

    dist_user, _ = User.objects.get_or_create(
        username="TEST_DIST_CTRL",
        defaults={"role": UserRole.DISTRIBUTOR, "email": "test_dist_ctrl@example.com"}
    )
    dist_user.set_password("Dist@2026")
    dist_user.role = UserRole.DISTRIBUTOR
    dist_user.save()

    wh_user, _ = User.objects.get_or_create(
        username="TEST_WH_CTRL",
        defaults={"role": UserRole.WAREHOUSE, "email": "test_wh_ctrl@example.com"}
    )
    wh_user.set_password("Wh@2026")
    wh_user.role = UserRole.WAREHOUSE
    wh_user.save()

    admin_client = APIClient()
    admin_client.force_authenticate(user=admin_user)

    emp_client = APIClient()
    emp_client.force_authenticate(user=emp_user)

    dist_client = APIClient()
    dist_client.force_authenticate(user=dist_user)

    wh_client = APIClient()
    wh_client.force_authenticate(user=wh_user)

    prod_id = None
    order_id = None

    try:
        # ---------------------------------------------------------
        # TEST 1: Admin Product Management (Add, Edit, Availability)
        # ---------------------------------------------------------
        print("\n[TEST 1] Testing Admin Product Management (Add / Edit / Toggle Availability)...")
        create_payload = {
            "name": "CCS Bio Shield Pro",
            "technical_name": "Trichoderma Viride 1.5% WP",
            "category": "Bio Products",
            "pack_size": "1 Kg",
            "dealer_price": "650.00",
            "mrp": "850.00",
            "distributor_price": "572.00",
            "gst": "18.00",
            "status": "Available"
        }
        res = admin_client.post("/api/products/", create_payload, format="json")
        assert res.status_code == 201, f"Admin create failed: {res.status_code} {res.data}"
        prod_id = res.data["id"]
        print(f"  [PASS] Admin created product '{res.data['name']}' with ID {prod_id} and status {res.data['status']}")

        # Edit product
        edit_payload = {
            "dealer_price": "680.00",
            "mrp": "890.00",
            "status": "Unavailable"
        }
        res_edit = admin_client.patch(f"/api/products/{prod_id}/", edit_payload, format="json")
        assert res_edit.status_code == 200, f"Admin edit failed: {res_edit.status_code} {res_edit.data}"
        assert res_edit.data["status"] == "Unavailable"
        assert Decimal(str(res_edit.data["dealer_price"])) == Decimal("680.00")
        print("  [PASS] Admin updated product price to 680.00 and status to 'Unavailable'")

        # Toggle back to Available
        res_avail = admin_client.patch(f"/api/products/{prod_id}/", {"status": "Available"}, format="json")
        assert res_avail.status_code == 200
        assert res_avail.data["status"] == "Available"
        print("  [PASS] Admin toggled product status back to 'Available'")

        # ---------------------------------------------------------
        # TEST 2: Role Authorization Checks (Non-Admin Mutate Blocked)
        # ---------------------------------------------------------
        print("\n[TEST 2] Testing Unauthorized Roles (Employee, Distributor, Warehouse blocked from mutating)...")
        for client, role_name in [(emp_client, "EMPLOYEE"), (dist_client, "DISTRIBUTOR"), (wh_client, "WAREHOUSE")]:
            # Attempt POST
            res_post = client.post("/api/products/", create_payload, format="json")
            assert res_post.status_code == 403, f"{role_name} should receive 403 on POST, got {res_post.status_code}"

            # Attempt PATCH
            res_patch = client.patch(f"/api/products/{prod_id}/", {"status": "Unavailable"}, format="json")
            assert res_patch.status_code == 403, f"{role_name} should receive 403 on PATCH, got {res_patch.status_code}"

            # Attempt DELETE
            res_del = client.delete(f"/api/products/{prod_id}/")
            assert res_del.status_code == 403, f"{role_name} should receive 403 on DELETE, got {res_del.status_code}"
            print(f"  [PASS] {role_name} blocked with 403 Forbidden on create, update, and delete")

        # ---------------------------------------------------------
        # TEST 3: Safe Deletion vs Order History Deletion Protection
        # ---------------------------------------------------------
        print("\n[TEST 3] Testing Product Deletion Protection with Order History...")
        # 3a. Product with no orders can be deleted
        temp_res = admin_client.post("/api/products/", {
            "name": "Temp Test Product",
            "category": "Seeds",
            "pack_size": "500 g",
            "dealer_price": "200.00",
            "status": "Available"
        }, format="json")
        temp_id = temp_res.data["id"]
        del_res = admin_client.delete(f"/api/products/{temp_id}/")
        assert del_res.status_code == 204, f"Deleting unused product should return 204, got {del_res.status_code}"
        print("  [PASS] Unused product safely deleted (204 No Content)")

        # 3b. Product with order history CANNOT be deleted
        order = Order.objects.create(
            order_number=f"TEST-ORD-{prod_id[:6]}",
            dealer=dist_user,
            created_by=admin_user,
            status=OrderStatus.PENDING_APPROVAL,
            subtotal=Decimal("680.00"),
            gst_total=Decimal("122.40"),
            grand_total=Decimal("802.40")
        )
        product_obj = Product.objects.get(id=prod_id)
        OrderItem.objects.create(
            order=order,
            product=product_obj,
            quantity=1,
            rate=Decimal("680.00"),
            discount=Decimal("0.00"),
            gst_percent=Decimal("18.00"),
            total=Decimal("802.40")
        )
        del_protected_res = admin_client.delete(f"/api/products/{prod_id}/")
        assert del_protected_res.status_code == 400, f"Expected 400 protected error, got {del_protected_res.status_code}"
        assert "Cannot permanently delete" in del_protected_res.data["error"]
        assert "order history" in del_protected_res.data["error"]
        assert del_protected_res.data.get("can_deactivate") is True
        print(f"  [PASS] Deletion prevented: '{del_protected_res.data['error']}'")

        # Deactivating instead
        deact_res = admin_client.patch(f"/api/products/{prod_id}/", {"status": "Unavailable"}, format="json")
        assert deact_res.status_code == 200
        assert deact_res.data["status"] == "Unavailable"
        print("  [PASS] Safe deactivation (setting status to Unavailable) succeeded")

        # Clean up test order
        order.items.all().delete()
        order.delete()

        # ---------------------------------------------------------
        # TEST 4: Availability-Based Order Creation Workflow
        # ---------------------------------------------------------
        print("\n[TEST 4] Testing Availability-Based Order Creation...")
        product_obj.status = "Unavailable"
        product_obj.stock = 0 # No stock required
        product_obj.save()

        # 4a. Order creation with Unavailable product should fail with clear message
        order_payload_fail = {
            "dealer": str(dist_user.id),
            "items": [
                {"product": str(product_obj.id), "quantity": 5}
            ]
        }
        fail_create_res = admin_client.post("/api/orders/", order_payload_fail, format="json")
        assert fail_create_res.status_code == 400, f"Ordering unavailable product must return 400, got {fail_create_res.status_code}"
        assert "Unavailable" in fail_create_res.data["error"], f"Error message should mention Unavailable: {fail_create_res.data}"
        print(f"  [PASS] Order blocked for Unavailable product: '{fail_create_res.data['error']}'")

        # 4b. Order creation with Available product succeeds (even with stock == 0)
        product_obj.status = "Available"
        product_obj.stock = 0
        product_obj.save()

        order_payload_success = {
            "dealer": str(dist_user.id),
            "items": [
                {"product": str(product_obj.id), "quantity": 10}
            ]
        }
        success_create_res = admin_client.post("/api/orders/", order_payload_success, format="json")
        assert success_create_res.status_code == 201, f"Ordering available product should succeed, got {success_create_res.status_code} {success_create_res.data}"
        order_id = success_create_res.data["id"]
        print(f"  [PASS] Order created successfully for Available product (Order ID: {order_id}, Stock: {product_obj.stock})")

        # ---------------------------------------------------------
        # TEST 5: Availability Validation Before Admin Approval
        # ---------------------------------------------------------
        print("\n[TEST 5] Testing Product Availability Check Before Admin Approval...")
        # 5a. If product becomes Unavailable before Admin approves, approval MUST BE BLOCKED
        product_obj.status = "Unavailable"
        product_obj.save()

        approve_fail_res = admin_client.post(f"/api/orders/{order_id}/approve/")
        assert approve_fail_res.status_code == 400, f"Approving order with unavailable item should fail with 400, got {approve_fail_res.status_code}"
        assert "Unavailable" in approve_fail_res.data["error"]
        assert product_obj.name in approve_fail_res.data["error"]
        print(f"  [PASS] Approval blocked because product became unavailable: '{approve_fail_res.data['error']}'")

        # Verify order was NOT approved and remains in Pending Approval
        rechecked_order = Order.objects.get(id=order_id)
        assert rechecked_order.status == OrderStatus.PENDING_APPROVAL
        print("  [PASS] Order remained in Pending Approval stage (not prematurely changed)")

        # 5b. When product is Available, approval succeeds without stock deduction
        product_obj.status = "Available"
        product_obj.save()

        approve_success_res = admin_client.post(f"/api/orders/{order_id}/approve/")
        assert approve_success_res.status_code == 200, f"Approving order should succeed, got {approve_success_res.status_code} {approve_success_res.data}"
        rechecked_order.refresh_from_db()
        assert rechecked_order.status == OrderStatus.APPROVED
        print(f"  [PASS] Order approved successfully by Admin. Status: {rechecked_order.status}")

        # Verify stock was not deducted or altered
        product_obj.refresh_from_db()
        assert product_obj.stock == 0
        print(f"  [PASS] Verified no stock deduction occurred (Stock remains {product_obj.stock})")

        print("\n" + "=" * 70)
        print("ALL TESTS PASSED SUCCESSFULLY! (100% SUCCESS)")
        print("=" * 70 + "\n")

    finally:
        # Guarantee cleanup even if an assertion or interruption happens
        cleanup_test_artifacts()

if __name__ == "__main__":
    run_tests()
