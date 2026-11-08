from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient
from .importers import fixed_legacy_preview
from .models import Company, CompanyAssignment, System
from .views import CompanyViewSet


class SystemRowsTests(TestCase):
    def test_edit_permission_uses_both_support_names_and_blocks_direct_api_writes(self):
        User = get_user_model()
        primary = User.objects.create_user(username="primary", first_name="홍지원")
        secondary = User.objects.create_user(username="secondary", first_name="김보조")
        outsider = User.objects.create_user(username="outsider", first_name="이외부")
        company = Company.objects.create(name="공동 지원", support_staff="홍지원 차장 / 김보조(대리)")
        system = System.objects.create(company=company, name="기존")
        client = APIClient()
        url = f"/api/companies/{company.pk}/"
        for user, fields in (
            (primary, {"supplied_server": True, "supplied_os": True}),
            (secondary, {"supplied_os": False, "supplied_db": True}),
        ):
            client.force_authenticate(user)
            self.assertTrue(client.get(url).data["can_edit"])
            self.assertEqual(client.patch(url, fields, format="json").status_code, 200)
            self.assertEqual(client.patch(f"/api/systems/{system.pk}/", {"name": user.username}, format="json").status_code, 200)
        company.refresh_from_db()
        self.assertTrue(company.supplied_server)
        self.assertFalse(company.supplied_os)
        self.assertTrue(company.supplied_db)

        client.force_authenticate(outsider)
        self.assertFalse(client.get(url).data["can_edit"])
        self.assertEqual(client.patch(url, {"support_staff": outsider.first_name}, format="json").status_code, 403)
        self.assertEqual(client.patch(f"/api/systems/{system.pk}/", {"name": "변경 시도"}, format="json").status_code, 403)
        self.assertEqual(client.post("/api/systems/", {"company": company.pk, "name": "추가 시도"}, format="json").status_code, 403)
        self.assertEqual(client.delete(f"/api/systems/{system.pk}/").status_code, 403)
        self.assertEqual(client.patch("/api/auth/profile/", {"name": secondary.first_name}, format="json").status_code, 400)
        self.assertFalse(client.get(url).data["can_edit"])

    def test_new_site_can_register_initial_details_and_registrant_can_edit(self):
        user = get_user_model().objects.create_user(username="registrar", first_name="등록자")
        client = APIClient()
        client.force_authenticate(user)
        payload = {"name": "신규 사이트", "registration_records": {"systems": [{"name": "신규 시스템"}]}}
        created = client.post("/api/companies/", payload, format="json")
        self.assertEqual(created.status_code, 201, created.data)
        self.assertTrue(created.data["can_edit"])
        self.assertEqual(created.data["systems"][0]["name"], "신규 시스템")
        rejected = client.post("/api/companies/", {
            "name": "잘못된 신규 사이트", "registration_records": {"systems": [{"database_port": "invalid"}]},
        }, format="json")
        self.assertEqual(rejected.status_code, 400, rejected.data)
        self.assertFalse(Company.objects.filter(name="잘못된 신규 사이트").exists())

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
        owner = User.objects.create_user(username="owner", first_name="홍지원")
        outsider = User.objects.create_user(username="outsider", first_name="다른사람")
        company = Company.objects.create(name="행 편집", support_staff="홍지원 차장 / 김보조 사원")
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
