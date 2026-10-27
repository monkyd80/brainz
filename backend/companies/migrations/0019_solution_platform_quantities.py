from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("companies", "0018_reconcile_unassigned_sites")]

    operations = [
        migrations.AddField(model_name="solution", name="linux_windows_quantity", field=models.PositiveIntegerField(blank=True, null=True, verbose_name="Linux/Windows")),
        migrations.AddField(model_name="solution", name="unix_quantity", field=models.PositiveIntegerField(blank=True, null=True, verbose_name="UNIX")),
        migrations.AddField(model_name="solution", name="snmp_quantity", field=models.PositiveIntegerField(blank=True, null=True, verbose_name="SNMP")),
        migrations.AddField(model_name="solution", name="icmp_quantity", field=models.PositiveIntegerField(blank=True, null=True, verbose_name="ICMP")),
        migrations.AddField(model_name="solution", name="sdn_quantity", field=models.PositiveIntegerField(blank=True, null=True, verbose_name="SDN")),
        migrations.AddField(model_name="solution", name="oracle_quantity", field=models.PositiveIntegerField(blank=True, null=True, verbose_name="Oracle")),
    ]
