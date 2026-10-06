from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("companies", "0015_create_brainz_archive_user")]
    operations = [
        migrations.AlterField(
            model_name="system",
            name="dashboard_port",
            field=models.TextField(blank=True, null=True),
        ),
    ]
