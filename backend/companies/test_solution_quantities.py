from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from .models import Company, Solution


class SolutionQuantityTests(TestCase):
    def setUp(self):
        self.company = Company.objects.create(name="솔루션 세부 수량 테스트")
        self.client = APIClient()
        self.client.force_authenticate(get_user_model().objects.create_user(username="quantity_admin", is_staff=True))

    def test_quantities_round_trip_and_can_be_cleared(self):
        cases = {
            "sms": {"linux_windows_quantity": 0, "unix_quantity": 12},
            "nms": {"snmp_quantity": 99, "icmp_quantity": 23, "sdn_quantity": 0},
            "dbms": {"oracle_quantity": 5},
        }
        for category, quantities in cases.items():
            with self.subTest(category=category):
                response = self.client.post("/api/solutions/", {
                    "company": self.company.pk, "category": category,
                    "product_name": category.upper(), "additional_info": "기존 추가 정보",
                    **quantities,
                }, format="json")
                self.assertEqual(response.status_code, 201, response.data)
                solution_id = response.data["id"]
                detail = self.client.get(f"/api/companies/{self.company.pk}/")
                saved = next(row for row in detail.data["solutions"] if row["id"] == solution_id)
                for field, value in quantities.items():
                    self.assertEqual(saved[field], value)
                self.assertEqual(saved["additional_info"], "기존 추가 정보")
                cleared = self.client.patch(f"/api/solutions/{solution_id}/", {field: None for field in quantities}, format="json")
                self.assertEqual(cleared.status_code, 200, cleared.data)
                for field in quantities:
                    self.assertIsNone(cleared.data[field])
                history = self.company.change_history.filter(table_name="com_lic", record_id=solution_id, action="update").latest("pk")
                for field in quantities:
                    self.assertIn(field, history.changed_fields)

    def test_invalid_counts_are_rejected_without_saving(self):
        for field in ("linux_windows_quantity", "unix_quantity", "snmp_quantity", "icmp_quantity", "sdn_quantity", "oracle_quantity"):
            for invalid in (-1, 1.5, "숫자아님"):
                with self.subTest(field=field, invalid=invalid):
                    response = self.client.post("/api/solutions/", {
                        "company": self.company.pk, "category": "sms", field: invalid,
                    }, format="json")
                    self.assertEqual(response.status_code, 400, response.data)
                    self.assertIn(field, response.data)
        self.assertEqual(self.company.solutions.count(), 0)

    def test_existing_solution_remains_compatible(self):
        solution = Solution.objects.create(company=self.company, category="sms", used_quantity=239, total_quantity=239, additional_info="유지할 정보")
        response = self.client.patch(f"/api/solutions/{solution.pk}/", {"linux_windows_quantity": 239, "unix_quantity": 0}, format="json")
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data["used_quantity"], 239)
        self.assertEqual(response.data["total_quantity"], 239)
        self.assertEqual(response.data["additional_info"], "유지할 정보")
