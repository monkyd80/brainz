from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.tokens import default_token_generator
from django.core.mail import send_mail
from django.db import transaction
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode
from rest_framework.authtoken.models import Token
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle
from .models import UserProfile


class RecoveryThrottle(AnonRateThrottle):
    rate = "5/hour"


@api_view(["POST"])
@permission_classes([AllowAny])
@throttle_classes([RecoveryThrottle])
def request_reset(request):
    if not settings.PASSWORD_RECOVERY_EMAIL_ENABLED:
        return Response({"detail": "메일 발송 설정이 준비되지 않았습니다. 관리자에게 비밀번호 변경을 요청하세요."}, status=503)
    data = request.data
    user = get_user_model().objects.filter(username=str(data.get("username", "")).strip(), is_active=True).exclude(email="").exclude(username="brainz").first()
    if user and user.get_full_name() == str(data.get("name", "")).strip():
        number = UserProfile.objects.filter(user=user).values_list("employee_number", flat=True).first() or ""
        if not number or number == str(data.get("employee_number", "")).strip():
            uid = urlsafe_base64_encode(force_bytes(user.pk))
            token = default_token_generator.make_token(user)
            link = f"{settings.FRONTEND_URL}/password-reset?uid={uid}&token={token}"
            try:
                send_mail("COM_MANAGE 비밀번호 재설정", f"아래 링크에서 새 비밀번호를 설정하세요. 링크는 30분 동안 유효합니다.\n{link}", settings.DEFAULT_FROM_EMAIL, [user.email])
            except Exception:
                return Response({"detail": "메일 발송에 실패했습니다. 관리자에게 문의하세요."}, status=503)
    return Response({"detail": "입력 정보가 일치하면 등록된 이메일로 재설정 링크를 보냈습니다. 메일을 확인하세요."})


@api_view(["POST"])
@permission_classes([AllowAny])
@throttle_classes([RecoveryThrottle])
def confirm_reset(request):
    data = request.data
    password = str(data.get("password", ""))
    if len(password) < 8 or password != data.get("password_confirm"):
        return Response({"detail": "새 비밀번호는 8자 이상으로 입력하고 확인 값도 동일하게 입력하세요."}, status=400)
    with transaction.atomic():
        try:
            user = get_user_model().objects.select_for_update().get(pk=urlsafe_base64_decode(str(data.get("uid", ""))).decode(), is_active=True)
        except (ValueError, TypeError, UnicodeDecodeError, get_user_model().DoesNotExist):
            user = None
        if not user or user.username == "brainz" or not default_token_generator.check_token(user, str(data.get("token", ""))):
            return Response({"detail": "유효하지 않거나 만료된 링크입니다. 비밀번호 찾기를 다시 진행하세요."}, status=400)
        user.set_password(password)
        user.save(update_fields=["password"])
        Token.objects.filter(user=user).delete()
    return Response({"detail": "비밀번호를 변경했습니다. 새 비밀번호로 로그인하세요."})
