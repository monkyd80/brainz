from django.conf import settings
from django.db import migrations


def reconcile(apps, schema_editor):
    app, model = settings.AUTH_USER_MODEL.split(".")
    User = apps.get_model(app, model)
    Company = apps.get_model("companies", "Company")
    Assignment = apps.get_model("companies", "CompanyAssignment")
    alias = schema_editor.connection.alias
    archive = User.objects.using(alias).get(username="brainz")
    Assignment.objects.using(alias).filter(user__is_staff=True).delete()
    for site_id in Company.objects.using(alias).values_list("pk", flat=True).iterator():
        assignments = Assignment.objects.using(alias).filter(company_id=site_id)
        if assignments.filter(user__is_active=True, user__is_staff=False).exclude(user_id=archive.pk).exists():
            assignments.filter(user_id=archive.pk).delete()
        else:
            assignments.delete()
            Assignment.objects.using(alias).create(company_id=site_id, user_id=archive.pk)


class Migration(migrations.Migration):
    dependencies = [("companies", "0017_assign_admin_sites_to_brainz")]
    operations = [migrations.RunPython(reconcile, migrations.RunPython.noop)]
