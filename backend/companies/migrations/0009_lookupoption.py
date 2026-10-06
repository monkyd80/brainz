from django.db import migrations, models

class Migration(migrations.Migration):
    dependencies = [("companies", "0008_build_date_and_details")]
    operations = [migrations.CreateModel(name="LookupOption", fields=[("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")), ("category", models.CharField(db_index=True, max_length=60, verbose_name="항목 분류")), ("value", models.CharField(db_index=True, max_length=200, verbose_name="선택값")), ("sort_order", models.PositiveIntegerField(default=0, verbose_name="표시 순서")), ("is_active", models.BooleanField(default=True, verbose_name="사용"))], options={"db_table": "com_lookup_option", "ordering": ["category", "sort_order", "value"], "db_table_comment": "수동 등록 선택 항목 관리: 계약, 제품, OS, DB 등 드롭다운 값"}), migrations.AddConstraint(model_name="lookupoption", constraint=models.UniqueConstraint(fields=("category", "value"), name="unique_lookup_category_value"))]
