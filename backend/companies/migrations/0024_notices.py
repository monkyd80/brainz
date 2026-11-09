from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ("companies", "0023_clear_delivery_selections"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="Notice",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("title", models.CharField(max_length=200, verbose_name="제목")),
                ("body", models.TextField(verbose_name="내용")),
                ("created_at", models.DateTimeField(auto_now_add=True, verbose_name="등록일")),
            ],
            options={"ordering": ["-id"], "verbose_name": "공지사항", "verbose_name_plural": "공지사항"},
        ),
        migrations.CreateModel(
            name="NoticeRead",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("notice", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="reads", to="companies.notice")),
                ("user", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to=settings.AUTH_USER_MODEL)),
            ],
            options={
                "constraints": [models.UniqueConstraint(fields=("user", "notice"), name="unique_user_notice_read")],
            },
        ),
    ]
