from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient
from .importers import fixed_legacy_preview
from .models import Company, CompanyAssignment, System
from .views import CompanyViewSet


class SystemRowsTests(TestCase):
    def test_excel_multiple_rows_skip_blanks_and_stop_at_ports(self):
        grid = [[None] * 15 for _ in range(35)]
        for col, label in ((2, "Set 구성"), (4, "OS"), (6, "버전"), (7, "DB"), (9, "IP Address"), (11, "시스템접속정보"), (13, "Web접속정보")):
            grid[17][col] = label
        grid[18][2], grid[18][4], grid[18][9] = "통합", "Linux", "180.81.125.33"
        grid[19][2] = "-"
        grid[20][2], grid[20][4], grid[20][9] = "보조", "Windows", "*.*.*.32"
        grid[21][2], grid[21][4], grid[21][9], grid[21][13] = "Web 포트", "8080/8443", 15432, "9090"
        grid[22][2] = "설치 위치 정보"
        data = fixed_legacy_preview("현행화", grid)["data"]
        self.assertEqual(len(data["systems"]), 2)
        self.assertEqual(data["systems"][1]["ip_address"], "*.*.*.32")
        self.assertEqual(data["systems"][0]["web_port"], "8080/8443")
        company = Company.objects.create(name="시스템 다중 행")
        CompanyViewSet._create_import_related(company, data)
        self.assertEqual(company.systems.count(), 2)

    def test_system_rows_update_is_atomic_and_permission_checked(self):
        User = get_user_model()
        owner = User.objects.create_user(username="owner")
        outsider = User.objects.create_user(username="outsider")
        company = Company.objects.create(name="행 편집")
        CompanyAssignment.objects.create(company=company, user=owner)
        first = System.objects.create(company=company, name="기존")
        removed = System.objects.create(company=company, name="삭제할 행")
        client = APIClient()
        url = f"/api/companies/{company.pk}/system-rows/"
        client.force_authenticate(outsider)
        self.assertEqual(client.put(url, {"systems": []}, format="json").status_code, 403)
        client.force_authenticate(owner)
        rows = [{"id": first.pk, "name": "변경", "web_port": "80/443"}, {"name": "추가", "database_port": "invalid"}]
        self.assertEqual(client.put(url, {"systems": rows}, format="json").status_code, 400)
        first.refresh_from_db()
        self.assertEqual(first.name, "기존")
        self.assertTrue(System.objects.filter(pk=removed.pk).exists())
        rows[1]["database_port"] = 15432
        self.assertEqual(client.put(url, {"systems": rows}, format="json").status_code, 200)
        first.refresh_from_db()
        self.assertEqual(first.name, "변경")
        self.assertEqual(company.systems.count(), 2)
        self.assertFalse(System.objects.filter(pk=removed.pk).exists())
