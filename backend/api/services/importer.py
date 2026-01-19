import pandas as pd
import io
from decimal import Decimal
from django.utils import timezone
from ..models import Category, Product, Price, Aggregator, ProductLink

class DataImporter:
    def __init__(self, job):
        self.job = job
        self.errors = []
        self.success_count = 0
        self.processed_rows = 0

    def process(self, file):
        try:
            # Determine file type and read
            if file.name.endswith('.xlsx'):
                df = pd.read_excel(file)
            elif file.name.endswith('.csv'):
                df = pd.read_csv(file)
            else:
                raise ValueError("Unsupported file format. Please use .xlsx or .csv")

            # Standardize column names (lowercase, strip)
            df.columns = [str(col).strip().lower() for col in df.columns]
            
            # Fill NaN
            df = df.fillna('')

            self.job.total_rows = len(df)
            self.job.save()

            for index, row in df.iterrows():
                try:
                    if self.job.job_type == 'products':
                        self._process_product(row)
                    elif self.job.job_type == 'prices':
                        self._process_price(row)
                    elif self.job.job_type == 'links':
                        self._process_link(row)
                    elif self.job.job_type == 'categories':
                        self._process_category(row)
                    
                    self.success_count += 1
                except Exception as e:
                    self.errors.append({
                        'row': index + 2, # 1-based + header
                        'error': str(e),
                        'data': row.to_dict()
                    })
                    self.job.error_count += 1
                
                self.processed_rows += 1
                if self.processed_rows % 10 == 0:
                    self.job.processed_rows = self.processed_rows
                    self.job.save()

            self.job.status = 'completed'
            self.job.error_details = self.errors if self.errors else None
            self.job.success_count = self.success_count
            self.job.processed_rows = self.processed_rows
            self.job.completed_at = timezone.now()
            self.job.save()

        except Exception as e:
            self.job.status = 'failed'
            self.job.error_details = {'error': str(e)}
            self.job.completed_at = timezone.now()
            self.job.save()

    def _get_val(self, row, keys, default=None):
        """Helper to get value from multiple potential column names"""
        for key in keys:
            if key in row:
                val = row[key]
                if isinstance(val, str):
                    val = val.strip()
                return val if val else default
        return default

    def _process_product(self, row):
        name = self._get_val(row, ['name', 'название', 'product name', 'товар'])
        if not name:
            raise ValueError("Product name is required")

        cat_name = self._get_val(row, ['category', 'категория'])
        category = None
        if cat_name:
            category, _ = Category.objects.get_or_create(name=cat_name)

        weight_val = self._get_val(row, ['weight_value', 'weight', 'вес', 'объем'])
        try:
            weight_val = Decimal(str(weight_val)) if weight_val else None
        except:
            weight_val = None

        Product.objects.update_or_create(
            name=name,
            defaults={
                'category': category,
                'brand': self._get_val(row, ['brand', 'бренд', 'фирма']),
                'manufacturer': self._get_val(row, ['manufacturer', 'производитель']),
                'country_of_origin': self._get_val(row, ['country_of_origin', 'country', 'страна']),
                'weight_value': weight_val,
                'weight_unit': self._get_val(row, ['weight_unit', 'unit', 'ед.изм', 'единица']),
                'sku': self._get_val(row, ['sku', 'артикул', 'код']),
                'image_url': self._get_val(row, ['image_url', 'image', 'фото', 'изображение']),
            }
        )

    def _process_price(self, row):
        prod_ref = self._get_val(row, ['product_name_or_sku', 'product', 'товар', 'name', 'sku'])
        if not prod_ref:
            raise ValueError("Product reference (name or SKU) is required")

        # Try mapping by exact name or SKU
        product = Product.objects.filter(name__iexact=prod_ref).first()
        if not product:
            product = Product.objects.filter(sku__iexact=prod_ref).first()
        
        if not product:
            raise ValueError(f"Product not found: {prod_ref}")

        agg_name = self._get_val(row, ['aggregator', 'агрегатор', 'магазин'])
        if not agg_name:
            raise ValueError("Aggregator name is required")
        
        aggregator = Aggregator.objects.filter(name__iexact=agg_name).first()
        if not aggregator:
            raise ValueError(f"Aggregator not found: {agg_name}")

        price_raw = self._get_val(row, ['price', 'цена'])
        try:
            price = Decimal(str(price_raw)) if price_raw else None
        except:
            price = None

        avail_raw = self._get_val(row, ['is_available', 'available', 'наличие'])
        is_available = str(avail_raw).lower() in ('true', '1', 'yes', 'да', '+')

        Price.objects.update_or_create(
            product=product,
            aggregator=aggregator,
            defaults={
                'price': price,
                'is_available': is_available,
                'competitor_brand': self._get_val(row, ['competitor_brand', 'brand_comp', 'бренд конкурента']),
                'competitor_country': self._get_val(row, ['competitor_country', 'country_comp', 'страна конкурента']),
            }
        )

    def _process_link(self, row):
        prod_ref = self._get_val(row, ['product_name_or_sku', 'product', 'товар', 'name'])
        if not prod_ref:
            raise ValueError("Product reference is required")

        product = Product.objects.filter(name__iexact=prod_ref).first()
        if not product:
             # Try loose match or SKU
            product = Product.objects.filter(sku__iexact=prod_ref).first()
        
        if not product:
            raise ValueError(f"Product not found: {prod_ref}")

        agg_name = self._get_val(row, ['aggregator', 'агрегатор'])
        aggregator = Aggregator.objects.filter(name__iexact=agg_name).first()
        if not aggregator:
             raise ValueError(f"Aggregator not found: {agg_name}")

        ProductLink.objects.update_or_create(
            product=product,
            aggregator=aggregator,
            defaults={
                'url': self._get_val(row, ['url', 'link', 'ссылка']),
                'external_name': self._get_val(row, ['external_name', 'external name', 'название там']),
            }
        )

    def _process_category(self, row):
        name = self._get_val(row, ['name', 'название', 'категория'])
        if not name:
            raise ValueError("Category name is required")
        
        parent_name = self._get_val(row, ['parent_name', 'parent', 'родитель'])
        parent = None
        if parent_name:
            parent, _ = Category.objects.get_or_create(name=parent_name)

        Category.objects.update_or_create(
            name=name,
            defaults={
                'parent': parent,
                'icon': self._get_val(row, ['icon', 'иконка']),
                'sort_order': int(self._get_val(row, ['sort_order', 'order', 'порядок']) or 0)
            }
        )
