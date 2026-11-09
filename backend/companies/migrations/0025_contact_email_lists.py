from django.db import migrations, models

from companies.validators import validate_contact_emails


class Migration(migrations.Migration):
    dependencies = [("companies", "0024_notices")]

    operations = [
        migrations.AlterField(
            model_name="contact",
            name="email",
            field=models.CharField(max_length=254, blank=True, db_index=True, validators=[validate_contact_emails]),
        ),
    ]
