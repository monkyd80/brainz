from io import BytesIO
from pathlib import Path
from uuid import uuid4

from django.core.files.base import ContentFile
from django.db import transaction
from PIL import Image, ImageOps
from rest_framework import serializers, viewsets
from rest_framework.decorators import action
from django.http import FileResponse, Http404

from .file_uploads import MAX_SITE_FILE_BYTES


def dashboard_image_path(instance, filename):
    return f"dashboard-images/{instance.company_id}/{uuid4().hex}{Path(filename).suffix[:20]}"


class DashboardUploadField(serializers.ImageField):
    def to_internal_value(self, data):
        if getattr(data, "size", 0) > MAX_SITE_FILE_BYTES:
            raise serializers.ValidationError("대시보드 이미지는 5MB 이하만 등록할 수 있습니다.")
        upload = super().to_internal_value(data)
        if upload.image.format not in {"PNG", "JPEG", "WEBP", "GIF"}:
            raise serializers.ValidationError("PNG, JPG, WEBP, GIF 이미지를 선택하세요.")
        return upload


def save_dashboard_image(company, upload, user=None):
    from .models import CompanyDashboardImage

    current = CompanyDashboardImage.objects.filter(company=company).first()
    row = current or CompanyDashboardImage(company=company)
    previous = [(field.storage, field.name) for field in (row.file, row.thumbnail) if field]
    stored = []
    try:
        with transaction.atomic():
            upload.seek(0)
            with Image.open(upload) as image:
                row.width, row.height = image.size
                row.content_type = Image.MIME[image.format]
                thumbnail = ImageOps.exif_transpose(image).convert("RGBA")
                thumbnail.thumbnail((320, 180))
                output = BytesIO()
                thumbnail.save(output, format="PNG", optimize=True)
            upload.seek(0)
            name = Path(upload.name.replace("\\", "/")).name
            row.file.save(name, upload, save=False)
            stored.append((row.file.storage, row.file.name))
            row.thumbnail.save("thumbnail.png", ContentFile(output.getvalue()), save=False)
            stored.append((row.thumbnail.storage, row.thumbnail.name))
            row.original_name = name
            row.size = upload.size
            row.uploaded_by = user
            row.save()
            company._state.fields_cache.pop("dashboard_image", None)
            for storage, old_name in previous:
                transaction.on_commit(lambda storage=storage, name=old_name: storage.delete(name))
    except Exception:
        for storage, name in stored:
            storage.delete(name)
        raise
    return stored


class DashboardImageViewSet(viewsets.ReadOnlyModelViewSet):
    # Import models lazily here to keep upload_to importable while models load.
    def get_queryset(self):
        from .models import CompanyDashboardImage
        return CompanyDashboardImage.objects.all()

    def get_serializer_class(self):
        from .serializers import DashboardImageSerializer
        return DashboardImageSerializer

    def _image_response(self, thumbnail=False):
        row = self.get_object()
        field = row.thumbnail if thumbnail else row.file
        try:
            content = field.open("rb")
        except (FileNotFoundError, ValueError):
            raise Http404("대시보드 이미지를 찾을 수 없습니다.")
        response = FileResponse(content, content_type="image/png" if thumbnail else row.content_type)
        response["X-Content-Type-Options"] = "nosniff"
        response["Cache-Control"] = "private, no-cache"
        return response

    @action(detail=True, methods=["get"])
    def content(self, request, pk=None):
        return self._image_response()

    @action(detail=True, methods=["get"])
    def thumbnail(self, request, pk=None):
        return self._image_response(thumbnail=True)
