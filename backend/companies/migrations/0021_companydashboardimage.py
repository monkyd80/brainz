import companies.dashboard_images
import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("companies", "0020_companyattachment"), migrations.swappable_dependency(settings.AUTH_USER_MODEL)]
    operations = [migrations.CreateModel(
        name="CompanyDashboardImage",
        fields=[
            ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
            ("file", models.FileField(upload_to=companies.dashboard_images.dashboard_image_path, verbose_name="대시보드 이미지")),
            ("thumbnail", models.FileField(upload_to=companies.dashboard_images.dashboard_image_path, verbose_name="작은 이미지")),
            ("original_name", models.CharField(max_length=255, verbose_name="이미지 파일명")),
            ("size", models.PositiveIntegerField(verbose_name="용량 (bytes)")),
            ("width", models.PositiveIntegerField(verbose_name="이미지 너비")),
            ("height", models.PositiveIntegerField(verbose_name="이미지 높이")),
            ("content_type", models.CharField(max_length=50, verbose_name="이미지 형식")),
            ("uploaded_at", models.DateTimeField(auto_now=True, verbose_name="등록 날짜")),
            ("company", models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name="dashboard_image", to="companies.company")),
            ("uploaded_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to=settings.AUTH_USER_MODEL, verbose_name="등록 사용자")),
        ], options={"db_table": "com_dashboard_image"},
    )]
