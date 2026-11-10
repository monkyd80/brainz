from django.contrib.auth import get_user_model
from django.shortcuts import get_object_or_404
from rest_framework.exceptions import PermissionDenied
from .history import edit_batch
from .models import Company, CompanyAssignment, CompanyChangeHistory, Notice


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


def transfer_site(company, recipient, previous_name):
    assignments = list(company.assignments.select_related("user").order_by("user__username"))
    if len(assignments) == 1 and assignments[0].user_id == recipient.pk:
        return
    previous_users = ", ".join(assignment.user.get_full_name() or assignment.user.username for assignment in assignments)
    recipient_name = recipient.get_full_name() or recipient.username
    company.assignments.exclude(user=recipient).delete()
    CompanyAssignment.objects.get_or_create(company=company, user=recipient)
    CompanyChangeHistory.objects.create(
        company=company, company_name=company.name, table_name=CompanyAssignment._meta.db_table,
        record_id=company.pk, action=CompanyChangeHistory.Action.UPDATE, edit_batch=edit_batch.get(),
        before_data={"assignees": [assignment.user_id for assignment in assignments]},
        after_data={"assignees": [recipient.pk]}, changed_fields=["assignees"],
    )
    Notice.objects.create(
        title="사이트 이관",
        body=f"{previous_users or '미할당'}:{previous_name} -> {recipient_name}:{company.name}\n이관이 완료되었습니다.",
    )


def can_edit_site(user, company, *, assigned=None):
    if not user or not user.is_authenticated or not user.is_active:
        return False
    if user.is_staff:
        return True
    if user.username != "brainz":
        name = user.get_full_name()
        if name and any(name in staff for staff in company.support_staff.split("/")):
            return True
    if assigned is None:
        assigned = company.assignments.filter(user=user).exists()
    return assigned


def require_site_editor(user, company):
    if not can_edit_site(user, company):
        raise PermissionDenied("관리자, 할당받은 사용자 또는 지원인력 정·부만 수정할 수 있습니다.")


def lock_editable_site(user, company_id):
    company = get_object_or_404(Company.objects.select_for_update(), pk=company_id)
    require_site_editor(user, company)
    return company
