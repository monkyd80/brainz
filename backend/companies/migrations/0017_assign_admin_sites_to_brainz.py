from django.conf import settings
from django.db import migrations


def assign_existing_sites(apps, schema_editor):
    app_label, model = settings.AUTH_USER_MODEL.split(".")
    User = apps.get_model(app_label, model)
    Company = apps.get_model("companies", "Company")
    Assignment = apps.get_model("companies", "CompanyAssignment")
    alias = schema_editor.connection.alias
    archive, _ = User.objects.using(alias).get_or_create(
        username="brainz", defaults={"first_name": "brainz", "password": "!", "is_staff": False, "is_active": True},
    )
    archive.password = "!"
    archive.is_staff = False
    archive.is_superuser = False
    archive.is_active = True
    archive.save(using=alias, update_fields=["password", "is_staff", "is_superuser", "is_active"])
    for company_id in Company.objects.using(alias).filter(created_by__is_staff=True).values_list("id", flat=True).iterator():
        Assignment.objects.using(alias).get_or_create(company_id=company_id, user_id=archive.pk)


class Migration(migrations.Migration):
    dependencies = [("companies", "0016_alter_system_dashboard_port")]
    operations = [migrations.RunPython(assign_existing_sites, migrations.RunPython.noop)]
