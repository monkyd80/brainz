from pathlib import Path
from uuid import uuid4

from django.db import transaction
from rest_framework import serializers

MAX_SITE_FILE_BYTES = 5 * 1024 * 1024


def company_attachment_path(instance, filename):
    suffix = Path(filename).suffix[:20]
    return f"site-files/{instance.company_id}/{uuid4().hex}{suffix}"


class SiteUploadFileField(serializers.FileField):
    def to_internal_value(self, data):
        upload = super().to_internal_value(data)
        if upload.size > MAX_SITE_FILE_BYTES:
            raise serializers.ValidationError("파일당 5MB 이하만 업로드할 수 있습니다.")
        return upload


def save_site_attachments(company, uploads, user=None):
    from .models import CompanyAttachment

    stored = []
    try:
        with transaction.atomic():
            for upload in uploads:
                name = Path(upload.name.replace("\\", "/")).name
                attachment = CompanyAttachment(company=company, original_name=name, size=upload.size, uploaded_by=user)
                attachment.file.save(name, upload, save=False)
                stored.append((attachment.file.storage, attachment.file.name))
                attachment.save()
    except Exception:
        for storage, name in stored:
            storage.delete(name)
        raise

    return stored
