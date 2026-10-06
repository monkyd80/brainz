from django.contrib.auth import get_user_model
from .models import CompanyAssignment


def brainz_account():
    user, _ = get_user_model().objects.get_or_create(
        username="brainz",
        defaults={"first_name": "brainz", "password": "!", "is_staff": False, "is_active": True},
    )
    return user


def assign_registered_site(company, creator):
    """관리자 등록은 brainz에, 일반 사용자 등록은 등록 사용자에게 할당한다."""
    assignee = brainz_account() if creator.is_staff else creator
    CompanyAssignment.objects.get_or_create(company=company, user=assignee)
