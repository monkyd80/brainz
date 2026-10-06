from django.contrib.auth import authenticate, get_user_model
from django.db import transaction
from rest_framework import status
from rest_framework.authtoken.models import Token
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAdminUser, IsAuthenticated
from rest_framework.response import Response
from .models import Company, CompanyAssignment, UserProfile
from .site_assignments import brainz_account

User = get_user_model()


def user_payload(user, token):
    return {"token": token.key, "user": {"id": user.id, "username": user.username, "email": user.email, "is_admin": user.is_staff}}


@api_view(["POST"])
@permission_classes([AllowAny])
def signup(request):
    username = request.data.get("username", "").strip()
    email = request.data.get("email", "").strip()
    password = request.data.get("password", "")
    if not username or not email or len(password) < 8:
        return Response({"detail": "아이디, 이메일, 8자 이상 비밀번호를 입력하세요."}, status=status.HTTP_400_BAD_REQUEST)
    if User.objects.filter(username=username).exists():
        return Response({"detail": "이미 사용 중인 아이디입니다."}, status=status.HTTP_400_BAD_REQUEST)
    if User.objects.filter(email=email).exists():
        return Response({"detail": "이미 사용 중인 이메일입니다."}, status=status.HTTP_400_BAD_REQUEST)
    user = User.objects.create_user(username=username, email=email, password=password)
    token, _ = Token.objects.get_or_create(user=user)
    return Response(user_payload(user, token), status=status.HTTP_201_CREATED)


@api_view(["POST"])
@permission_classes([AllowAny])
def login(request):
    if str(request.data.get("username", "")).strip() == "brainz":
        return Response({"detail": "brainz는 관리자 사용자 전환으로만 접근할 수 있습니다."}, status=401)
    user = authenticate(username=request.data.get("username", ""), password=request.data.get("password", ""))
    if user is None:
        return Response({"detail": "아이디 또는 비밀번호가 올바르지 않습니다."}, status=status.HTTP_401_UNAUTHORIZED)
    token, _ = Token.objects.get_or_create(user=user)
    return Response(user_payload(user, token))


@api_view(["POST"])
@permission_classes([IsAdminUser])
def admin_change_password(request, user_id):
    password = request.data.get("password", "")
    if len(password) < 8:
        return Response({"detail": "비밀번호는 8자 이상이어야 합니다."}, status=status.HTTP_400_BAD_REQUEST)
    try:
        user = User.objects.get(pk=user_id)
    except User.DoesNotExist:
        return Response({"detail": "사용자를 찾을 수 없습니다."}, status=status.HTTP_404_NOT_FOUND)
    if user.username == "brainz":
        return Response({"detail": "brainz 보관 계정은 비밀번호를 설정할 수 없습니다."}, status=400)
    user.set_password(password)
    user.save(update_fields=["password"])
    Token.objects.filter(user=user).delete()
    return Response({"detail": "비밀번호가 변경됐습니다. 기존 로그인은 해제됐습니다."})


@api_view(["POST"])
def change_own_password(request):
    if request.user.username == "brainz":
        return Response({"detail": "brainz 보관 계정은 비밀번호를 설정할 수 없습니다."}, status=400)
    current_password = request.data.get("current_password", "")
    password = request.data.get("password", "")
    if not request.user.check_password(current_password):
        return Response({"detail": "현재 비밀번호가 올바르지 않습니다."}, status=status.HTTP_400_BAD_REQUEST)
    if len(password) < 8:
        return Response({"detail": "새 비밀번호는 8자 이상이어야 합니다."}, status=status.HTTP_400_BAD_REQUEST)
    request.user.set_password(password)
    request.user.save(update_fields=["password"])
    Token.objects.filter(user=request.user).delete()
    return Response({"detail": "비밀번호가 변경됐습니다. 다시 로그인해 주세요."})


@api_view(["GET", "PATCH"])
@permission_classes([IsAuthenticated])
def own_profile(request):
    if request.method == "GET":
        return Response({"username": request.user.username, "name": request.user.get_full_name() or request.user.first_name, "email": request.user.email})
    name = str(request.data.get("name", request.user.first_name)).strip()
    email = str(request.data.get("email", request.user.email)).strip()
    if email and User.objects.exclude(pk=request.user.pk).filter(email=email).exists():
        return Response({"detail": "이미 사용 중인 이메일입니다."}, status=status.HTTP_400_BAD_REQUEST)
    request.user.first_name = name
    request.user.email = email
    request.user.save(update_fields=["first_name", "email"])
    return Response({"username": request.user.username, "name": name, "email": email, "detail": "내 정보가 저장되었습니다."})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def site_user_groups(request):
    """좌측 트리용 사용자별 담당 사이트 ID 목록."""
    users = User.objects.filter(is_active=True, is_staff=False).prefetch_related("company_assignments").order_by("username")
    return Response([{
        "id": user.id,
        "username": user.username,
        "name": user.get_full_name() or user.first_name,
        "company_ids": list(user.company_assignments.values_list("company_id", flat=True)),
    } for user in users])


@api_view(["POST"])
@permission_classes([IsAdminUser])
def switch_user(request):
    """관리자가 비밀번호 입력 없이 테스트·지원용 사용자 화면을 확인한다."""
    try:
        user = User.objects.get(pk=request.data.get("user_id"), is_active=True)
    except (User.DoesNotExist, TypeError, ValueError):
        return Response({"detail": "전환할 사용자를 찾을 수 없습니다."}, status=status.HTTP_404_NOT_FOUND)
    token, _ = Token.objects.get_or_create(user=user)
    return Response(user_payload(user, token))


def admin_user_payload(user):
    return {
        "id": user.id, "username": user.username, "email": user.email,
        "name": user.get_full_name() or user.first_name,
        "is_admin": user.is_staff, "is_active": user.is_active,
        "employee_number": UserProfile.objects.filter(user=user).values_list("employee_number", flat=True).first() or "",
        "company_ids": list(user.company_assignments.values_list("company_id", flat=True)),
    }


@api_view(["GET", "POST"])
@permission_classes([IsAdminUser])
def admin_users(request):
    if request.method == "GET":
        return Response([admin_user_payload(user) for user in User.objects.order_by("username")])
    username = request.data.get("username", "").strip()
    password = request.data.get("password", "")
    email = request.data.get("email", "").strip()
    name = request.data.get("name", "").strip()
    if not username or len(password) < 8:
        return Response({"detail": "아이디와 8자 이상 비밀번호를 입력하세요."}, status=status.HTTP_400_BAD_REQUEST)
    if User.objects.filter(username=username).exists():
        return Response({"detail": "이미 사용 중인 아이디입니다."}, status=status.HTTP_400_BAD_REQUEST)
    user = User.objects.create_user(username=username, email=email, first_name=name, password=password)
    return Response(admin_user_payload(user), status=status.HTTP_201_CREATED)


@api_view(["PATCH", "DELETE"])
@permission_classes([IsAdminUser])
@transaction.atomic
def admin_user_detail(request, user_id):
    # Serialize administrator changes so concurrent requests cannot remove the last admin.
    list(User.objects.select_for_update().filter(is_staff=True).order_by("pk"))
    try:
        user = User.objects.get(pk=user_id)
    except User.DoesNotExist:
        return Response({"detail": "사용자를 찾을 수 없습니다."}, status=status.HTTP_404_NOT_FOUND)
    if "is_admin" in request.data and not isinstance(request.data["is_admin"], bool):
        return Response({"detail": "관리자 권한은 체크박스로 지정하세요."}, status=400)
    if user.username == "brainz" and (request.data.get("is_admin") is True or request.data.get("is_active") is False):
        return Response({"detail": "brainz는 활성 일반 보관 계정으로 유지해야 합니다."}, status=400)
    removing_admin = request.method == "DELETE" or request.data.get("is_admin") is False or request.data.get("is_active") is False
    if user.is_staff and user.is_active and removing_admin and not User.objects.filter(is_staff=True, is_active=True).exclude(pk=user.pk).exists():
        return Response({"detail": "마지막 관리자 계정은 삭제하거나 권한을 해제할 수 없습니다."}, status=400)
    if user == request.user and (request.method == "DELETE" or removing_admin):
        return Response({"detail": "현재 로그인한 관리자 계정은 이 화면에서 삭제할 수 없습니다."}, status=status.HTTP_400_BAD_REQUEST)
    if request.method == "DELETE":
        if user.username in ("brainz", "brainz_admin"):
            return Response({"detail": "brainz / brainz_admin 계정은 삭제할 수 없습니다."}, status=400)
        archive_user = brainz_account()
        site_ids = set(CompanyAssignment.objects.filter(user=user).values_list("company_id", flat=True))
        site_ids.update(Company.objects.filter(created_by=user).values_list("id", flat=True))
        for company_id in sorted(site_ids):
            if not CompanyAssignment.objects.filter(company_id=company_id, user__is_active=True, user__is_staff=False).exclude(user_id__in=[user.pk, archive_user.pk]).exists():
                CompanyAssignment.objects.get_or_create(company_id=company_id, user=archive_user)
            else:
                CompanyAssignment.objects.filter(company_id=company_id, user=archive_user).delete()
        Company.objects.filter(created_by=user).update(created_by=archive_user)
        user.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
    changed_fields = []
    if "is_admin" in request.data:
        user.is_staff = request.data["is_admin"]
        changed_fields.append("is_staff")
        if not user.is_staff and user.is_superuser:
            user.is_superuser = False
            changed_fields.append("is_superuser")
    if "employee_number" in request.data:
        number = str(request.data["employee_number"]).strip()
        if len(number) > 50:
            return Response({"detail": "사번은 50자 이내로 입력하세요."}, status=400)
        UserProfile.objects.update_or_create(user=user, defaults={"employee_number": number})
    if "name" in request.data:
        user.first_name = str(request.data["name"]).strip()
        changed_fields.append("first_name")
    if "email" in request.data:
        email = str(request.data["email"]).strip()
        if email and User.objects.exclude(pk=user.pk).filter(email=email).exists():
            return Response({"detail": "이미 사용 중인 이메일입니다."}, status=status.HTTP_400_BAD_REQUEST)
        user.email = email
        changed_fields.append("email")
    if "is_active" in request.data:
        user.is_active = bool(request.data["is_active"])
        changed_fields.append("is_active")
    if changed_fields:
        user.save(update_fields=changed_fields)
    return Response(admin_user_payload(user))


@api_view(["GET", "PUT"])
@permission_classes([IsAdminUser])
@transaction.atomic
def admin_assignments(request):
    user_id = request.query_params.get("user_id") or request.data.get("user_id")
    try:
        user = User.objects.get(pk=user_id)
    except (User.DoesNotExist, TypeError, ValueError):
        return Response({"detail": "사용자를 선택하세요."}, status=status.HTTP_400_BAD_REQUEST)
    if request.method == "GET":
        return Response({"user_id": user.id, "company_ids": list(user.company_assignments.values_list("company_id", flat=True))})
    company_ids = request.data.get("company_ids", [])
    if user.is_staff or not user.is_active:
        return Response({"detail": "관리자는 전체 사이트를 관리합니다. 활성 담당 사용자 또는 brainz를 선택하세요."}, status=400)
    if not isinstance(company_ids, list) or any(type(item) is not int for item in company_ids):
        return Response({"detail": "사이트 목록 형식이 올바르지 않습니다."}, status=400)
    list(Company.objects.select_for_update().order_by("pk"))
    valid_ids = set(Company.objects.filter(id__in=company_ids).values_list("id", flat=True))
    if len(valid_ids) != len(set(company_ids)):
        return Response({"detail": "존재하지 않는 사이트가 포함되어 있습니다."}, status=400)
    previous_ids = set(CompanyAssignment.objects.filter(user=user).values_list("company_id", flat=True))
    CompanyAssignment.objects.filter(user=user).exclude(company_id__in=valid_ids).delete()
    for company_id in valid_ids:
        CompanyAssignment.objects.filter(company_id=company_id).exclude(user=user).delete()
        CompanyAssignment.objects.get_or_create(user=user, company_id=company_id)
    archive = brainz_account()
    for company_id in previous_ids - valid_ids:
        if not CompanyAssignment.objects.filter(company_id=company_id, user__is_active=True, user__is_staff=False).exclude(user=archive).exists():
            CompanyAssignment.objects.filter(company_id=company_id).delete()
            CompanyAssignment.objects.get_or_create(company_id=company_id, user=archive)
    return Response({"user_id": user.id, "company_ids": sorted(valid_ids)})
