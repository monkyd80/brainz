from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient
from .models import Company, CompanyAssignment, System


class UserDeletionTests(TestCase):
    def test_protected_accounts_cannot_be_deleted_by_another_admin(self):
        User = get_user_model()
        admin = User.objects.create_user(username="other_admin", is_staff=True)
        client = APIClient()
        client.force_authenticate(admin)
        for username in ("brainz", "brainz_admin"):
            user, _ = User.objects.get_or_create(username=username)
            response = client.delete(f"/api/admin/users/{user.pk}/")
            self.assertEqual(response.status_code, 400)
            self.assertTrue(User.objects.filter(pk=user.pk).exists())

    def test_deleted_user_sites_move_to_brainz_without_losing_other_assignments(self):
        User = get_user_model()
        admin = User.objects.create_user(username="delete_admin", is_staff=True)
        member = User.objects.create_user(username="departing")
        other = User.objects.create_user(username="remaining")
        archive, _ = User.objects.get_or_create(username="brainz")
        created = Company.objects.create(name="등록 사이트", created_by=member)
        assigned = Company.objects.create(name="할당 사이트", created_by=other)
        shared = Company.objects.create(name="공유 사이트")
        untouched = Company.objects.create(name="무관 사이트", created_by=other)
        System.objects.create(company=created, name="보존할 시스템", web_port="80/443")
        for site in (created, assigned, shared):
            CompanyAssignment.objects.create(company=site, user=member)
        CompanyAssignment.objects.create(company=shared, user=other)
        CompanyAssignment.objects.create(company=shared, user=archive)
        client = APIClient()
        client.force_authenticate(admin)
        self.assertEqual(client.delete(f"/api/admin/users/{member.pk}/").status_code, 204)
        self.assertFalse(User.objects.filter(pk=member.pk).exists())
        self.assertEqual(set(archive.company_assignments.values_list("company_id", flat=True)), {created.pk, assigned.pk})
        created.refresh_from_db()
        assigned.refresh_from_db()
        self.assertEqual(created.created_by_id, archive.pk)
        self.assertEqual(assigned.created_by_id, other.pk)
        self.assertTrue(CompanyAssignment.objects.filter(user=other, company=shared).exists())
        self.assertTrue(Company.objects.filter(pk=untouched.pk).exists())
        self.assertEqual(created.systems.get().web_port, "80/443")
        self.assertEqual(client.delete(f"/api/admin/users/{archive.pk}/").status_code, 400)

    def test_created_site_without_assignment_is_also_transferred(self):
        User = get_user_model()
        admin = User.objects.create_user(username="admin2", is_staff=True)
        member = User.objects.create_user(username="member2")
        site = Company.objects.create(name="할당 없는 등록 사이트", created_by=member)
        client = APIClient()
        client.force_authenticate(admin)
        self.assertEqual(client.delete(f"/api/admin/users/{member.pk}/").status_code, 204)
        self.assertTrue(CompanyAssignment.objects.filter(company=site, user__username="brainz").exists())
