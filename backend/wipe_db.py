import os
import django
import sys

sys.path.append('/Users/abylajhanbegimkulov/Desktop/ScoutAlgo/backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'scoutalgo.settings')
django.setup()

from api.models import Category, Product, Price, Aggregator, ProductLink, ImportJob

def wipe_data():
    print("Wiping data...")
    ProductLink.objects.all().delete()
    print("Deleted Links")
    Price.objects.all().delete()
    print("Deleted Prices")
    Product.objects.all().delete()
    print("Deleted Products")
    Category.objects.all().delete()
    print("Deleted Categories")
    Aggregator.objects.all().delete()
    print("Deleted Aggregators")
    ImportJob.objects.all().delete()
    print("Deleted ImportJobs")
    print("Done!")

if __name__ == '__main__':
    wipe_data()
