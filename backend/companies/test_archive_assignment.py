from unittest.mock import patch
from django.contrib.auth import get_user_model
from django.test import TestCase
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient
from .models import Company
from .site_assignments import brainz_account


class ArchiveAssignmentTests(TestCase):
    def setUp(self):
        User = get_user_model()
        self.admin = User.objects.create_user(username="archive_admin", is_staff=True)
        self.member = User.objects.create_user(username="archive_member")
        self.archive = brainz_account()
        self.client = APIClient()

    def test_manual_admin_and_member_registration(self):
        for actor, name, target in ((self.admin, "관리자 등록", self.archive), (self.member, "사용자 등록", self.member)):
            self.client.force_authenticate(actor)
            result = self.client.post("/api/companies/", {"name": name}, format="json")
            self.assertEqual(result.status_code, 201)
            company = Company.objects.get(pk=result.data["id"])
            self.assertEqual(company.created_by, actor)
            self.assertEqual(list(company.assignments.values_list("user_id", flat=True)), [target.pk])
        self.client.force_authenticate(self.admin)
        groups = self.client.get("/api/auth/site-user-groups/").data
        archive_group = next(group for group in groups if group["username"] == "brainz")
        self.assertIn(Company.objects.get(name="관리자 등록").pk, archive_group["company_ids"])

    def test_excel_registration_assigns_brainz(self):
        self.client.force_authenticate(self.admin)
        preview = {"sheet_name": "테스트", "data": {"name": "관리자 엑셀"}, "mapped": [], "missing": [], "unmapped_source_labels": []}
        with patch("companies.views.preview_upload", return_value=preview):
            result = self.client.post("/api/companies/import-commit/", {"file": SimpleUploadedFile("test.xls", b"test")}, format="multipart")
        self.assertEqual(result.status_code, 201)
        self.assertTrue(Company.objects.get(name="관리자 엑셀").assignments.filter(user=self.archive).exists())

    def test_archive_access_is_switch_only_and_accounts_protected(self):
        self.assertFalse(self.archive.has_usable_password())
        self.archive.set_password("temporary-test-password")
        self.archive.save()
        self.assertEqual(self.client.post("/api/auth/login/", {"username": "brainz", "password": "temporary-test-password"}).status_code, 401)
        self.client.force_authenticate(self.admin)
        self.assertEqual(self.client.post(f"/api/admin/users/{self.archive.pk}/password/", {"password": "new-password"}).status_code, 400)
        switched = self.client.post("/api/auth/switch-user/", {"user_id": self.archive.pk}, format="json")
        self.assertEqual(switched.status_code, 200)
        self.assertEqual(switched.data["user"]["username"], "brainz")
        for username in ("brainz", "brainz_admin"):
            account, _ = get_user_model().objects.get_or_create(username=username)
            self.assertEqual(self.client.delete(f"/api/admin/users/{account.pk}/").status_code, 400)
        self.client.force_authenticate(self.member)
        self.assertEqual(self.client.post("/api/auth/switch-user/", {"user_id": self.archive.pk}, format="json").status_code, 403)
