import os
import json
from decimal import Decimal
from django.core.management.base import BaseCommand
from django.db import transaction
from django.conf import settings
from apps.products.models import Product, Brand, Category

class Command(BaseCommand):
    help = 'Safely imports valid products and prices from the Chitra Crop Science Excel workbook.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--file',
            type=str,
            default=os.path.join(settings.BASE_DIR, '..', 'ccsps', 'ccs-partners-', 'CHITRA_CROP_SCIENCE_PRODUCT_PRICE_LIST.xlsx'),
            help='Path to the Excel file containing product price list.'
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Simulate import without committing changes to PostgreSQL.'
        )
        parser.add_argument(
            '--report-dir',
            type=str,
            default=os.path.join(settings.BASE_DIR, 'reports'),
            help='Directory to output import reports.'
        )

    def handle(self, *args, **options):
        file_path = os.path.abspath(options['file'])
        dry_run = options['dry_run']
        report_dir = os.path.abspath(options['report_dir'])
        os.makedirs(report_dir, exist_ok=True)

        self.stdout.write(self.style.NOTICE(f"=== CCS PRODUCT PRICE IMPORT ==="))
        self.stdout.write(f"Source file: {file_path}")
        self.stdout.write(f"Mode: {'DRY RUN (No changes saved)' if dry_run else 'LIVE COMMIT'}")

        if not os.path.exists(file_path):
            self.stderr.write(self.style.ERROR(f"Source file not found at: {file_path}"))
            return

        import openpyxl
        wb = openpyxl.load_workbook(file_path, data_only=True)
        sheet_name = 'Product Prices'
        if sheet_name not in wb.sheetnames:
            sheet = wb.active
            self.stdout.write(self.style.WARNING(f"Sheet '{sheet_name}' not found. Using active sheet: '{sheet.title}'"))
        else:
            sheet = wb[sheet_name]

        # Initial metrics
        count_before = Product.objects.count()
        brand, _ = Brand.objects.get_or_create(
            name='Chitra Crop Science',
            defaults={'description': 'Premium Agro-Chemical Formulations and Crop Protection Inputs'}
        )

        total_source_rows = 0
        valid_rows = []
        skipped_rows = []
        duplicate_rows_in_file = []
        seen_keys = {}

        for r in range(2, sheet.max_row + 1):
            pname_raw = sheet.cell(row=r, column=1).value
            tech_raw = sheet.cell(row=r, column=2).value
            pack_raw = sheet.cell(row=r, column=3).value
            price_raw = sheet.cell(row=r, column=4).value

            # Skip entirely blank trailing rows
            if pname_raw is None and tech_raw is None and pack_raw is None and price_raw is None:
                continue

            total_source_rows += 1
            pname = str(pname_raw).strip() if pname_raw is not None else ''
            tech = str(tech_raw).strip() if tech_raw is not None else ''
            pack = str(pack_raw).strip() if pack_raw is not None else ''

            # Evaluate validity
            reasons = []
            if not pname:
                reasons.append("Missing product name")
            if not pack:
                reasons.append("Missing pack size")

            num_price = None
            if price_raw is None or str(price_raw).strip() == '':
                reasons.append("Missing price")
            elif str(price_raw).strip().upper() in ['NA', 'N/A']:
                reasons.append(f"Price is marked {price_raw}")
            else:
                try:
                    cleaned_price_str = str(price_raw).replace(',', '').strip()
                    num_val = float(cleaned_price_str)
                    if num_val <= 0:
                        reasons.append(f"Non-positive price ({num_val})")
                    else:
                        num_price = Decimal(f"{num_val:.2f}")
                except (ValueError, TypeError):
                    reasons.append(f"Non-numeric price ({price_raw})")

            if reasons:
                skipped_rows.append({
                    "row_number": r,
                    "product_name": pname or "N/A",
                    "technical_name": tech or "N/A",
                    "pack_size": pack or "N/A",
                    "raw_price": str(price_raw) if price_raw is not None else "BLANK",
                    "reason": "; ".join(reasons)
                })
            else:
                key = (pname.upper(), pack.upper())
                if key in seen_keys:
                    duplicate_rows_in_file.append({
                        "row_number": r,
                        "product_name": pname,
                        "pack_size": pack,
                        "price": float(num_price),
                        "first_seen_at_row": seen_keys[key]
                    })
                else:
                    seen_keys[key] = r

                valid_rows.append({
                    "row_number": r,
                    "product_name": pname,
                    "technical_name": tech,
                    "pack_size": pack,
                    "dealer_price": num_price,
                    "raw_price": float(num_price)
                })

        # Process valid rows against DB
        created_records = []
        updated_records = []
        conflicts = []

        with transaction.atomic():
            for row in valid_rows:
                # Find matching product in DB by name and pack_size (case-insensitive)
                existing = Product.objects.filter(
                    name__iexact=row['product_name'],
                    pack_size__iexact=row['pack_size']
                ).first()

                if not existing:
                    # Also try matching via packing field
                    existing = Product.objects.filter(
                        name__iexact=row['product_name'],
                        packing__iexact=row['pack_size']
                    ).first()

                if existing:
                    # Check for price conflict
                    if existing.dealer_price != row['dealer_price']:
                        conflicts.append({
                            "product_name": existing.name,
                            "pack_size": existing.pack_size or existing.packing,
                            "existing_price": float(existing.dealer_price),
                            "workbook_price": float(row['dealer_price']),
                            "action": "Updated to workbook authoritative price"
                        })
                    if not dry_run:
                        existing.dealer_price = row['dealer_price']
                        if not existing.technical_name and row['technical_name']:
                            existing.technical_name = row['technical_name']
                        existing.save()

                    updated_records.append({
                        "id": str(existing.id),
                        "product_name": existing.name,
                        "pack_size": row['pack_size'],
                        "dealer_price": float(row['dealer_price'])
                    })
                else:
                    # Create new product record
                    if not dry_run:
                        new_prod = Product.objects.create(
                            name=row['product_name'],
                            technical_name=row['technical_name'],
                            pack_size=row['pack_size'],
                            packing=row['pack_size'],
                            dealer_price=row['dealer_price'],
                            distributor_price=Decimal('0.00'),
                            mrp=Decimal('0.00'), # Preserving without fabricating
                            stock=0,             # Preserving without fabricating
                            gst=Decimal('18.00'),
                            brand=brand,
                            status='Available'
                        )
                        created_records.append({
                            "id": str(new_prod.id),
                            "product_name": new_prod.name,
                            "technical_name": new_prod.technical_name,
                            "pack_size": new_prod.pack_size,
                            "dealer_price": float(new_prod.dealer_price)
                        })
                    else:
                        created_records.append({
                            "id": "dry-run-uuid",
                            "product_name": row['product_name'],
                            "technical_name": row['technical_name'],
                            "pack_size": row['pack_size'],
                            "dealer_price": float(row['dealer_price'])
                        })

            if dry_run:
                transaction.set_rollback(True)

        count_after = Product.objects.count() if not dry_run else count_before + len(created_records)

        # Build comprehensive report structures
        report_data = {
            "source_file": file_path,
            "total_source_rows": total_source_rows,
            "valid_rows_imported_or_updated": len(valid_rows),
            "rows_created": len(created_records),
            "rows_updated": len(updated_records),
            "rows_skipped": len(skipped_rows),
            "duplicates_in_file": len(duplicate_rows_in_file),
            "price_conflicts": len(conflicts),
            "product_count_before": count_before,
            "product_count_after": count_after,
            "database_fields_updated": [
                "name", "technical_name", "pack_size", "packing", "dealer_price",
                "brand", "status", "gst"
            ],
            "price_field_mapping": {
                "source_column": "price",
                "target_model_field": "dealer_price",
                "business_rationale": "In CCS Connect, orders and wholesale dealer billing authoritative rate enforces dealer_price (rate = dealer_price or mrp).",
                "mrp_handling": "Preserved without fabrication (0.00 default where unprovided).",
                "stock_handling": "Preserved without fabrication (0 default for new price catalog items).",
                "distributor_price_handling": "Preserved without fabrication (0.00 default where unprovided)."
            },
            "skipped_rows_sample": skipped_rows[:20],
            "all_skipped_rows_count": len(skipped_rows),
            "conflicts_list": conflicts,
            "created_products": created_records
        }

        # Write JSON report
        json_report_path = os.path.join(report_dir, 'step1_product_import_report.json')
        with open(json_report_path, 'w', encoding='utf-8') as f:
            json.dump({
                "summary": {
                    "total_source_rows": total_source_rows,
                    "valid_rows_count": len(valid_rows),
                    "rows_created": len(created_records),
                    "rows_updated": len(updated_records),
                    "rows_skipped": len(skipped_rows),
                    "duplicates_in_file": len(duplicate_rows_in_file),
                    "price_conflicts": len(conflicts),
                    "count_before": count_before,
                    "count_after": count_after
                },
                "conflicts": conflicts,
                "created_records": created_records,
                "skipped_rows": skipped_rows
            }, f, indent=2)

        # Write Markdown report
        md_report_path = os.path.join(report_dir, 'step1_product_import_report.md')
        with open(md_report_path, 'w', encoding='utf-8') as f:
            f.write("# CHITRA CROP SCIENCE — PRODUCT PRICE LIST IMPORT REPORT\n\n")
            f.write(f"- **Workbook**: `{file_path}`\n")
            f.write(f"- **Total Source Rows**: {total_source_rows}\n")
            f.write(f"- **Successfully Imported / Valid Rows**: {len(valid_rows)}\n")
            f.write(f"- **New Records Created in PostgreSQL**: {len(created_records)}\n")
            f.write(f"- **Existing Records Updated in PostgreSQL**: {len(updated_records)}\n")
            f.write(f"- **Skipped Rows (NA / Missing / Invalid Price)**: {len(skipped_rows)}\n")
            f.write(f"- **Duplicates Detected in File**: {len(duplicate_rows_in_file)}\n")
            f.write(f"- **Price Conflicts**: {len(conflicts)}\n")
            f.write(f"- **Database Catalog Count**: {count_before} → {count_after}\n\n")

            f.write("## Field Mapping & Business Rationale\n")
            f.write("- **Workbook `price` Column** → mapped to **`Product.dealer_price`**.\n")
            f.write("- **Authoritative Rate**: Verified in `backend/apps/orders/views.py` and `test_step2_regressions.py` (`rate = product.dealer_price`).\n")
            f.write("- **Uninvented Values**: MRP, stock quantity, and distributor price were NOT fabricated; preserved safely.\n\n")

            f.write("## Sample Imported Products (Available Prices)\n\n")
            f.write("| Row | Product Name | Technical Name | Pack Size | Dealer Price (₹) |\n")
            f.write("|---|---|---|---|---|\n")
            for cp in created_records[:25]:
                f.write(f"| - | {cp['product_name']} | {cp['technical_name']} | {cp['pack_size']} | ₹{cp['dealer_price']:.2f} |\n")

            f.write(f"\n*(Showing 25 of {len(created_records)} created records. Full dataset available in `{json_report_path}`)*\n\n")

            f.write("## Skipped Rows Summary (Price NA / Missing)\n\n")
            f.write(f"Total Skipped: **{len(skipped_rows)} rows**\n\n")
            f.write("| Row | Product Name | Technical Name | Pack Size | Raw Price | Reason |\n")
            f.write("|---|---|---|---|---|---|\n")
            for sk in skipped_rows[:25]:
                f.write(f"| {sk['row_number']} | {sk['product_name']} | {sk['technical_name']} | {sk['pack_size']} | {sk['raw_price']} | {sk['reason']} |\n")

            f.write(f"\n*(Showing 25 of {len(skipped_rows)} skipped rows. Complete breakdown saved to `{json_report_path}`)*\n")

        self.stdout.write(self.style.SUCCESS(f"\n=== IMPORT SUMMARY ==="))
        self.stdout.write(f"Total rows in workbook: {total_source_rows}")
        self.stdout.write(self.style.SUCCESS(f"Rows imported/created: {len(created_records)}"))
        self.stdout.write(f"Rows updated: {len(updated_records)}")
        self.stdout.write(self.style.WARNING(f"Rows skipped: {len(skipped_rows)}"))
        self.stdout.write(f"Duplicates detected: {len(duplicate_rows_in_file)}")
        self.stdout.write(f"Price conflicts: {len(conflicts)}")
        self.stdout.write(f"Catalog count before: {count_before}")
        self.stdout.write(self.style.SUCCESS(f"Catalog count after: {count_after}"))
        self.stdout.write(f"Reports saved to:")
        self.stdout.write(f" - {json_report_path}")
        self.stdout.write(f" - {md_report_path}")
