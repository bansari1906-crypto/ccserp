import uuid
from django.db import models

class Category(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=100, unique=True)
    description = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.name

class SubCategory(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    category = models.ForeignKey(Category, on_delete=models.CASCADE, related_name='subcategories')
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('category', 'name')

    def __str__(self):
        return f"{self.category.name} - {self.name}"

class Brand(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=100, unique=True)
    description = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.name

class Product(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=200)
    brand = models.ForeignKey(Brand, on_delete=models.SET_NULL, null=True, related_name='products')
    category = models.ForeignKey(Category, on_delete=models.SET_NULL, null=True, related_name='products')
    sub_category = models.ForeignKey(SubCategory, on_delete=models.SET_NULL, null=True, blank=True, related_name='products')
    
    technical_name = models.CharField(max_length=255, blank=True, null=True)
    composition = models.TextField(blank=True, null=True)
    description = models.TextField(blank=True, null=True)
    benefits = models.TextField(blank=True, null=True)
    uses = models.TextField(blank=True, null=True)
    dosage = models.CharField(max_length=255, blank=True, null=True)
    crop = models.CharField(max_length=255, blank=True, null=True)
    disease = models.CharField(max_length=255, blank=True, null=True)
    pest = models.CharField(max_length=255, blank=True, null=True)
    packing = models.CharField(max_length=100, blank=True, null=True)
    pack_size = models.CharField(max_length=50, blank=True, null=True)
    hsn_code = models.CharField(max_length=50, blank=True, null=True)
    barcode = models.CharField(max_length=100, blank=True, null=True)
    qr_code = models.CharField(max_length=500, blank=True, null=True)
    
    # Inventory specific
    batch_number = models.CharField(max_length=100, blank=True, null=True)
    expiry_date = models.DateField(null=True, blank=True)
    
    # Media
    image_url = models.URLField(max_length=500, blank=True, null=True)
    pdf_url = models.URLField(max_length=500, blank=True, null=True)
    video_url = models.URLField(max_length=500, blank=True, null=True)
    
    mrp = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    dealer_price = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    distributor_price = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    gst = models.DecimalField(max_digits=5, decimal_places=2, default=18.00)
    
    stock = models.IntegerField(default=0)
    STATUS_CHOICES = [
        ('Available', 'Available'),
        ('Unavailable', 'Unavailable'),
        ('Active', 'Active'),
        ('Inactive', 'Inactive'),
        ('Discontinued', 'Discontinued'),
    ]
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='Available')
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    @property
    def is_available(self):
        return self.status in ['Available', 'Active']

    @property
    def bottles_per_case(self):
        count, _, _, _ = get_case_packaging(self.pack_size or self.packing)
        return count

    @property
    def case_size(self):
        _, _, _, label = get_case_packaging(self.pack_size or self.packing)
        return label

    @property
    def case_price(self):
        from decimal import Decimal
        price = self.dealer_price if self.dealer_price and self.dealer_price > 0 else self.mrp
        return price * Decimal(str(self.bottles_per_case))

    def __str__(self):
        return self.name


def get_case_packaging(pack_size):
    norm = (pack_size or '').lower().strip()
    if '1 l' in norm or '1 ltr' in norm or '1000 ml' in norm:
        return 10, 'bottles', '10 L total', '10 bottles (10 L total)'
    if '500 ml' in norm:
        return 20, 'bottles', '10 L total', '20 bottles (10 L total)'
    if '250 ml' in norm:
        return 40, 'bottles', '10 L total', '40 bottles (10 L total)'
    if '100 ml' in norm:
        return 100, 'bottles', '10 L total', '100 bottles (10 L total)'
    if '5 l' in norm or '5 ltr' in norm:
        return 2, 'cans', '10 L total', '2 cans (10 L total)'
    if '5 ml' in norm:
        return 100, 'bottles', '0.5 L total', '100 bottles (0.5 L total)'
    if '1 kg' in norm or '1000 gm' in norm or '1000 g' in norm:
        return 10, 'packs', '10 Kg total', '10 packs (10 Kg total)'
    if '500 gm' in norm or '500 g' in norm:
        return 20, 'packs', '10 Kg total', '20 packs (10 Kg total)'
    if '250 gm' in norm or '250 g' in norm:
        return 40, 'packs', '10 Kg total', '40 packs (10 Kg total)'
    if '100 gm' in norm or '100 g' in norm:
        return 100, 'packs', '10 Kg total', '100 packs (10 Kg total)'
    if '5 kg' in norm:
        return 2, 'bags', '10 Kg total', '2 bags (10 Kg total)'
    if any(k in norm for k in ['25 kg', '30 kg', '15 kg', '50 kg']):
        return 1, 'bags', pack_size, f'1 bulk bag ({pack_size})'
    return 10, 'units', '10 Units total', '10 units/case'

