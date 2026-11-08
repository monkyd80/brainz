from django.db import migrations, models
from django.db.models import Q


def split_delivery(apps, schema_editor):
    companies = apps.get_model("companies", "Company").objects.using(schema_editor.connection.alias)
    companies.filter(supplied_server=True).update(supplied_os=True, supplied_db=True)


def combine_delivery(apps, schema_editor):
    companies = apps.get_model("companies", "Company").objects.using(schema_editor.connection.alias)
    companies.filter(Q(supplied_os=True) | Q(supplied_db=True)).update(supplied_server=True)


class Migration(migrations.Migration):
    dependencies = [("companies", "0021_companydashboardimage")]
    operations = [
        migrations.RenameField("company", "supplied_server_os_db", "supplied_server"),
        migrations.AlterField("company", "supplied_server", models.BooleanField("Server 납품", default=False)),
        migrations.AddField("company", "supplied_os", models.BooleanField("OS 납품", default=False)),
        migrations.AddField("company", "supplied_db", models.BooleanField("DB 납품", default=False)),
        migrations.RunPython(split_delivery, combine_delivery),
    ]
