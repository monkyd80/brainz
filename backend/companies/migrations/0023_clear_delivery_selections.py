from django.db import migrations
from django.db.models import Q


def clear_delivery_selections(apps, schema_editor):
    companies = apps.get_model("companies", "Company").objects.using(schema_editor.connection.alias)
    companies.filter(Q(supplied_server=True) | Q(supplied_os=True) | Q(supplied_db=True)).update(
        supplied_server=False, supplied_os=False, supplied_db=False,
    )


class Migration(migrations.Migration):
    dependencies = [("companies", "0022_split_delivery_fields")]
    operations = [migrations.RunPython(clear_delivery_selections)]
