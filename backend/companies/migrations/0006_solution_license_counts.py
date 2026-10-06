from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("companies", "0005_companyassignment")]

    operations = [
        migrations.AddField(model_name="solution", name="used_quantity", field=models.PositiveIntegerField(blank=True, db_index=True, null=True, verbose_name="사용 개수")),
        migrations.AddField(model_name="solution", name="total_quantity", field=models.PositiveIntegerField(blank=True, db_index=True, null=True, verbose_name="전체 개수")),
        migrations.AddField(model_name="solution", name="other_detail", field=models.CharField(blank=True, max_length=300, verbose_name="기타")),
        migrations.AddField(model_name="solution", name="additional_info", field=models.TextField(blank=True, verbose_name="추가 정보")),
        migrations.AlterModelTableComment(name="solution", table_comment="구축 솔루션과 라이선스 정보: SMS, NMS, DBMS, APM, SYSLOG 등의 사용·전체 개수, 기타, 추가 정보"),
    ]
