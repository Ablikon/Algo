# Generated manually for performance optimization

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0003_city_alter_aggregator_options_alter_category_options_and_more'),
    ]

    operations = [
        # Index for Price filtering by availability (most common filter)
        migrations.AddIndex(
            model_name='price',
            index=models.Index(fields=['is_available'], name='price_avail_idx'),
        ),
        # Index for Recommendation filtering by status
        migrations.AddIndex(
            model_name='recommendation',
            index=models.Index(fields=['status'], name='rec_status_idx'),
        ),
        # Index for Aggregator is_our_company flag
        migrations.AddIndex(
            model_name='aggregator',
            index=models.Index(fields=['is_our_company'], name='agg_our_company_idx'),
        ),
    ]
