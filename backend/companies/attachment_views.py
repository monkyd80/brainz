from django.db import transaction
from django.http import FileResponse, Http404
from django.shortcuts import get_object_or_404
from rest_framework import mixins, viewsets
from rest_framework.decorators import action

from .models import CompanyAttachment
from .serializers import CompanyAttachmentSerializer
from .site_assignments import lock_editable_site


class CompanyAttachmentViewSet(mixins.DestroyModelMixin, viewsets.ReadOnlyModelViewSet):
    queryset = CompanyAttachment.objects.all()
    serializer_class = CompanyAttachmentSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        company_id = self.request.query_params.get("company")
        return queryset.filter(company_id=company_id) if company_id else queryset

    @transaction.atomic
    def perform_destroy(self, instance):
        lock_editable_site(self.request.user, instance.company_id)
        get_object_or_404(CompanyAttachment, pk=instance.pk).delete()

    @action(detail=True, methods=["get"])
    def download(self, request, pk=None):
        attachment = self.get_object()
        try:
            content = attachment.file.open("rb")
        except FileNotFoundError:
            raise Http404("파일을 찾을 수 없습니다.")
        response = FileResponse(content, as_attachment=True, filename=attachment.original_name, content_type="application/octet-stream")
        response["X-Content-Type-Options"] = "nosniff"
        return response
