import os
import sys
import uuid
from decimal import Decimal
import openpyxl

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
from apps.accounts.models import User, UserRole, UserStatus
from apps.products.models import Product, Brand
from apps.orders.models import Order, OrderItem, OrderStatus

def run_tests():
    print("=" * 75)
    print("CCS CONNECT - STEP 1 PRODUCT IMPORT VERIFICATION TEST SUITE")
    print("=" * 75)

    test_results = {}
    uid = uuid.uuid4().hex[:6]

    # Setup test role users
    admin_user = User.objects.filter(role=UserRole.ADMIN).first()
    if not admin_user:
        admin_user = User.objects.create_superuser(
            username=f'admin_step1_{uid}',
            email=f'admin_step1_{uid}@ccs.com',
            password='TestPassword@123',
            role=UserRole.ADMIN
        )

    emp_user = User.objects.filter(role=UserRole.EMPLOYEE, status=UserStatus.APPROVED).first()
    if not emp_user:
        emp_user = User.objects.create_user(
            username=f'emp_step1_{uid}',
            email=f'emp_step1_{uid}@ccs.com',
            password='TestPassword@123',
            role=UserRole.EMPLOYEE,
            status=UserStatus.APPROVED
        )

    dist_user = User.objects.filter(role=UserRole.DISTRIBUTOR, status=UserStatus.APPROVED).first()
    if not dist_user:
        dist_user = User.objects.create_user(
            username=f'dist_step1_{uid}',
            email=f'dist_step1_{uid}@ccs.com',
            password='TestPassword@123',
            role=UserRole.DISTRIBUTOR,
            status=UserStatus.APPROVED
        )

    wh_user = User.objects.filter(role=UserRole.WAREHOUSE).first()
    if not wh_user:
        wh_user = User.objects.create_user(
            username=f'wh_step1_{uid}',
            email=f'wh_step1_{uid}@ccs.com',
            password='TestPassword@123',
            role=UserRole.WAREHOUSE
        )

    # -------------------------------------------------------------
    # TEST 1: Database Counts & Integrity
    # -------------------------------------------------------------
    try:
        total_products = Product.objects.count()
        assert total_products == 129, f"Expected 129 products in PostgreSQL, found {total_products}"

        # Count how many imported products have positive dealer_price
        priced_products = Product.objects.filter(dealer_price__gt=0).count()
        assert priced_products >= 122, f"Expected at least 122 products with dealer_price > 0, found {priced_products}"

        print(f"✓ TEST 1 PASSED: PostgreSQL holds exactly {total_products} products (7 baseline + 122 imported).")
        test_results['test_1_db_count_integrity'] = True
    except Exception as e:
        print(f"✗ TEST 1 FAILED: {e}")
        test_results['test_1_db_count_integrity'] = False

    # -------------------------------------------------------------
    # TEST 2: Excel Workbook Cross-Verification (Every Valid Row Matches)
    # -------------------------------------------------------------
    try:
        excel_path = os.path.join(settings.BASE_DIR, '..', 'ccsps', 'ccs-partners-', 'CHITRA_CROP_SCIENCE_PRODUCT_PRICE_LIST.xlsx')
        wb = openpyxl.load_workbook(excel_path, data_only=True)
        sheet = wb['Product Prices']

        matched_count = 0
        skipped_count = 0

        for r in range(2, sheet.max_row + 1):
            pname = sheet.cell(row=r, column=1).value
            tech = sheet.cell(row=r, column=2).value
            pack = sheet.cell(row=r, column=3).value
            price_val = sheet.cell(row=r, column=4).value

            if pname is None and tech is None and pack is None and price_val is None:
                continue

            # check validity
            valid_price = False
            num_price = None
            if price_val not in [None, '', 'NA', 'N/A']:
                try:
                    num_price = float(str(price_val).replace(',', '').strip())
                    if num_price > 0:
                        valid_price = True
                except:
                    pass

            if pname and pack and valid_price:
                # Must exist in DB
                db_item = Product.objects.filter(
                    name__iexact=str(pname).strip(),
                    pack_size__iexact=str(pack).strip()
                ).first()
                assert db_item is not None, f"Valid Excel row {r} '{pname}' ({pack}) not found in PostgreSQL!"
                assert float(db_item.dealer_price) == num_price, (
                    f"Price mismatch for '{pname}' ({pack}): DB={db_item.dealer_price}, Excel={num_price}"
                )
                matched_count += 1
            else:
                skipped_count += 1

        assert matched_count == 122, f"Expected 122 matched rows, got {matched_count}"
        assert skipped_count == 398, f"Expected 398 skipped rows, got {skipped_count}"
        print(f"✓ TEST 2 PASSED: All 122 valid Excel rows exactly match PostgreSQL records and prices.")
        test_results['test_2_excel_cross_verification'] = True
    except Exception as e:
        print(f"✗ TEST 2 FAILED: {e}")
        test_results['test_2_excel_cross_verification'] = False

    # -------------------------------------------------------------
    # TEST 3: Multi-Pack Size Distinction
    # -------------------------------------------------------------
    try:
        # ACTIVE 100 has 6 different pack sizes in Excel:
        # 100 ml (100), 1 Ltr (750), 250 ml (210), 500 ml (390), 5 Ltr (3600), 5 ml (148)
        active_100_skus = Product.objects.filter(name__iexact='ACTIVE 100')
        assert active_100_skus.count() == 6, f"Expected 6 pack sizes for ACTIVE 100, got {active_100_skus.count()}"

        expected_prices = {
            '100 ml': Decimal('100.00'),
            '250 ml': Decimal('210.00'),
            '500 ml': Decimal('390.00'),
            '1 Ltr': Decimal('750.00'),
            '5 Ltr': Decimal('3600.00'),
            '5 ml': Decimal('148.00'),
        }

        for sku in active_100_skus:
            exp_p = expected_prices.get(sku.pack_size)
            assert exp_p is not None, f"Unexpected pack size '{sku.pack_size}' for ACTIVE 100"
            assert sku.dealer_price == exp_p, f"ACTIVE 100 ({sku.pack_size}) price mismatch: {sku.dealer_price} != {exp_p}"

        print("✓ TEST 3 PASSED: Multiple pack sizes for the same product remain completely distinct with separate prices.")
        test_results['test_3_multi_pack_distinction'] = True
    except Exception as e:
        print(f"✗ TEST 3 FAILED: {e}")
        test_results['test_3_multi_pack_distinction'] = False

    # -------------------------------------------------------------
    # TEST 4: Admin Product Master API Access
    # -------------------------------------------------------------
    try:
        client = APIClient()
        client.force_authenticate(user=admin_user)
        res = client.get("/api/products/")
        assert res.status_code == 200, f"Admin product list failed: {res.status_code}"
        data = res.data if isinstance(res.data, list) else res.data.get('results', [])
        assert len(data) == 129, f"Admin API returned {len(data)} products instead of 129"

        # Check serialization fields
        sample = data[0]
        assert 'name' in sample
        assert 'pack_size' in sample
        assert 'dealer_price' in sample
        assert 'code' in sample
        assert 'price' in sample

        print("✓ TEST 4 PASSED: Admin retrieved all 129 products with correct field serialization.")
        test_results['test_4_admin_api_access'] = True
    except Exception as e:
        print(f"✗ TEST 4 FAILED: {e}")
        test_results['test_4_admin_api_access'] = False

    # -------------------------------------------------------------
    # TEST 5: Employee Product Search & Catalog API
    # -------------------------------------------------------------
    try:
        client = APIClient()
        client.force_authenticate(user=emp_user)

        # Search for 'Spreader' (technical name of ACTIVE 100) or 'Chlorpyriphos' (ATTACK)
        res = client.get("/api/products/?search=Chlorpyriphos")
        assert res.status_code == 200
        items = res.data if isinstance(res.data, list) else res.data.get('results', [])
        assert len(items) >= 3, f"Search for 'Chlorpyriphos' returned {len(items)} items, expected >= 3"
        for item in items:
            assert 'chlorpyri' in item['technical_name'].lower() or 'attack' in item['name'].lower()

        print("✓ TEST 5 PASSED: Employee successfully searched products by technical composition and brand.")
        test_results['test_5_employee_search_api'] = True
    except Exception as e:
        print(f"✗ TEST 5 FAILED: {e}")
        test_results['test_5_employee_search_api'] = False

    # -------------------------------------------------------------
    # TEST 6: Distributor Product Catalog Access
    # -------------------------------------------------------------
    try:
        client = APIClient()
        client.force_authenticate(user=dist_user)
        res = client.get("/api/products/")
        assert res.status_code == 200
        items = res.data if isinstance(res.data, list) else res.data.get('results', [])
        assert len(items) == 129

        print("✓ TEST 6 PASSED: Distributor successfully retrieved authorized product catalog.")
        test_results['test_6_distributor_catalog_access'] = True
    except Exception as e:
        print(f"✗ TEST 6 FAILED: {e}")
        test_results['test_6_distributor_catalog_access'] = False

    # -------------------------------------------------------------
    # TEST 7: Warehouse SKU Visibility
    # -------------------------------------------------------------
    try:
        client = APIClient()
        client.force_authenticate(user=wh_user)
        res = client.get("/api/products/")
        assert res.status_code == 200
        items = res.data if isinstance(res.data, list) else res.data.get('results', [])
        assert len(items) == 129

        print("✓ TEST 7 PASSED: Warehouse officer successfully accessed SKU and pack size catalog.")
        test_results['test_7_warehouse_sku_visibility'] = True
    except Exception as e:
        print(f"✗ TEST 7 FAILED: {e}")
        test_results['test_7_warehouse_sku_visibility'] = False

    # -------------------------------------------------------------
    # TEST 8: Server-Side Authoritative Pricing Enforcement
    # -------------------------------------------------------------
    try:
        # Pick an active product with stock (e.g. Master Test Bio-Zyme Gold 1L)
        test_product = Product.objects.filter(stock__gt=10).first()
        assert test_product is not None, "No stocked test product found"

        client = APIClient()
        client.force_authenticate(user=emp_user)

        # Attacker tries to submit fraudulent price of 1.00
        order_payload = {
            'dealer': str(dist_user.id),
            'items': [
                {
                    'product_id': str(test_product.id),
                    'quantity': 2,
                    'price': 1.00 # Fraudulent price
                }
            ],
            'remarks': 'Pricing security verification order'
        }

        res = client.post("/api/orders/", order_payload, format='json')
        assert res.status_code == 201, f"Order creation failed: {res.status_code} - {res.data}"

        created_order_id = res.data['id']
        order = Order.objects.get(id=created_order_id)
        item = order.items.first()

        expected_rate = test_product.dealer_price if test_product.dealer_price > 0 else test_product.mrp
        assert item.rate == expected_rate, (
            f"SECURITY BREACH: Order accepted fraudulent rate {item.rate} instead of authoritative {expected_rate}!"
        )

        expected_subtotal = expected_rate * 2
        assert order.subtotal == expected_subtotal, f"Subtotal mismatch: {order.subtotal} != {expected_subtotal}"

        print(f"✓ TEST 8 PASSED: Server-side pricing strictly enforced; fraudulent client rate was rejected.")
        test_results['test_8_pricing_security_enforcement'] = True
    except Exception as e:
        print(f"✗ TEST 8 FAILED: {e}")
        test_results['test_8_pricing_security_enforcement'] = False

    # -------------------------------------------------------------
    # TEST 9: Stock Security Rule (Zero Stock Ordering Prevented)
    # -------------------------------------------------------------
    try:
        # Newly imported product has stock=0
        zero_stock_prod = Product.objects.filter(stock=0, dealer_price__gt=0).first()
        assert zero_stock_prod is not None

        client = APIClient()
        client.force_authenticate(user=emp_user)

        order_payload = {
            'dealer': str(dist_user.id),
            'items': [
                {
                    'product_id': str(zero_stock_prod.id),
                    'quantity': 1
                }
            ]
        }

        res = client.post("/api/orders/", order_payload, format='json')
        assert res.status_code == 400, f"Expected 400 for out of stock product, got {res.status_code}"
        assert 'out of stock' in str(res.data).lower()

        print("✓ TEST 9 PASSED: Out-of-stock ordering prevention preserved for newly imported zero-stock catalog items.")
        test_results['test_9_stock_security_rule'] = True
    except Exception as e:
        print(f"✗ TEST 9 FAILED: {e}")
        test_results['test_9_stock_security_rule'] = False

    # -------------------------------------------------------------
    # TEST 10: Preserved Values (No fabricated MRP or fake values)
    # -------------------------------------------------------------
    try:
        # Check that none of the newly imported products have invented values
        new_products = Product.objects.filter(dealer_price__gt=0).exclude(
            name__in=['LIVE-TEST Bio-Growth Ultra', 'Test Product - Bio Shield X', 'Chitra Bio-Shield Ultra',
                     'Chitra Audit Bio-Shield 1L', 'Chitra Bio-Shield Max (Workflow Test SKU)',
                     'Master Test Bio-Zyme Gold 1L', 'Chitra Bio Shield Mobile']
        )
        assert new_products.count() == 122

        for p in new_products:
            assert p.mrp == Decimal('0.00'), f"Invented MRP detected on {p.name}: {p.mrp}"
            assert p.stock == 0, f"Invented stock detected on {p.name}: {p.stock}"
            assert p.distributor_price == Decimal('0.00'), f"Invented distributor price on {p.name}: {p.distributor_price}"

        print("✓ TEST 10 PASSED: Unprovided workbook attributes (MRP, stock, dist price) safely preserved as 0 without fabrication.")
        test_results['test_10_uninvented_values_preserved'] = True
    except Exception as e:
        print(f"✗ TEST 10 FAILED: {e}")
        test_results['test_10_uninvented_values_preserved'] = False

    print("=" * 75)
    passed_count = sum(1 for v in test_results.values() if v)
    total_count = len(test_results)
    print(f"RESULTS SUMMARY: {passed_count}/{total_count} TESTS PASSED")
    print("=" * 75)

    for name, success in test_results.items():
        status_symbol = "✓" if success else "✗"
        print(f"[{status_symbol}] {name}")

    if passed_count != total_count:
        sys.exit(1)

if __name__ == '__main__':
    run_tests()
