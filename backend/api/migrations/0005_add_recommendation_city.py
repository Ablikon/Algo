# Generated manually to add missing city field to recommendation

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0004_add_indexes'),
    ]

    operations = [
        migrations.RunSQL(
            sql='ALTER TABLE recommendations ADD COLUMN IF NOT EXISTS city_id INTEGER REFERENCES cities(id) ON DELETE CASCADE;',
            reverse_sql='ALTER TABLE recommendations DROP COLUMN IF EXISTS city_id;'
        ),
    ]
