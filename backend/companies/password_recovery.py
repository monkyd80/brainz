from django.contrib.auth import get_user_model
from django.db import transaction
from rest_framework.authtoken.models import Token
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import UserRateThrottle


class RecoveryThrottle(UserRateThrottle):
    scope = "password_reset"
    rate = "5/hour"


@api_view(["POST"])
@permission_classes([AllowAny])
@throttle_classes([RecoveryThrottle])
@transaction.atomic
def request_reset(request):
    fields = [request.data.get(key) for key in ("username", "name", "employee_number")]
    if any(not isinstance(value, str) or not value.strip() for value in fields):
        return Response({"detail": "이름, 사번, ID를 모두 입력하세요."}, status=400)
    username, name, employee_number = (value.strip() for value in fields)
    user = (
        get_user_model().objects.select_for_update()
        .filter(username=username, is_active=True, is_staff=False, is_superuser=False)
        .exclude(username="brainz")
        .first()
    )
    profile = getattr(user, "employee_profile", None)
    if not profile or user.get_full_name() != name or profile.employee_number != employee_number:
        return Response({"detail": "계정 정보를 확인해 주세요."}, status=400)
    user.set_password("brainz337")
    user.save(update_fields=["password"])
    Token.objects.filter(user=user).delete()
    return Response({"detail": "초기화 되었습니다."})
