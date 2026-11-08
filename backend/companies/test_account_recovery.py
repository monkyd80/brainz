from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.authtoken.models import Token
from rest_framework.test import APIClient
from .models import UserProfile


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

    def test_reset_requires_all_three_matching_fields(self):
        UserProfile.objects.create(user=self.user, employee_number="00123")
        Token.objects.create(user=self.user)
        url = "/api/auth/password-reset/"
        payload = {"username": "member", "name": "Member", "employee_number": "00123"}
        for field in payload:
            with self.subTest(field=field):
                response = self.client.post(url, {**payload, field: "wrong"})
                self.assertEqual(response.status_code, 400)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password("old-password"))
        self.assertTrue(Token.objects.filter(user=self.user).exists())
        response = self.client.post(url, payload)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data, {"detail": "초기화 되었습니다."})
        self.assertFalse(Token.objects.filter(user=self.user).exists())
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password("brainz337"))

    def test_unregistered_employee_number_cannot_reset_password(self):
        response = self.client.post("/api/auth/password-reset/", {"username": "member", "name": "Member", "employee_number": "123"})
        self.assertEqual(response.status_code, 400)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password("old-password"))

    def test_administrator_cannot_reset_to_shared_password(self):
        self.admin.first_name = "Admin"
        self.admin.save(update_fields=["first_name"])
        UserProfile.objects.create(user=self.admin, employee_number="999")
        response = self.client.post("/api/auth/password-reset/", {"username": "admin", "name": "Admin", "employee_number": "999"})
        self.assertEqual(response.status_code, 400)
