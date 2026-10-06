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
        self.assertEqual(client.put("/api/admin/assignments/", {"user_id": admin.pk, "company_ids": [site.pk]}, format="json").status_code, 400)
        self.assertEqual(client.get(f"/api/companies/{site.pk}/").status_code, 200)

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
