from io import BytesIO

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from openpyxl import load_workbook
from rest_framework.test import APIClient
import xlrd

from .models import Company
from .template_import import template_bytes


class ContactEmailTests(TestCase):
    def test_site_registration_and_contact_edit_accept_multiple_emails(self):
        user = get_user_model().objects.create_user(username="contact_editor")
        client = APIClient()
        client.force_authenticate(user)

        emails = "first@example.com second@example.com"
        created = client.post("/api/companies/", {
            "name": "연락처 테스트 사이트",
            "registration_records": {"contacts": [{"name": "담당자", "email": emails}]},
        }, format="json")
        self.assertEqual(created.status_code, 201, created.data)
        contact = created.data["contacts"][0]
        self.assertEqual(contact["email"], emails)

        contact_url = f"/api/contacts/{contact['id']}/"
        updated_emails = "first@example.com, second@example.com; third@example.com"
        updated = client.patch(contact_url, {"email": updated_emails}, format="json")
        self.assertEqual(updated.status_code, 200, updated.data)

        invalid = client.patch(contact_url, {"email": "first@example.com invalid"}, format="json")
        self.assertEqual(invalid.status_code, 400)
        self.assertIn("email", invalid.data)
        self.assertEqual(client.get(contact_url).data["email"], updated_emails)


class SiteTemplateImportTests(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(username="template_admin", password="test-password", is_staff=True)
        self.client = APIClient()
        self.client.force_authenticate(self.user)

    def upload(self, values):
        book = load_workbook(BytesIO(template_bytes()))
        sheet = book.active
        for row in sheet.iter_rows(min_row=2):
            if row[0].value in values:
                row[2].value = values[row[0].value]
        output = BytesIO()
        book.save(output)
        return SimpleUploadedFile("site_registration_template.xlsx", output.getvalue(), content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")

    def test_download_preview_and_commit_store_related_details(self):
        download = self.client.get("/api/companies/import-template/")
        self.assertEqual(download.status_code, 200)
        # Django's test client closes the response after the stream is consumed.
        downloaded = b"".join(download.streaming_content)
        self.assertEqual(download["Content-Type"], "application/vnd.ms-excel")
        sheet = xlrd.open_workbook(file_contents=downloaded).sheet_by_index(0)
        self.assertEqual([sheet.cell_value(12, col) for col in (2, 4, 6)], ["SMS", "NMS", "DBMS"])
        values = {"name": "테스트 사이트", "build_date": "2024-03-12", "ems_package": "EMS Plus", "contact_name": "홍길동", "license_sms_used": 0, "license_sms_total": 10, "integration_email": "예", "integration_email_detail": "알림", "system_name": "운영 서버", "install_db": "/data/db", "manager1_cpu": "8 core"}
        preview = self.client.post("/api/companies/import-preview/", {"file": self.upload(values)}, format="multipart")
        self.assertEqual(preview.status_code, 200, preview.data)
        self.assertEqual(preview.data["data"]["name"], "테스트 사이트")
        self.assertEqual(preview.data["unmapped_source_labels"], [])
        created = self.client.post("/api/companies/import-commit/", {"file": self.upload(values)}, format="multipart")
        self.assertEqual(created.status_code, 201, created.data)
        company = Company.objects.get(name="테스트 사이트")
        self.assertEqual(company.build_year, 2024)
        self.assertEqual(company.contract_products.count(), 1)
        self.assertEqual(company.contacts.count(), 1)
        self.assertEqual(company.solutions.get(category="sms").used_quantity, 0)
        self.assertEqual(company.integrations.count(), 1)
        self.assertEqual(company.systems.count(), 1)
        self.assertEqual(company.installation_locations.count(), 1)
        self.assertEqual(company.hardware_specs.count(), 1)

    def test_invalid_boolean_does_not_create_company(self):
        response = self.client.post("/api/companies/import-commit/", {"file": self.upload({"name": "잘못된 사이트", "remote_support": "아마도"})}, format="multipart")
        self.assertEqual(response.status_code, 400, response.data)
        self.assertIn("예 또는 아니요를 입력하세요", response.data["detail"])
        self.assertFalse(Company.objects.filter(name="잘못된 사이트").exists())
