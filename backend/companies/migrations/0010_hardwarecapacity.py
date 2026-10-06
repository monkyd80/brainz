from django.db import migrations, models

class Migration(migrations.Migration):
    dependencies = [("companies", "0009_lookupoption")]
    operations = [migrations.CreateModel(name="HardwareCapacity", fields=[("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")), ("directory", models.CharField(db_index=True, max_length=1000, verbose_name="디렉토리")), ("used_capacity", models.CharField(blank=True, max_length=100, verbose_name="사용량")), ("total_capacity", models.CharField(blank=True, max_length=100, verbose_name="전체")), ("available_capacity", models.CharField(blank=True, max_length=100, verbose_name="가용량")), ("company", models.ForeignKey(on_delete=models.deletion.CASCADE, related_name="hardware_capacities", to="companies.company"))], options={"db_table": "com_hw_capacity", "db_table_comment": "업체별 H/W 디렉토리 용량: 사용량, 전체 용량, 가용량"})]
