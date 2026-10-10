# CHITRA CROP SCIENCE — PRODUCT PRICE LIST IMPORT REPORT

- **Workbook**: `C:\Users\bansa\Desktop\CCS\ccsps\ccs-partners-\CHITRA_CROP_SCIENCE_PRODUCT_PRICE_LIST.xlsx`
- **Total Source Rows**: 520
- **Successfully Imported / Valid Rows**: 122
- **New Records Created in PostgreSQL**: 122
- **Existing Records Updated in PostgreSQL**: 0
- **Skipped Rows (NA / Missing / Invalid Price)**: 398
- **Duplicates Detected in File**: 0
- **Price Conflicts**: 0
- **Database Catalog Count**: 7 → 129

## Field Mapping & Business Rationale
- **Workbook `price` Column** → mapped to **`Product.dealer_price`**.
- **Authoritative Rate**: Verified in `backend/apps/orders/views.py` and `test_step2_regressions.py` (`rate = product.dealer_price`).
- **Uninvented Values**: MRP, stock quantity, and distributor price were NOT fabricated; preserved safely.

## Sample Imported Products (Available Prices)

| Row | Product Name | Technical Name | Pack Size | Dealer Price (₹) |
|---|---|---|---|---|
| - | ACTIVE 100 | Silicon Based Super Spreader | 100 ml | ₹100.00 |
| - | ACTIVE 100 | Silicon Based Super Spreader | 1 Ltr | ₹750.00 |
| - | ACTIVE 100 | Silicon Based Super Spreader | 250 ml | ₹210.00 |
| - | ACTIVE 100 | Silicon Based Super Spreader | 500 ml | ₹390.00 |
| - | ACTIVE 100 | Silicon Based Super Spreader | 5 Ltr | ₹3600.00 |
| - | ACTIVE 100 | Silicon Based Super Spreader | 5 ml | ₹148.00 |
| - | AGNEEPATH SC | Fipronil 5% SC | 1 Ltr | ₹620.00 |
| - | AGNEEPATH SC | Fipronil 5% SC | 500 ml | ₹330.00 |
| - | AMITRA 80 | Amino Acid 80% Powder | 1 Kg | ₹465.00 |
| - | AMITRA 80 | Amino Acid 80% Powder | 500 Gm | ₹253.00 |
| - | ATTACK-20 | Chlorpyriphos 20% EC | 1 Ltr | ₹340.00 |
| - | ATTACK-20 | Chlorpyriphos 20% EC | 250 ml | ₹101.00 |
| - | ATTACK-20 | Chlorpyriphos 20% EC | 500 ml | ₹187.50 |
| - | ATTACK-50 | Chlorpyriphos 50% EC | 1 Ltr | ₹630.00 |
| - | ATTACK-50 | Chlorpyriphos 50% EC | 500 ml | ₹333.00 |
| - | ATTACK-505 | Chlorpyrifos + Cypermethrin 5% EC | 1 Ltr | ₹685.00 |
| - | ATTACK-505 | Chlorpyrifos + Cypermethrin 5% EC | 500 ml | ₹360.00 |
| - | BENZO KILL | Emamectin Benzoate 5% SG | 100 Gm | ₹140.00 |
| - | BENZO KILL | Emamectin Benzoate 5% SG | 250 Gm | ₹323.00 |
| - | BENZO KILL | Emamectin Benzoate 5% SG | 500 Gm | ₹620.00 |
| - | BHISMA GOLD | Profenophos 50% EC | 1 Ltr | ₹635.00 |
| - | BHISMA GOLD | Profenophos 50% EC | 250 ml | ₹183.00 |
| - | BHISMA GOLD | Profenophos 50% EC | 500 ml | ₹340.00 |
| - | C-IMIDA | Imidacloprid 17.8% SL | 1 Ltr | ₹825.00 |
| - | C-IMIDA | Imidacloprid 17.8% SL | 250 ml | ₹229.00 |

*(Showing 25 of 122 created records. Full dataset available in `C:\Users\bansa\Desktop\CCS\backend\reports\step1_product_import_report.json`)*

## Skipped Rows Summary (Price NA / Missing)

Total Skipped: **398 rows**

| Row | Product Name | Technical Name | Pack Size | Raw Price | Reason |
|---|---|---|---|---|---|
| 2 | AAKRAMAN | Chlorantraniliprole 9.3% + Lambdacyhalothrin 4.6% ZC | 100 ml | NA | Price is marked NA |
| 3 | AAKRAMAN | Chlorantraniliprole 9.3% + Lambdacyhalothrin 4.6% ZC | 1 Ltr | NA | Price is marked NA |
| 4 | AAKRAMAN | Chlorantraniliprole 9.3% + Lambdacyhalothrin 4.6% ZC | 250 ml | NA | Price is marked NA |
| 5 | AAKRAMAN | Chlorantraniliprole 9.3% + Lambdacyhalothrin 4.6% ZC | 500 ml | NA | Price is marked NA |
| 6 | ABACHIT | Abamectin 1.9% EC | 100 ml | NA | Price is marked NA |
| 7 | ABACHIT | Abamectin 1.9% EC | 1 Ltr | NA | Price is marked NA |
| 8 | ABACHIT | Abamectin 1.9% EC | 250 ml | NA | Price is marked NA |
| 9 | ABACHIT | Abamectin 1.9% EC | 500 ml | NA | Price is marked NA |
| 16 | AGNEEPATH GR | Fipronil 0.3% GR | 1 Kg | NA | Price is marked NA |
| 17 | AGNEEPATH GR | Fipronil 0.3% GR | 5 Kg | NA | Price is marked NA |
| 18 | AGNEEPATH SC | Fipronil 5% SC | 100 ml | NA | Price is marked NA |
| 20 | AGNEEPATH SC | Fipronil 5% SC | 250 ml | NA | Price is marked NA |
| 22 | AMITRA 80 | Amino Acid 80% Powder | 100 Gm | NA | Price is marked NA |
| 24 | AMITRA 80 | Amino Acid 80% Powder | 250 Gm | NA | Price is marked NA |
| 26 | ATTACK-10 G | Chlorpyriphos 10% GR | 100 Gm | NA | Price is marked NA |
| 27 | ATTACK-10 G | Chlorpyriphos 10% GR | 1 Kg | NA | Price is marked NA |
| 28 | ATTACK-10 G | Chlorpyriphos 10% GR | 250 Gm | NA | Price is marked NA |
| 29 | ATTACK-10 G | Chlorpyriphos 10% GR | 500 Gm | NA | Price is marked NA |
| 30 | ATTACK-20 | Chlorpyriphos 20% EC | 100 ml | NA | Price is marked NA |
| 34 | ATTACK-50 | Chlorpyriphos 50% EC | 100 ml | NA | Price is marked NA |
| 36 | ATTACK-50 | Chlorpyriphos 50% EC | 250 ml | NA | Price is marked NA |
| 38 | ATTACK-505 | Chlorpyrifos + Cypermethrin 5% EC | 100 ml | NA | Price is marked NA |
| 40 | ATTACK-505 | Chlorpyrifos + Cypermethrin 5% EC | 250 ml | NA | Price is marked NA |
| 42 | Azotech | Azoxystrobin 23% SC | NA | NA | Price is marked NA |
| 43 | AZOTRI PLUS | Tricyclazole 20.4% + Azoxystrobin 6.8% SC | 100 ml | NA | Price is marked NA |

*(Showing 25 of 398 skipped rows. Complete breakdown saved to `C:\Users\bansa\Desktop\CCS\backend\reports\step1_product_import_report.json`)*
