import os
import django
import sys

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'scoutalgo.settings')
django.setup()

from api.services.json_importer import JSONDataImporter
from api.models import ImportJob

def run_import():
    print("Re-importing Glovo to fix weights...")
    job = ImportJob.objects.create(
        job_type='products',
        file_name='Reimport Weights',
        status='processing'
    )
    
    importer = JSONDataImporter(job)
    # Only import glovo
    res = importer.import_from_json(aggregators=['glovo'])
    
    print(f"Result: {res}")

if __name__ == '__main__':
    run_import()
