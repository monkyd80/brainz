from django.conf import settings
from django.db import migrations


def create_archive_user(apps, schema_editor):
    app_label, model_name = settings.AUTH_USER_MODEL.split(".")
    User = apps.get_model(app_label, model_name)
    User.objects.using(schema_editor.connection.alias).get_or_create(
        username="brainz",
        defaults={"first_name": "brainz", "password": "!", "is_staff": False, "is_active": True},
    )


class Migration(migrations.Migration):
    dependencies = [
        ("companies", "0014_alter_system_web_port"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]
    operations = [migrations.RunPython(create_archive_user, migrations.RunPython.noop)]
