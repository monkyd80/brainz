from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from .models import Company, CompanyAssignment, Notice, NoticeRead


class SiteTransferNoticeTests(TestCase):
    def setUp(self):
        users = get_user_model().objects
        self.owner = users.create_user(username="transfer-owner", first_name="기존 담당자")
        self.support = users.create_user(username="transfer-support", first_name="지원 담당자")
        self.recipient = users.create_user(username="transfer-recipient", first_name="새 담당자")
        self.other = users.create_user(username="transfer-other")
        self.site = Company.objects.create(name="이관 전", created_by=self.owner, support_staff=" / 지원 담당자")
        CompanyAssignment.objects.create(company=self.site, user=self.owner)
        self.url = f"/api/companies/{self.site.pk}/"
        self.client = APIClient()

    def test_support_editor_can_transfer_and_permissions_are_recalculated(self):
        self.client.force_authenticate(self.other)
        self.assertEqual(self.client.patch(self.url, {"transfer_to": self.recipient.pk}, format="json").status_code, 403)
        self.assertFalse(Notice.objects.exists())

        self.client.force_authenticate(self.support)
        payload = {"transfer_to": self.recipient.pk, "name": "이관 후"}
        response = self.client.patch(self.url, payload, format="json")
        self.assertEqual(response.status_code, 200, response.data)
        self.assertTrue(response.data["can_edit"])
        self.assertEqual(response.data["created_by"], self.owner.pk)
        self.assertEqual(list(self.site.assignments.values_list("user_id", flat=True)), [self.recipient.pk])
        notice = Notice.objects.get()
        self.assertIn("기존 담당자:이관 전 -> 새 담당자:이관 후", notice.body)
        self.assertEqual(self.client.patch(self.url, payload, format="json").status_code, 200)
        self.assertEqual(Notice.objects.count(), 1)

        self.assertEqual(self.client.patch(self.url, {"support_staff": ""}, format="json").status_code, 200)
        self.assertFalse(self.client.get(self.url).data["can_edit"])
        self.client.force_authenticate(self.owner)
        self.assertEqual(self.client.patch(self.url, {"notes": "이전 담당자"}, format="json").status_code, 403)
        self.client.force_authenticate(self.recipient)
        self.assertTrue(self.client.get(self.url).data["can_edit"])
        self.assertEqual([company["id"] for company in self.client.get("/api/companies/mine/").data], [self.site.pk])

    def test_invalid_recipient_leaves_assignment_and_site_unchanged(self):
        self.recipient.is_active = False
        self.recipient.save(update_fields=["is_active"])
        self.client.force_authenticate(self.owner)
        response = self.client.patch(self.url, {"transfer_to": self.recipient.pk, "name": "변경 시도"}, format="json")
        self.assertEqual(response.status_code, 400)
        self.site.refresh_from_db()
        self.assertEqual(self.site.name, "이관 전")
        self.assertTrue(self.site.assignments.filter(user=self.owner).exists())
        self.assertFalse(Notice.objects.exists())

    def test_only_admin_can_register_and_delete_notices(self):
        admin = get_user_model().objects.create_user(username="notice-admin", is_staff=True)
        payload = {"title": "  점검 공지  ", "body": "점검 안내"}
        self.client.force_authenticate(self.owner)
        self.assertEqual(self.client.post("/api/notices/", payload, format="json").status_code, 403)

        self.client.force_authenticate(admin)
        self.assertEqual(self.client.post("/api/notices/", {"title": " ", "body": " "}, format="json").status_code, 400)
        response = self.client.post("/api/notices/", payload, format="json")
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data["title"], "점검 공지")
        self.assertTrue(response.data["created_at"])
        notice_id = response.data["id"]
        url = f"/api/notices/{notice_id}/"

        self.client.force_authenticate(self.owner)
        self.assertEqual(self.client.get("/api/notices/?unread=1").data[0]["id"], notice_id)
        self.assertEqual(self.client.delete(url).status_code, 403)
        self.assertEqual(self.client.post(url + "read/").status_code, 204)
        self.assertTrue(NoticeRead.objects.filter(notice_id=notice_id).exists())

        self.client.force_authenticate(admin)
        self.assertEqual(self.client.delete(url).status_code, 204)
        self.assertFalse(NoticeRead.objects.filter(notice_id=notice_id).exists())
        self.assertEqual(self.client.get("/api/notices/").data, [])

    def test_reads_are_per_account_and_read_all_does_not_hide_future_notices(self):
        first = Notice.objects.create(title="첫 공지", body="내용")
        second = Notice.objects.create(title="최근 공지", body="내용")
        self.assertEqual(self.client.get("/api/notices/").status_code, 401)

        self.client.force_authenticate(self.owner)
        self.assertEqual(self.client.get("/api/notices/?unread=1").data[0]["id"], second.pk)
        for _ in range(2):
            self.assertEqual(self.client.post(f"/api/notices/{second.pk}/read/").status_code, 204)
        self.assertEqual(self.client.get("/api/notices/?unread=1").data[0]["id"], first.pk)
        self.assertEqual(self.client.post("/api/notices/read-all/").status_code, 204)
        self.assertEqual(self.client.get("/api/notices/?unread=1").data, [])
        self.assertTrue(all(notice["is_read"] for notice in self.client.get("/api/notices/").data))

        self.client.force_authenticate(self.other)
        self.assertEqual(self.client.get("/api/notices/?unread=1").data[0]["id"], second.pk)
        newest = Notice.objects.create(title="새 공지", body="내용")
        self.client.force_authenticate(self.owner)
        self.assertEqual(self.client.get("/api/notices/?unread=1").data[0]["id"], newest.pk)
