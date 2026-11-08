from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient
from .models import Company, CompanyAssignment
from .site_assignments import brainz_account


class AssignmentTransferTests(TestCase):
    def test_transfer_and_unassignment(self):
        User = get_user_model()
        admin = User.objects.create_user(username="transfer_admin", is_staff=True)
        first = User.objects.create_user(username="first")
        second = User.objects.create_user(username="second")
        archive = brainz_account()
        site = Company.objects.create(name="이동 사이트")
        CompanyAssignment.objects.create(company=site, user=archive)
        client = APIClient()
        client.force_authenticate(admin)
        for target, ids, expected in ((first, [site.pk], first), (second, [site.pk], second), (second, [], archive)):
            response = client.put("/api/admin/assignments/", {"user_id": target.pk, "company_ids": ids}, format="json")
            self.assertEqual(response.status_code, 200)
            self.assertEqual(list(site.assignments.values_list("user_id", flat=True)), [expected.pk])
            for account in (first, second, archive):
                client.force_authenticate(account)
                url = f"/api/companies/{site.pk}/"
                mine = client.get("/api/companies/mine/").data
                self.assertEqual(site.pk in {company["id"] for company in mine}, account == expected)
                self.assertEqual(client.get(url).data["can_edit"], account == expected)
                self.assertEqual(
                    client.patch(url, {"notes": account.username}, format="json").status_code,
                    200 if account == expected else 403,
                )
            client.force_authenticate(admin)
        self.assertEqual(client.put("/api/admin/assignments/", {"user_id": admin.pk, "company_ids": [site.pk]}, format="json").status_code, 400)
        self.assertEqual(client.get(f"/api/companies/{site.pk}/").status_code, 200)

    def test_reassignment_revokes_registrant_edit_access_unless_named_as_support(self):
        User = get_user_model()
        admin, _ = User.objects.update_or_create(username="brainz_admin", defaults={"is_staff": True})
        registrant = User.objects.create_user(username="registrant", first_name="등록한 사람")
        assignee = User.objects.create_user(username="assignee", first_name="할당된 사람")
        client = APIClient()
        client.force_authenticate(registrant)
        result = client.post("/api/companies/", {
            "name": "재할당 사이트", "support_staff": "다른 사람 차장", "created_by": assignee.pk,
        }, format="json")
        self.assertEqual(result.status_code, 201, result.data)
        self.assertEqual(result.data["created_by"], registrant.pk)
        self.assertTrue(result.data["can_edit"])
        company_id = result.data["id"]
        url = f"/api/companies/{company_id}/"
        client.force_authenticate(admin)
        self.assertEqual(client.put("/api/admin/assignments/", {
            "user_id": assignee.pk, "company_ids": [company_id],
        }, format="json").status_code, 200)

        for user in (admin, assignee):
            with self.subTest(user=user.username):
                client.force_authenticate(user)
                self.assertTrue(client.get(url).data["can_edit"])
                updated = client.patch(url, {"support_staff": "또 다른 사람 부장", "created_by": assignee.pk}, format="json")
                self.assertEqual(updated.status_code, 200, updated.data)
                self.assertEqual(updated.data["created_by"], registrant.pk)

        client.force_authenticate(registrant)
        self.assertFalse(client.get(url).data["can_edit"])
        self.assertEqual(client.patch(url, {"notes": "수정 시도"}, format="json").status_code, 403)
        client.force_authenticate(assignee)
        updated = client.patch(url, {"support_staff": "다른 사람 부장 / 등록한 사람 차장"}, format="json")
        self.assertEqual(updated.status_code, 200, updated.data)
        client.force_authenticate(registrant)
        self.assertTrue(client.get(url).data["can_edit"])
        self.assertEqual(client.patch(url, {"notes": "지원인력 수정"}, format="json").status_code, 200)
        self.assertEqual(client.get("/api/companies/mine/").data, [])

    def test_invalid_list_keeps_existing_assignments(self):
        user = get_user_model().objects.create_user(username="invalid_target")
        admin = get_user_model().objects.create_user(username="invalid_admin", is_staff=True)
        site = Company.objects.create(name="보존 사이트")
        CompanyAssignment.objects.create(company=site, user=user)
        client = APIClient()
        client.force_authenticate(admin)
        result = client.put("/api/admin/assignments/", {"user_id": user.pk, "company_ids": [999999]}, format="json")
        self.assertEqual(result.status_code, 400)
        self.assertTrue(site.assignments.filter(user=user).exists())
