from django.http import FileResponse, Http404
from rest_framework import mixins, viewsets
from rest_framework.exceptions import PermissionDenied
from rest_framework.decorators import action

from .models import CompanyAssignment, CompanyAttachment
from .serializers import CompanyAttachmentSerializer


class CompanyAttachmentViewSet(mixins.DestroyModelMixin, viewsets.ReadOnlyModelViewSet):
    queryset = CompanyAttachment.objects.all()
    serializer_class = CompanyAttachmentSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        company_id = self.request.query_params.get("company")
        return queryset.filter(company_id=company_id) if company_id else queryset

    def perform_destroy(self, instance):
        if not self.request.user.is_staff and not CompanyAssignment.objects.filter(company_id=instance.company_id, user=self.request.user).exists():
            raise PermissionDenied("담당 사이트의 파일만 삭제할 수 있습니다.")
        instance.delete()

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
