from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("companies", "0013_userprofile")]

    operations = [
        migrations.AlterField(
            model_name="system",
            name="web_port",
            field=models.TextField(blank=True, null=True),
        ),
    ]
