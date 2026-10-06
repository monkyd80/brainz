from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("companies", "0006_solution_license_counts")]

    operations = [
        migrations.AlterField(model_name="solution", name="other_detail", field=models.CharField(blank=True, db_index=True, max_length=300, verbose_name="기타")),
        migrations.AddIndex(model_name="solution", index=models.Index(fields=["company", "category"], name="com_lic_company_category_idx")),
    ]
