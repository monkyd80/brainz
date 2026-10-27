import json
import tempfile
from pathlib import Path
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from rest_framework.test import APIClient

from .file_uploads import MAX_SITE_FILE_BYTES
from .models import Company, CompanyAssignment, CompanyAttachment


class SiteAttachmentTests(TestCase):
    def setUp(self):
        directory = tempfile.TemporaryDirectory()
        self.addCleanup(directory.cleanup)
        override = self.settings(MEDIA_ROOT=directory.name)
        override.enable()
        self.addCleanup(override.disable)
        self.media = Path(directory.name)
        self.admin = get_user_model().objects.create_user(username="file_admin", is_staff=True)
        self.client = APIClient()
        self.client.force_authenticate(self.admin)
        self.site = Company.objects.create(name="첨부파일 사이트")

    def upload(self, name="설치 가이드.txt", contents=b"attachment contents"):
        return SimpleUploadedFile(name, contents, content_type="application/octet-stream")

    def save(self, files, site=None, **values):
        return self.client.patch(f"/api/companies/{(site or self.site).pk}/", {
            "data": json.dumps(values), "files": files,
        }, format="multipart")

    def test_create_multiple_files_and_protected_download(self):
        response = self.client.post("/api/companies/", {
            "data": json.dumps({"name": "파일과 함께 등록", "remote_support": False, "current_file_date": None}),
            "files": [self.upload(), self.upload("구성.pdf", b"example pdf contents")],
        }, format="multipart")
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(len(response.data["attachments"]), 2)
        company = Company.objects.get(pk=response.data["id"])
        detail = self.client.get(f"/api/companies/{company.pk}/")
        self.assertEqual(len(detail.data["attachments"]), 2)
        for item in detail.data["attachments"]:
            self.assertTrue(item["uploaded_at"])
            self.assertNotIn("file", item)
            row = CompanyAttachment.objects.get(pk=item["id"])
            self.assertEqual(row.uploaded_by, self.admin)
            self.assertEqual(item["size"], row.file.size)
            self.assertTrue(Path(row.file.path).is_file())
            downloaded = self.client.get(f"/api/site-files/{row.pk}/download/")
            self.assertEqual(downloaded.status_code, 200)
            self.assertIn("attachment;", downloaded["Content-Disposition"])
            self.assertEqual(downloaded["X-Content-Type-Options"], "nosniff")
            self.assertEqual(len(b"".join(downloaded.streaming_content)), row.size)
            downloaded.close()
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get(f"/api/site-files/{row.pk}/download/").status_code, 401)
        self.assertEqual(self.client.get("/api/site-files/").status_code, 401)

    def test_exact_limit_accepted_and_oversized_batch_does_not_create_site(self):
        exact = self.save([self.upload("5mb.bin", b"x" * MAX_SITE_FILE_BYTES)])
        self.assertEqual(exact.status_code, 200, exact.data)
        self.assertEqual(exact.data["attachments"][0]["size"], MAX_SITE_FILE_BYTES)
        response = self.client.post("/api/companies/", {
            "data": json.dumps({"name": "용량 초과 등록"}),
            "files": [self.upload("valid.txt"), self.upload("large.bin", b"x" * (MAX_SITE_FILE_BYTES + 1))],
        }, format="multipart")
        self.assertEqual(response.status_code, 400, response.data)
        self.assertIn("5MB", str(response.data))
        self.assertFalse(Company.objects.filter(name="용량 초과 등록").exists())
        self.assertEqual(CompanyAttachment.objects.count(), 1)

    def test_invalid_upload_preserves_site_values_and_existing_files(self):
        self.save([self.upload()])
        for contents in (b"", b"x" * (MAX_SITE_FILE_BYTES + 1)):
            response = self.save([self.upload("invalid.bin", contents)], notes="저장하면 안 되는 값")
            self.assertEqual(response.status_code, 400, response.data)
        self.site.refresh_from_db()
        self.assertEqual(self.site.notes, "")
        self.assertEqual(self.site.attachments.count(), 1)

    def test_files_are_grouped_by_site_and_duplicate_names_do_not_overwrite(self):
        first = self.save([self.upload(contents=b"first")])
        self.assertEqual(first.status_code, 200, first.data)
        second = self.save([self.upload(contents=b"second")], notes="텍스트도 유지")
        self.assertEqual(second.status_code, 200, second.data)
        rows = list(self.site.attachments.all())
        self.assertNotEqual(rows[0].file.name, rows[1].file.name)
        self.assertEqual(rows[0].original_name, rows[1].original_name)
        other = Company.objects.create(name="다른 사이트")
        self.save([self.upload("other.txt")], site=other)
        listing = self.client.get(f"/api/site-files/?company={self.site.pk}")
        self.assertEqual(listing.status_code, 200, listing.data)
        self.assertEqual(len(listing.data), 2)
        self.assertTrue(all(item["company"] == self.site.pk for item in listing.data))
        self.client.patch(f"/api/companies/{self.site.pk}/", {"notes": "첨부 없이 수정"}, format="json")
        self.assertEqual(self.site.attachments.count(), 2)

    def test_only_site_managers_can_add_files(self):
        owner = get_user_model().objects.create_user(username="file_owner")
        outsider = get_user_model().objects.create_user(username="file_outsider")
        CompanyAssignment.objects.create(company=self.site, user=owner)
        self.client.force_authenticate(outsider)
        rejected = self.save([self.upload()])
        self.assertEqual(rejected.status_code, 403)
        self.assertFalse(self.site.attachments.exists())
        self.client.force_authenticate(owner)
        accepted = self.save([self.upload()])
        self.assertEqual(accepted.status_code, 200, accepted.data)

    def test_site_deletion_removes_stored_files_after_commit(self):
        self.save([self.upload()])
        row = self.site.attachments.get()
        stored = Path(row.file.path)
        with self.captureOnCommitCallbacks(execute=True):
            self.site.delete()
        self.assertFalse(CompanyAttachment.objects.filter(pk=row.pk).exists())
        self.assertFalse(stored.exists())

    def test_storage_failure_rolls_back_site_changes_and_cleans_files(self):
        original = CompanyAttachment.save
        calls = 0
        def failing_save(instance, *args, **kwargs):
            nonlocal calls
            calls += 1
            if calls == 2:
                raise OSError("simulated storage error")
            return original(instance, *args, **kwargs)
        with patch.object(CompanyAttachment, "save", failing_save):
            with self.assertRaises(OSError):
                self.save([self.upload("one.txt"), self.upload("two.txt")], notes="rollback")
        self.site.refresh_from_db()
        self.assertEqual(self.site.notes, "")
        self.assertFalse(self.site.attachments.exists())
        self.assertEqual([path for path in self.media.rglob("*") if path.is_file()], [])

    def test_invalid_multipart_payload_does_not_create_site(self):
        for payload in ("[]", "invalid"):
            response = self.client.post("/api/companies/", {"data": payload, "files": [self.upload()]}, format="multipart")
            self.assertEqual(response.status_code, 400)
        self.assertEqual(Company.objects.count(), 1)


    def test_delete_file_removes_metadata_and_storage_and_keeps_other_files(self):
        self.save([self.upload("삭제 대상.txt"), self.upload("유지할 파일.txt")])
        removed = self.site.attachments.get(original_name="삭제 대상.txt")
        kept = self.site.attachments.get(original_name="유지할 파일.txt")
        stored = Path(removed.file.path)
        with self.captureOnCommitCallbacks(execute=True):
            response = self.client.delete(f"/api/site-files/{removed.pk}/")
        self.assertEqual(response.status_code, 204)
        self.assertFalse(CompanyAttachment.objects.filter(pk=removed.pk).exists())
        self.assertFalse(stored.exists())
        self.assertTrue(Path(kept.file.path).exists())
        detail = self.client.get(f"/api/companies/{self.site.pk}/")
        self.assertEqual([row["id"] for row in detail.data["attachments"]], [kept.pk])
        self.assertEqual(self.client.get(f"/api/site-files/{removed.pk}/download/").status_code, 404)

    def test_delete_file_requires_login_and_site_management_permission(self):
        self.save([self.upload()])
        row = self.site.attachments.get()
        stored = Path(row.file.path)
        url = f"/api/site-files/{row.pk}/"
        self.client.force_authenticate(None)
        self.assertEqual(self.client.delete(url).status_code, 401)
        outsider = get_user_model().objects.create_user(username="delete_file_outsider")
        self.client.force_authenticate(outsider)
        self.assertEqual(self.client.delete(url).status_code, 403)
        self.assertTrue(CompanyAttachment.objects.filter(pk=row.pk).exists())
        self.assertTrue(stored.exists())
        owner = get_user_model().objects.create_user(username="delete_file_owner")
        CompanyAssignment.objects.create(company=self.site, user=owner)
        self.client.force_authenticate(owner)
        with self.captureOnCommitCallbacks(execute=True):
            response = self.client.delete(url)
        self.assertEqual(response.status_code, 204)
        self.assertFalse(stored.exists())
