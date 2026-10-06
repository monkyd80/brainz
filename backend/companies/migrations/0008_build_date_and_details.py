from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("companies", "0007_solution_lookup_indexes")]

    operations = [
        migrations.AddField(model_name="company", name="build_date", field=models.DateField(blank=True, db_index=True, null=True, verbose_name="구축 날짜")),
        migrations.AddField(model_name="contact", name="inspection_report_detail", field=models.TextField(blank=True, verbose_name="점검지 제출 상세")),
        migrations.AddField(model_name="hardwarespec", name="other_detail", field=models.TextField(blank=True, verbose_name="기타")),
    ]
