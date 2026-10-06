from django.test import TestCase

from .importers import fixed_legacy_preview, parse_solution_quantity
from .models import Company
from .views import CompanyViewSet
from .template_import import _convert


class SolutionQuantityImportTests(TestCase):
    def test_dashboard_port_is_text_in_legacy_template_and_api(self):
        from .serializers import SystemSerializer
        value = "8080 / 8443\n관리: 9090"
        self.assertEqual(_convert("dashboard_port", value), value)
        self.assertIsNone(_convert("dashboard_port", " - "))
        grid = [[None] * 15 for _ in range(32)]
        grid[20][13] = value
        values = fixed_legacy_preview("현행화", grid)["data"]
        company = Company.objects.create(name="Dashboard 포트 테스트")
        CompanyViewSet._create_import_related(company, values)
        system = company.systems.get()
        self.assertEqual(system.dashboard_port, value)
        serializer = SystemSerializer(system, data={"dashboard_port": "80,443"}, partial=True)
        self.assertTrue(serializer.is_valid(), serializer.errors)
        serializer.save()
        system.refresh_from_db()
        self.assertEqual(system.dashboard_port, "80,443")

    def test_web_port_accepts_multiple_text_values(self):
        from .serializers import SystemSerializer
        value = "8080, 8443\n관리: 9090"
        self.assertEqual(_convert("web_port", value), value)
        company = Company.objects.create(name="다중 Web 포트")
        CompanyViewSet._create_import_related(company, {"web_port": value})
        system = company.systems.get()
        self.assertEqual(system.web_port, value)
        serializer = SystemSerializer(system, data={"web_port": "80 / 443"}, partial=True)
        self.assertTrue(serializer.is_valid(), serializer.errors)
        serializer.save()
        system.refresh_from_db()
        self.assertEqual(system.web_port, "80 / 443")

    def test_dash_is_blank_but_embedded_hyphens_and_zero_are_preserved(self):
        grid = [[None] * 15 for _ in range(32)]
        grid[1][2] = "사이트-A"
        grid[4][6] = " - "
        grid[10][3] = "02-123-4567"
        grid[12][2] = "TRAP"
        grid[13][2] = "-"
        grid[20][13] = "-"
        values = fixed_legacy_preview("현행화", grid)["data"]
        self.assertEqual(values["name"], "사이트-A")
        self.assertEqual(values["contact_phone"], "02-123-4567")
        self.assertNotIn("business_code", values)
        self.assertNotIn("dashboard_port", values)
        self.assertEqual(values["solutions"], [])
        self.assertEqual(parse_solution_quantity(" - "), {})
        for key in ("name", "web_port", "remote_support", "current_file_date", "license_sms_total"):
            self.assertIsNone(_convert(key, " - \n"))
        self.assertEqual(_convert("name", "사이트-A"), "사이트-A")
        self.assertEqual(_convert("license_sms_total", 0), 0)

    def test_quantities_and_notes_are_stored_separately(self):
        grid = [[None] * 15 for _ in range(32)]
        grid[12][2] = "TMS"
        grid[13][2] = "0/124\n교데통 : 43\n나이스 : 81"
        values = fixed_legacy_preview("현행화", grid)["data"]
        company = Company.objects.create(name="수량 설명 테스트")
        CompanyViewSet._create_import_related(company, values)
        solution = company.solutions.get()
        self.assertEqual(solution.used_quantity, 0)
        self.assertEqual(solution.total_quantity, 124)
        self.assertEqual(solution.other_detail, "교데통 : 43\n나이스 : 81")

    def test_quantity_formats_and_non_quantity_text(self):
        cases = [
            ("0/0", {"used_quantity": 0, "total_quantity": 0}),
            ("1,000 / 2,000\r\n세부 설명", {"used_quantity": 1000, "total_quantity": 2000, "other_detail": "세부 설명"}),
            ("124\n교데통 : 43\n나이스 : 81", {"used_quantity": 124, "other_detail": "교데통 : 43\n나이스 : 81"}),
            ("커스터마이징(정식)", {"other_detail": "커스터마이징(정식)"}),
            ("설명/추가 설명", {"other_detail": "설명/추가 설명"}),
            (0, {"used_quantity": 0}),
            (124.0, {"used_quantity": 124}),
        ]
        for value, expected in cases:
            with self.subTest(value=value):
                self.assertEqual(parse_solution_quantity(value), expected)

    def test_legacy_compatibility_keeps_zero_and_notes(self):
        grid = [[None] * 15 for _ in range(32)]
        grid[12][2] = "TRAP"
        grid[13][2] = "0/100\n설명"
        values = fixed_legacy_preview("현행화", grid)["data"]
        self.assertEqual(values["license_trap_used"], 0)
        self.assertEqual(values["license_trap_total"], 100)
        self.assertEqual(values["license_trap_other"], "설명")
