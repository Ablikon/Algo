from django.db import models


class Aggregator(models.Model):
    name = models.CharField(max_length=100)
    logo_url = models.CharField(max_length=500, null=True, blank=True)
    color = models.CharField(max_length=20, null=True, blank=True)
    is_our_company = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'aggregators'
        managed = False

    def __str__(self):
        return self.name


class Category(models.Model):
    name = models.CharField(max_length=100)
    icon = models.CharField(max_length=50, null=True, blank=True)
    parent = models.ForeignKey('self', on_delete=models.SET_NULL, null=True, blank=True, related_name='children')
    sort_order = models.IntegerField(default=0)

    class Meta:
        db_table = 'categories'
        managed = False

    def __str__(self):
        return self.name

    def get_descendants(self):
        """Получить все дочерние категории рекурсивно"""
        descendants = list(self.children.all())
        for child in self.children.all():
            descendants.extend(child.get_descendants())
        return descendants


class Product(models.Model):
    WEIGHT_UNITS = [
        ('kg', 'Килограмм'),
        ('g', 'Грамм'),
        ('l', 'Литр'),
        ('ml', 'Миллилитр'),
        ('pcs', 'Штука'),
    ]

    name = models.CharField(max_length=200)
    category = models.ForeignKey(Category, on_delete=models.CASCADE, null=True)
    image_url = models.CharField(max_length=500, null=True, blank=True)
    brand = models.CharField(max_length=100, null=True, blank=True)
    manufacturer = models.CharField(max_length=100, null=True, blank=True)
    country_of_origin = models.CharField(max_length=100, null=True, blank=True)
    weight_value = models.DecimalField(max_digits=10, decimal_places=3, null=True, blank=True)
    weight_unit = models.CharField(max_length=20, choices=WEIGHT_UNITS, null=True, blank=True)
    sku = models.CharField(max_length=100, null=True, blank=True)

    class Meta:
        db_table = 'products'
        managed = False

    def __str__(self):
        return self.name

    def get_standard_weight_kg(self):
        """Преобразовать вес в килограммы"""
        if not self.weight_value or not self.weight_unit:
            return None
        if self.weight_unit == 'kg':
            return float(self.weight_value)
        elif self.weight_unit == 'g':
            return float(self.weight_value) / 1000
        return None

    def get_standard_volume_l(self):
        """Преобразовать объем в литры"""
        if not self.weight_value or not self.weight_unit:
            return None
        if self.weight_unit == 'l':
            return float(self.weight_value)
        elif self.weight_unit == 'ml':
            return float(self.weight_value) / 1000
        return None


class Price(models.Model):
    product = models.ForeignKey(Product, on_delete=models.CASCADE)
    aggregator = models.ForeignKey(Aggregator, on_delete=models.CASCADE)
    price = models.DecimalField(max_digits=10, decimal_places=2, null=True)
    is_available = models.BooleanField(default=True)
    competitor_brand = models.CharField(max_length=100, null=True, blank=True)
    competitor_country = models.CharField(max_length=100, null=True, blank=True)
    last_updated = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'prices'
        unique_together = ('product', 'aggregator')


class Recommendation(models.Model):
    ACTION_TYPES = [
        ('LOWER_PRICE', 'Lower Price'),
        ('ADD_PRODUCT', 'Add Product'),
        ('NO_ACTION', 'No Action'),
    ]
    PRIORITIES = [
        ('HIGH', 'High'),
        ('MEDIUM', 'Medium'),
        ('LOW', 'Low'),
    ]
    STATUSES = [
        ('PENDING', 'Pending'),
        ('APPLIED', 'Applied'),
        ('REJECTED', 'Rejected'),
    ]

    product = models.ForeignKey(Product, on_delete=models.CASCADE)
    action_type = models.CharField(max_length=50, choices=ACTION_TYPES)
    current_price = models.DecimalField(max_digits=10, decimal_places=2, null=True)
    recommended_price = models.DecimalField(max_digits=10, decimal_places=2, null=True)
    competitor_price = models.DecimalField(max_digits=10, decimal_places=2, null=True)
    potential_savings = models.DecimalField(max_digits=10, decimal_places=2, null=True)
    priority = models.CharField(max_length=20, choices=PRIORITIES)
    status = models.CharField(max_length=20, choices=STATUSES, default='PENDING')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'recommendations'
        managed = False


class PriceHistory(models.Model):
    product = models.ForeignKey(Product, on_delete=models.CASCADE)
    aggregator = models.ForeignKey(Aggregator, on_delete=models.CASCADE)
    old_price = models.DecimalField(max_digits=10, decimal_places=2, null=True)
    new_price = models.DecimalField(max_digits=10, decimal_places=2, null=True)
    changed_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'price_history'
        managed = False


class ProductLink(models.Model):
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='links')
    aggregator = models.ForeignKey(Aggregator, on_delete=models.CASCADE)
    url = models.URLField(max_length=1000, null=True, blank=True)
    external_name = models.CharField(max_length=300, null=True, blank=True)
    is_verified = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'product_links'
        managed = False
        unique_together = ('product', 'aggregator')

    def __str__(self):
        return f"{self.product.name} - {self.aggregator.name}"


class UnitConversion(models.Model):
    from_unit = models.CharField(max_length=20)
    to_unit = models.CharField(max_length=20)
    factor = models.DecimalField(max_digits=10, decimal_places=6)

    class Meta:
        db_table = 'unit_conversions'
        managed = False
        unique_together = ('from_unit', 'to_unit')


class ImportJob(models.Model):
    JOB_TYPES = [
        ('products', 'Товары'),
        ('prices', 'Цены'),
        ('categories', 'Категории'),
        ('links', 'Ссылки'),
    ]
    STATUSES = [
        ('pending', 'Ожидание'),
        ('processing', 'Обработка'),
        ('completed', 'Завершено'),
        ('failed', 'Ошибка'),
    ]

    job_type = models.CharField(max_length=50, choices=JOB_TYPES)
    file_name = models.CharField(max_length=255, null=True, blank=True)
    status = models.CharField(max_length=50, choices=STATUSES, default='pending')
    total_rows = models.IntegerField(null=True, blank=True)
    processed_rows = models.IntegerField(default=0)
    success_count = models.IntegerField(default=0)
    error_count = models.IntegerField(default=0)
    error_details = models.JSONField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'import_jobs'
        managed = False

    def __str__(self):
        return f"{self.job_type} - {self.status}"
