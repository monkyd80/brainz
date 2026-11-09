from django.db.models import Exists, OuterRef
from django.shortcuts import get_object_or_404
from rest_framework import mixins, serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response

from .models import Notice, NoticeRead


class NoticeSerializer(serializers.ModelSerializer):
    is_read = serializers.BooleanField(read_only=True, default=False)

    class Meta:
        model = Notice
        fields = ("id", "title", "body", "created_at", "is_read")


class NoticeViewSet(mixins.CreateModelMixin, mixins.DestroyModelMixin, viewsets.GenericViewSet):
    queryset = Notice.objects.all()
    serializer_class = NoticeSerializer
    lookup_value_regex = r"\d+"

    def get_permissions(self):
        if self.action in ("create", "destroy"):
            return [IsAdminUser()]
        return super().get_permissions()

    def get_queryset(self):
        reads = NoticeRead.objects.filter(user=self.request.user, notice_id=OuterRef("pk"))
        return super().get_queryset().annotate(is_read=Exists(reads))

    def list(self, request):
        notices = self.get_queryset()
        if request.query_params.get("unread") == "1":
            notices = notices.filter(is_read=False)[:1]
        else:
            notices = notices[:50]
        return Response(self.get_serializer(notices, many=True).data)

    @action(detail=True, methods=["post"])
    def read(self, request, pk=None):
        notice = get_object_or_404(self.queryset, pk=pk)
        NoticeRead.objects.get_or_create(notice=notice, user=request.user)
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=False, methods=["post"], url_path="read-all")
    def read_all(self, request):
        unread_ids = self.get_queryset().filter(is_read=False).values_list("pk", flat=True)
        NoticeRead.objects.bulk_create(
            (NoticeRead(notice_id=notice_id, user=request.user) for notice_id in unread_ids),
            ignore_conflicts=True,
        )
        return Response(status=status.HTTP_204_NO_CONTENT)
