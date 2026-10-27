import companies.file_uploads
import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("companies", "0019_solution_platform_quantities"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]
    operations = [
        migrations.CreateModel(
            name="CompanyAttachment",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("file", models.FileField(upload_to=companies.file_uploads.company_attachment_path, verbose_name="파일")),
                ("original_name", models.CharField(max_length=255, verbose_name="파일명")),
                ("size", models.PositiveIntegerField(verbose_name="용량 (bytes)")),
                ("uploaded_at", models.DateTimeField(auto_now_add=True, verbose_name="업로드 날짜")),
                ("company", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="attachments", to="companies.company")),
                ("uploaded_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to=settings.AUTH_USER_MODEL, verbose_name="업로드 사용자")),
            ],
            options={"db_table": "com_attachment", "ordering": ["-uploaded_at", "-id"]},
        ),
    ]
