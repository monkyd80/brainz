from contextlib import contextmanager
from contextvars import ContextVar
from uuid import UUID

from .models import CompanyChangeHistory


edit_batch = ContextVar("edit_batch", default=None)
METADATA_FIELDS = {"created_at", "updated_at", "uploaded_at", "created_by", "uploaded_by"}

COMPANY_SECTIONS = {
    "contract_type": "계약·제품",
    "supplied_server": "계약·제품",
    "supplied_os": "계약·제품",
    "supplied_db": "계약·제품",
    "address": "위치",
    "remote_support": "위치",
    "notes": "참고 사항",
    "special_notes": "사이트 특이사항 및 전달사항",
}
RECORD_SECTIONS = {
    "com_product": "계약·제품",
    "com_contact": "담당자",
    "com_lic": "구축 솔루션",
    "com_dev": "연동 개발",
    "com_system": "시스템 구성",
    "com_install": "설치 위치 정보",
    "com_spec": "H/W 구성 정보",
    "com_hw_capacity": "H/W 용량",
    "com_attachment": "추가정보파일",
    "com_dashboard_image": "대시보드 이미지",
    "com_assignment": "사이트 이관",
    "excel_upload": "엑셀 가져오기",
}


def comparable(value):
    return (value.strip() or None) if isinstance(value, str) else value


@contextmanager
def history_edit(value):
    try:
        batch = UUID(value) if value else None
    except ValueError:
        batch = None
    token = edit_batch.set(batch)
    try:
        yield
    finally:
        edit_batch.reset(token)


def history_summaries(queryset):
    entries = queryset.values(
        "id", "company_id", "company__name", "table_name", "action", "changed_fields", "edit_batch", "changed_at",
        "before_data", "after_data",
    )
    seen = set()
    for entry in entries.iterator():
        table = entry["table_name"]
        action = entry["action"]
        batch = entry["edit_batch"]
        changed = [field for field in entry["changed_fields"] if field not in METADATA_FIELDS]
        if batch is None and action == CompanyChangeHistory.Action.UPDATE and table != "excel_upload":
            before, after = entry["before_data"], entry["after_data"]
            changed = [
                field for field in changed
                if (field not in before and field not in after)
                or comparable(before.get(field)) != comparable(after.get(field))
            ]
        if table == "com_company":
            categories = (
                dict.fromkeys(COMPANY_SECTIONS.get(field, "사이트 정보") for field in changed)
                if action == CompanyChangeHistory.Action.UPDATE else ("사이트",)
            )
        elif table in RECORD_SECTIONS:
            # Unbatched child registrations are already represented by the site or Excel registration.
            if action == CompanyChangeHistory.Action.CREATE and batch is None and table != "excel_upload":
                continue
            if action == CompanyChangeHistory.Action.UPDATE and not changed:
                continue
            categories = (RECORD_SECTIONS[table],)
        else:
            continue

        for category in categories:
            key = (entry["company_id"], batch or entry["id"], category)
            if key in seen:
                continue
            seen.add(key)
            yield {
                "id": entry["id"],
                "company_name": entry["company__name"],
                "category": category,
                "action": CompanyChangeHistory.Action.UPDATE if batch else action,
                "changed_at": entry["changed_at"],
            }
