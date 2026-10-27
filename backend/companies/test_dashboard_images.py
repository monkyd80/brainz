import json
import tempfile
from io import BytesIO
from pathlib import Path
from unittest.mock import patch

from PIL import Image
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from rest_framework.test import APIClient

from .models import Company, CompanyAssignment, CompanyDashboardImage


class DashboardImageTests(TestCase):
    def setUp(self):
        directory = tempfile.TemporaryDirectory()
        self.addCleanup(directory.cleanup)
        override = self.settings(MEDIA_ROOT=directory.name)
        override.enable()
        self.addCleanup(override.disable)
        self.media = Path(directory.name)
        self.admin = get_user_model().objects.create_user(username="image_admin", is_staff=True)
        self.client = APIClient()
        self.client.force_authenticate(self.admin)
        self.site = Company.objects.create(name="대시보드 테스트")

    def image(self, name="dashboard.png", size=(1600, 900), format="PNG"):
        output = BytesIO()
        Image.new("RGB", size, "#2273cc").save(output, format=format)
        return SimpleUploadedFile(name, output.getvalue(), content_type=Image.MIME[format])

    def save(self, image=None, **values):
        data = {"data": json.dumps(values)}
        if image is not None:
            data["dashboard_image"] = image
        return self.client.patch(f"/api/companies/{self.site.pk}/", data, format="multipart")

    def test_create_with_image_and_attachment_and_protected_image_endpoints(self):
        response = self.client.post("/api/companies/", {
            "data": json.dumps({"name": "이미지 포함 등록"}), "dashboard_image": self.image(),
            "files": [SimpleUploadedFile("guide.txt", b"general attachment")],
        }, format="multipart")
        self.assertEqual(response.status_code, 201, response.data)
        metadata = response.data["dashboard_image"]
        self.assertEqual((metadata["width"], metadata["height"]), (1600, 900))
        self.assertEqual(len(response.data["attachments"]), 1)
        self.assertNotIn("file", metadata)
        row = CompanyDashboardImage.objects.get(pk=metadata["id"])
        for part in ("content", "thumbnail"):
            result = self.client.get(f"/api/dashboard-images/{row.pk}/{part}/")
            self.assertEqual(result.status_code, 200)
            self.assertEqual(result["Content-Type"], "image/png")
            self.assertEqual(result["X-Content-Type-Options"], "nosniff")
            content = b"".join(result.streaming_content)
            result.close()
            with Image.open(BytesIO(content)) as image:
                self.assertEqual(image.size, (320, 180) if part == "thumbnail" else (1600, 900))
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get(f"/api/dashboard-images/{row.pk}/content/").status_code, 401)
        self.assertEqual(self.client.get(f"/api/dashboard-images/{row.pk}/thumbnail/").status_code, 401)

    def test_replace_keeps_one_image_and_removes_previous_files_after_commit(self):
        first = self.save(self.image())
        self.assertEqual(first.status_code, 200, first.data)
        old = self.site.dashboard_image
        old_paths = [Path(old.file.path), Path(old.thumbnail.path)]
        with self.captureOnCommitCallbacks(execute=True):
            result = self.save(self.image("new.jpg", size=(640, 480), format="JPEG"))
        self.assertEqual(result.status_code, 200, result.data)
        self.assertEqual(CompanyDashboardImage.objects.filter(company=self.site).count(), 1)
        self.assertEqual(result.data["dashboard_image"]["id"], old.pk)
        self.assertEqual(result.data["dashboard_image"]["original_name"], "new.jpg")
        self.assertEqual(result.data["dashboard_image"]["width"], 640)
        self.assertTrue(all(not path.exists() for path in old_paths))
        unchanged = self.save(notes="텍스트만 수정")
        self.assertEqual(unchanged.data["dashboard_image"]["original_name"], "new.jpg")
        other = Company.objects.create(name="이미지 없는 사이트")
        listing = self.client.get("/api/companies/")
        self.assertIsNone(next(row for row in listing.data if row["id"] == other.pk)["dashboard_image"])

    def test_invalid_and_oversized_images_do_not_change_site_or_store_files(self):
        invalid = [
            SimpleUploadedFile("fake.png", b"not an image", content_type="image/png"),
            SimpleUploadedFile("big.png", b"x" * (5 * 1024 * 1024 + 1), content_type="image/png"),
            self.image("unsupported.bmp", format="BMP"),
        ]
        for image in invalid:
            with self.subTest(name=image.name):
                result = self.save(image, notes="저장되면 안 되는 값")
                self.assertEqual(result.status_code, 400, result.data)
        self.site.refresh_from_db()
        self.assertEqual(self.site.notes, "")
        self.assertFalse(CompanyDashboardImage.objects.exists())
        self.assertEqual([path for path in self.media.rglob("*") if path.is_file()], [])

    def test_only_assigned_users_and_admins_can_register_images(self):
        outsider = get_user_model().objects.create_user(username="image_outsider")
        self.client.force_authenticate(outsider)
        self.assertEqual(self.save(self.image()).status_code, 403)
        CompanyAssignment.objects.create(company=self.site, user=outsider)
        result = self.save(self.image())
        self.assertEqual(result.status_code, 200, result.data)

    def test_storage_failure_cleans_new_files_and_preserves_previous_image(self):
        self.save(self.image())
        original = CompanyDashboardImage.objects.get(company=self.site)
        expected = {Path(original.file.path), Path(original.thumbnail.path)}
        with patch.object(CompanyDashboardImage, "save", side_effect=OSError("simulated image save failure")):
            with self.assertRaises(OSError):
                self.client.patch(f"/api/companies/{self.site.pk}/", {
                    "data": json.dumps({"notes": "rollback"}), "dashboard_image": self.image("replacement.png"),
                    "files": [SimpleUploadedFile("new.txt", b"clean up this attachment")],
                }, format="multipart")
        self.site.refresh_from_db()
        self.assertEqual(self.site.notes, "")
        self.assertEqual(self.site.dashboard_image.original_name, "dashboard.png")
        self.assertFalse(self.site.attachments.exists())
        self.assertEqual({path for path in self.media.rglob("*") if path.is_file()}, expected)

    def test_deleting_site_removes_original_and_thumbnail(self):
        self.save(self.image())
        row = CompanyDashboardImage.objects.get(company=self.site)
        paths = [Path(row.file.path), Path(row.thumbnail.path)]
        with self.captureOnCommitCallbacks(execute=True):
            self.site.delete()
        self.assertTrue(all(not path.exists() for path in paths))
        self.assertFalse(CompanyDashboardImage.objects.exists())


    def test_remove_dashboard_image_cleans_both_files_and_preserves_site(self):
        self.save(self.image())
        row = CompanyDashboardImage.objects.get(company=self.site)
        image_id = row.pk
        paths = [Path(row.file.path), Path(row.thumbnail.path)]
        with self.captureOnCommitCallbacks(execute=True):
            result = self.client.patch(f"/api/companies/{self.site.pk}/", {"remove_dashboard_image": True, "notes": "삭제 후 설명"}, format="json")
        self.assertEqual(result.status_code, 200, result.data)
        self.assertIsNone(result.data["dashboard_image"])
        self.assertEqual(result.data["notes"], "삭제 후 설명")
        self.assertFalse(CompanyDashboardImage.objects.filter(company=self.site).exists())
        self.assertTrue(all(not path.exists() for path in paths))
        self.assertEqual(self.client.get(f"/api/dashboard-images/{image_id}/content/").status_code, 404)
        self.assertEqual(self.client.get(f"/api/dashboard-images/{image_id}/thumbnail/").status_code, 404)
        self.assertIsNone(self.client.get(f"/api/companies/{self.site.pk}/").data["dashboard_image"])

    def test_remove_dashboard_image_requires_site_management_permission(self):
        self.save(self.image())
        row = CompanyDashboardImage.objects.get(company=self.site)
        outsider = get_user_model().objects.create_user(username="image_delete_outsider")
        self.client.force_authenticate(outsider)
        rejected = self.client.patch(f"/api/companies/{self.site.pk}/", {"remove_dashboard_image": True}, format="json")
        self.assertEqual(rejected.status_code, 403)
        self.assertTrue(Path(row.file.path).exists())
        self.assertTrue(CompanyDashboardImage.objects.filter(company=self.site).exists())
        CompanyAssignment.objects.create(company=self.site, user=outsider)
        with self.captureOnCommitCallbacks(execute=True):
            accepted = self.client.patch(f"/api/companies/{self.site.pk}/", {"remove_dashboard_image": True}, format="json")
        self.assertEqual(accepted.status_code, 200, accepted.data)
        self.assertIsNone(accepted.data["dashboard_image"])

    def test_failed_save_does_not_remove_existing_image(self):
        self.save(self.image())
        row = CompanyDashboardImage.objects.get(company=self.site)
        paths = [Path(row.file.path), Path(row.thumbnail.path)]
        with patch("companies.serializers.save_site_attachments", side_effect=OSError("simulated save error")):
            with self.assertRaises(OSError):
                self.client.patch(f"/api/companies/{self.site.pk}/", {"remove_dashboard_image": True}, format="json")
        self.assertTrue(CompanyDashboardImage.objects.filter(company=self.site).exists())
        self.assertTrue(all(path.exists() for path in paths))
        conflict = self.save(self.image("replacement.png"), remove_dashboard_image=True)
        self.assertEqual(conflict.status_code, 400)
        self.assertTrue(CompanyDashboardImage.objects.filter(company=self.site).exists())
