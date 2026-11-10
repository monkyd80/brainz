from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from .models import Company, CompanyAssignment, ContractProduct, UserProfile


class DashboardListTests(TestCase):
    def setUp(self):
        user_model = get_user_model()
        self.admin = user_model.objects.create_user(username="dashboard-admin", is_staff=True)
        self.member = user_model.objects.create_user(username="dashboard-member")
        self.client = APIClient()

    def test_dashboard_loads_sites_once_and_fetches_history_separately(self):
        mine = Company.objects.create(name="담당 사이트")
        other = Company.objects.create(name="다른 사이트")
        ContractProduct.objects.create(company=mine, product_name="EMS", package_name="Standard")
        CompanyAssignment.objects.create(company=mine, user=self.member)

        self.client.force_authenticate(self.member)
        response = self.client.get("/api/companies/dashboard/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["mine_ids"], [mine.pk])
        sites = {company["id"]: company for company in response.data["companies"]}
        self.assertEqual(set(sites), {mine.pk, other.pk})
        self.assertTrue(sites[mine.pk]["can_edit"])
        self.assertFalse(sites[other.pk]["can_edit"])
        self.assertNotIn("change_history", sites[mine.pk])
        self.assertEqual(sites[mine.pk]["contract_products"][0]["package_name"], "Standard")

        history = self.client.get(f"/api/companies/{mine.pk}/change-history/")
        detail = self.client.get(f"/api/companies/{mine.pk}/")
        self.assertEqual(history.status_code, 200)
        self.assertTrue(history.data)
        self.assertEqual(history.data, detail.data["change_history"])

        self.client.force_authenticate(self.admin)
        response = self.client.get("/api/companies/dashboard/")
        self.assertEqual(set(response.data["mine_ids"]), {mine.pk, other.pk})

    def test_site_history_summary_omits_related_changes_and_snapshots(self):
        site = Company.objects.create(name="등록일 수정 사이트")
        product = ContractProduct.objects.create(company=site, product_name="EMS")
        self.client.force_authenticate(self.admin)

        response = self.client.patch(
            f"/api/contract-products/{product.pk}/", {"configuration": "기존 구성"}, format="json",
        )
        self.assertEqual(response.status_code, 200)

        site_url = f"/api/companies/{site.pk}/"
        response = self.client.patch(f"{site_url}?include_history=0", {"current_file_date": "2026-11-10"}, format="json")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["current_file_date"], "2026-11-10")
        self.assertNotIn("change_history", response.data)
        self.assertNotIn("change_history", self.client.get(f"{site_url}?include_history=0").data)

        history_url = f"{site_url}change-history/"
        summary = self.client.get(f"{history_url}?summary=1")
        self.assertEqual(summary.status_code, 200)
        self.assertEqual([entry["action"] for entry in summary.data], ["update", "create"])
        self.assertEqual({entry["table_name"] for entry in summary.data}, {"com_company"})
        self.assertEqual(set(summary.data[0]), {"id", "table_name", "action", "changed_at"})
        self.assertTrue(any(entry["table_name"] == "com_product" for entry in self.client.get(history_url).data))

    def test_user_lists_read_assignments_and_profiles_in_bulk(self):
        site = Company.objects.create(name="사용자 목록 테스트")
        CompanyAssignment.objects.create(company=site, user=self.member)
        UserProfile.objects.create(user=self.member, employee_number="0012")
        self.client.force_authenticate(self.admin)

        with self.assertNumQueries(2):
            response = self.client.get("/api/admin/users/")
        self.assertEqual(response.status_code, 200)
        user = next(user for user in response.data if user["id"] == self.member.pk)
        self.assertEqual(user["employee_number"], "0012")
        self.assertEqual(user["company_ids"], [site.pk])

        with self.assertNumQueries(2):
            response = self.client.get("/api/auth/site-user-groups/")
        self.assertEqual(response.status_code, 200)
        group = next(group for group in response.data if group["id"] == self.member.pk)
        self.assertEqual(group["company_ids"], [site.pk])
