from django.contrib.auth import get_user_model
from django.contrib.auth.tokens import default_token_generator
from django.core import mail
from django.test import TestCase, override_settings
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode
from rest_framework.test import APIClient
from .models import UserProfile


@override_settings(PASSWORD_RECOVERY_EMAIL_ENABLED=True, MAILERS={"default": {"BACKEND": "django.core.mail.backends.locmem.EmailBackend"}})
class AccountRecoveryTests(TestCase):
    def setUp(self):
        from django.core.cache import cache
        cache.clear()
        self.client = APIClient()
        self.admin = get_user_model().objects.create_user(username="admin", is_staff=True)
        self.user = get_user_model().objects.create_user(username="member", first_name="Member", email="member@example.com", password="old-password")

    def test_admin_checkbox_permissions(self):
        self.client.force_authenticate(self.user)
        url = f"/api/admin/users/{self.user.pk}/"
        self.assertEqual(self.client.patch(url, {"is_admin": True}, format="json").status_code, 403)
        self.client.force_authenticate(self.admin)
        self.assertEqual(self.client.patch(url, {"is_admin": True}, format="json").status_code, 200)
        self.user.refresh_from_db()
        self.assertTrue(self.user.is_staff)
        self.assertEqual(self.client.patch(url, {"is_admin": False}, format="json").status_code, 200)
        self.assertEqual(self.client.patch(f"/api/admin/users/{self.admin.pk}/", {"is_admin": False}, format="json").status_code, 400)

    def test_reset_requires_registered_employee_number_and_email_token(self):
        UserProfile.objects.create(user=self.user, employee_number="123")
        url = "/api/auth/password-reset/"
        self.client.post(url, {"username": "member", "name": "Member", "employee_number": "wrong"})
        self.assertEqual(len(getattr(mail, "outbox", [])), 0)
        self.client.post(url, {"username": "member", "name": "Member", "employee_number": "123"})
        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(mail.outbox[0].to, ["member@example.com"])
        payload = {"uid": urlsafe_base64_encode(force_bytes(self.user.pk)), "token": default_token_generator.make_token(self.user), "password": "new-password-123", "password_confirm": "new-password-123"}
        self.assertEqual(self.client.post(url + "confirm/", payload).status_code, 200)
        self.assertEqual(self.client.post(url + "confirm/", payload).status_code, 400)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password("new-password-123"))

    def test_unregistered_employee_number_is_optional(self):
        self.client.post("/api/auth/password-reset/", {"username": "member", "name": "Member"})
        self.assertEqual(len(mail.outbox), 1)
