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

    class Meta:
        db_table = 'categories'
        managed = False

    def __str__(self):
        return self.name


class Product(models.Model):
    name = models.CharField(max_length=200)
    category = models.ForeignKey(Category, on_delete=models.CASCADE, null=True)
    image_url = models.CharField(max_length=500, null=True, blank=True)

    class Meta:
        db_table = 'products'
        managed = False

    def __str__(self):
        return self.name


class Price(models.Model):
    product = models.ForeignKey(Product, on_delete=models.CASCADE)
    aggregator = models.ForeignKey(Aggregator, on_delete=models.CASCADE)
    price = models.DecimalField(max_digits=10, decimal_places=2, null=True)
    is_available = models.BooleanField(default=True)
    last_updated = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'prices'
        managed = False
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
