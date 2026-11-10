from pathlib import Path
from tempfile import TemporaryDirectory

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from rest_framework.authtoken.models import Token
from rest_framework.test import APIClient

from .site_assignments import brainz_account


class TemplateDownloadPermissionTests(TestCase):
    def setUp(self):
        directory = TemporaryDirectory(prefix="brainz-template-download-")
        self.addCleanup(directory.cleanup)
        root = Path(directory.name)
        self.template = root / "sample_kdy.xls"
        self.template.write_bytes(b"test template file")
        configured = override_settings(BASE_DIR=root / "backend")
        configured.enable()
        self.addCleanup(configured.disable)
        User = get_user_model()
        self.admin = User.objects.create_user(username="download_admin", is_staff=True)
        self.member = User.objects.create_user(username="download_member")
        self.client = APIClient()

    def authenticate(self, user):
        token, _ = Token.objects.get_or_create(user=user)
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {token.key}")

    def assert_download(self):
        response = self.client.get("/api/companies/import-template/")
        self.assertEqual(response.status_code, 200, getattr(response, "data", None))
        content = b"".join(response.streaming_content)
        self.assertEqual(response["Content-Type"], "application/vnd.ms-excel")
        self.assertIn('attachment; filename="sample_kdy.xls"', response["Content-Disposition"])
        self.assertEqual(content, b"test template file")

    def test_admin_and_member_download_the_template(self):
        for user in (self.admin, self.member):
            with self.subTest(user=user.username):
                self.authenticate(user)
                self.assert_download()
        self.member.refresh_from_db()
        self.assertFalse(self.member.is_staff)
        self.assertEqual(self.client.get("/api/admin/users/").status_code, 403)

    def test_switched_brainz_session_downloads_without_admin_privileges(self):
        archive = brainz_account()
        self.authenticate(self.admin)
        switched = self.client.post("/api/auth/switch-user/", {"user_id": archive.pk}, format="json")
        self.assertEqual(switched.status_code, 200, switched.data)
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {switched.data['token']}")
        self.assert_download()
        self.assertEqual(self.client.get("/api/admin/users/").status_code, 403)
        archive.refresh_from_db()
        self.assertFalse(archive.is_staff)

    def test_anonymous_and_invalid_tokens_cannot_download(self):
        self.assertEqual(self.client.get("/api/companies/import-template/").status_code, 401)
        self.client.credentials(HTTP_AUTHORIZATION="Token invalid-template-token")
        self.assertEqual(self.client.get("/api/companies/import-template/").status_code, 401)

    def test_missing_file_returns_not_found_to_authenticated_user(self):
        self.authenticate(self.member)
        self.template.unlink()
        response = self.client.get("/api/companies/import-template/")
        self.assertEqual(response.status_code, 404, response.data)
        self.assertIn("양식 파일", response.data["detail"])
