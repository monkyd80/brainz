from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("companies", "0025_contact_email_lists")]
    operations = [
        migrations.AddField(
            model_name="companychangehistory",
            name="edit_batch",
            field=models.UUIDField(editable=False, null=True),
        ),
    ]
