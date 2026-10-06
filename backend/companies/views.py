import re

from rest_framework import filters, viewsets
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import IsAdminUser
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from django.conf import settings
from django.db import transaction
from django.http import FileResponse, HttpResponse
from .models import Company, CompanyChangeHistory, Contact, ContractProduct, HardwareCapacity, HardwareSpec, InstallationLocation, Integration, LookupOption, Solution, System
from .serializers import CompanyChangeHistorySerializer, CompanySerializer, ContactSerializer, ContractProductSerializer, HardwareCapacitySerializer, HardwareSpecSerializer, InstallationLocationSerializer, IntegrationSerializer, LookupOptionSerializer, SolutionSerializer, SystemSerializer
from .importers import preview_upload
from .template_import import preview_template
from .models import CompanyAssignment
from .site_assignments import assign_registered_site


class SearchableModelViewSet(viewsets.ModelViewSet):
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    ordering_fields = "__all__"


class CompanyViewSet(SearchableModelViewSet):
    queryset = Company.objects.prefetch_related("contacts", "contract_products", "solutions", "integrations", "systems", "installation_locations", "hardware_specs", "hardware_capacities", "change_history")
    serializer_class = CompanySerializer
    search_fields = ["name", "business_code", "maintenance_code", "contract_type", "sales_manager", "support_staff", "address", "contacts__name", "solutions__product_name", "systems__ip_address"]

    @transaction.atomic
    def perform_create(self, serializer):
        company = serializer.save(created_by=self.request.user)
        assign_registered_site(company, self.request.user)

    def _require_company_manager(self, company):
        if not self.request.user.is_staff and not CompanyAssignment.objects.filter(company=company, user=self.request.user).exists():
            raise PermissionDenied("담당 사이트만 수정하거나 삭제할 수 있습니다.")

    def perform_update(self, serializer):
        self._require_company_manager(serializer.instance)
        serializer.save()

    def perform_destroy(self, instance):
        self._require_company_manager(instance)
        instance.delete()

    @action(detail=True, methods=["put"], url_path="system-rows")
    @transaction.atomic
    def system_rows(self, request, pk=None):
        company = self.get_object()
        self._require_company_manager(company)
        Company.objects.select_for_update().get(pk=company.pk)
        rows = request.data.get("systems")
        if not isinstance(rows, list):
            return Response({"detail": "시스템 정보는 목록으로 입력하세요."}, status=400)
        existing = {row.pk: row for row in company.systems.all()}
        validated, seen = [], set()
        for row in rows:
            if not isinstance(row, dict):
                return Response({"detail": "시스템 정보 형식이 올바르지 않습니다."}, status=400)
            row_id = row.get("id")
            if row_id is not None and (row_id not in existing or row_id in seen):
                return Response({"detail": "시스템 정보 ID가 올바르지 않습니다."}, status=400)
            seen.add(row_id)
            serializer = SystemSerializer(existing.get(row_id), data={**row, "company": company.pk})
            serializer.is_valid(raise_exception=True)
            validated.append(serializer)
        saved = [serializer.save() for serializer in validated]
        company.systems.exclude(pk__in=[row.pk for row in saved]).delete()
        return Response(SystemSerializer(saved, many=True).data)

    @action(detail=False, methods=["get"], url_path="import-template", permission_classes=[IsAdminUser])
    def import_template(self, request):
        template_path = settings.TEMPLATE_FILE
        if not template_path.exists():
            return Response({"detail": "기존 엑셀 양식 파일을 찾을 수 없습니다."}, status=404)
        return FileResponse(
            template_path.open("rb"),
            as_attachment=True,
            filename="sample_kdy.xls",
            content_type="application/vnd.ms-excel",
        )

    @action(detail=False, methods=["post"], url_path="import-preview", parser_classes=[MultiPartParser, FormParser])
    def import_preview(self, request):
        upload = request.FILES.get("file")
        if not upload: return Response({"detail": "엑셀 파일을 선택하세요."}, status=400)
        try:
            preview = preview_template(upload) if upload.name.lower().endswith(".xlsx") else preview_upload(upload)
            existing = Company.objects.filter(name=preview["data"].get("name", "")).first()
            if existing:
                preview["duplicate"] = self._import_duplicate(existing, preview["data"])
            return Response(preview)
        except Exception as error: return Response({"detail": f"엑셀 분석 중 오류: {error}"}, status=400)

    def _import_duplicate(self, company, values):
        from .excel_dates import parse_excel_date
        incoming = parse_excel_date(values.get("current_file_date"), "현행화 일자 (O5)")
        stored = company.current_file_date.isoformat() if company.current_file_date else None
        permitted = self.request.user.is_staff or company.assignments.filter(user=self.request.user).exists()
        newer = bool(incoming and (stored is None or incoming > stored))
        return {"id": company.pk, "name": company.name, "existing_date": stored, "incoming_date": incoming,
                "existing_updated_at": company.updated_at.isoformat(), "newer": newer, "can_update": newer and permitted,
                "reason": "" if newer and permitted else "담당 사이트만 업데이트할 수 있습니다." if not permitted else "업로드 날짜가 없거나 기존 날짜보다 최신이 아닙니다."}

    @action(detail=False, methods=["post"], url_path="import-commit", parser_classes=[MultiPartParser, FormParser])
    def import_commit(self, request):
        upload = request.FILES.get("file")
        if not upload: return Response({"detail": "엑셀 파일을 선택하세요."}, status=400)
        try: preview = preview_template(upload) if upload.name.lower().endswith(".xlsx") else preview_upload(upload)
        except Exception as error: return Response({"detail": f"엑셀 분석 중 오류: {error}"}, status=400)
        if not preview["data"].get("name"): return Response({"detail": "사이트명을 찾지 못했습니다. 파일의 사이트명 항목을 확인하세요.", "preview": preview}, status=400)
        updating = False
        try:
            with transaction.atomic():
                values = preview["data"]
                company_fields = {field.name for field in Company._meta.fields}
                company_data = {key: value for key, value in values.items() if key in company_fields and key not in ("id", "created_by", "created_at", "updated_at") and value is not None}
                if company_data.get("build_date"):
                    company_data["build_year"] = int(company_data["build_date"][:4])
                company = Company.objects.select_for_update().filter(name=values["name"]).first()
                before = {"filename": upload.name}
                if company:
                    duplicate = self._import_duplicate(company, values)
                    if not duplicate["can_update"]:
                        return Response({"detail": duplicate["reason"], "duplicate": duplicate}, status=409)
                    if request.data.get("confirm_update") != "true":
                        return Response({"detail": "더 최신인 동일 사이트가 있습니다. 업데이트 여부를 확인하세요.", "duplicate": duplicate}, status=409)
                    if request.data.get("expected_updated_at") != duplicate["existing_updated_at"]:
                        return Response({"detail": "기존 사이트가 변경되었습니다. 다시 미리보기 후 업데이트하세요.", "duplicate": duplicate}, status=409)
                    before = CompanySerializer(company).data
                    serializer = CompanySerializer(company, data=company_data, partial=True)
                    serializer.is_valid(raise_exception=True)
                    company = serializer.save()
                    updating = True
                    if preview["sheet_name"] == "사이트 등록" or preview.get("layout") == "legacy_fixed":
                        for related in ("contract_products", "contacts", "solutions", "integrations", "systems", "installation_locations", "hardware_specs"):
                            getattr(company, related).all().delete()
                else:
                    if request.data.get("confirm_update") == "true":
                        return Response({"detail": "업데이트할 사이트가 없습니다. 다시 미리보기하세요."}, status=409)
                    company = Company.objects.create(**company_data, created_by=request.user)
                if preview["sheet_name"] == "사이트 등록" or preview.get("layout") == "legacy_fixed":
                    self._create_import_related(company, values)
                    self._sync_import_lookup_options(values)
                if not updating:
                    assign_registered_site(company, request.user)
                CompanyChangeHistory.objects.create(company=company, company_name=company.name, table_name="excel_upload", record_id=company.id, action="update" if updating else "create", before_data=before, after_data={"filename": upload.name, "sheet": preview["sheet_name"], "mapped": preview["mapped"], "missing": preview["missing"], "unmapped_source_labels": preview["unmapped_source_labels"]}, changed_fields=[item["field"] for item in preview["mapped"]])
        except Exception as error:
            return Response({"detail": f"엑셀 등록 중 오류: {error}"}, status=400)
        company = self.get_queryset().get(pk=company.pk)
        return Response(CompanySerializer(company).data, status=200 if updating else 201)

    @staticmethod
    def _create_import_related(company, values):
        get = lambda key: values.get(key) or ""
        if get("ems_package") or get("ems_version"):
            ContractProduct.objects.create(company=company, product_name="EMS", package_name=get("ems_package"), version=get("ems_version"))
        if any(get(key) for key in ("dashboard_package", "dashboard_version", "datamanager_version", "dashboard_location")):
            ContractProduct.objects.create(company=company, product_name="Dashboard", package_name=get("dashboard_package"), version=get("dashboard_version"), installation_location=get("dashboard_location"), configuration=f'Datamanager: {get("datamanager_version")}' if get("datamanager_version") else "")
        contact_columns = [[item.strip() for item in re.split(r"[\r\n,]+", get(key))] for key in ("contact_name", "contact_phone", "contact_mobile", "contact_email", "contact_fax")]
        for index, name in enumerate(contact_columns[0]):
            if not name.strip():
                continue
            value_at = lambda column: column[index].strip() if index < len(column) else ""
            Contact.objects.create(company=company, role="customer", name=name.strip(), phone=value_at(contact_columns[1]), mobile=value_at(contact_columns[2]), email=value_at(contact_columns[3]), fax=value_at(contact_columns[4]), inspection_report_submitted=bool(values.get("inspection_report_submitted")), inspection_report_detail=get("inspection_report_detail") if index == 0 else "")
        # 엑셀에 적힌 솔루션 제목을 그대로 저장한다. 표준 항목이 아니어도 category=other로
        # 생성되므로 웹 UI에서 즉시 확인·수정할 수 있다.
        imported_solutions = values.get("solutions")
        if imported_solutions:
            for solution in imported_solutions:
                Solution.objects.create(
                    company=company, category=solution.get("category") or "other",
                    product_name=solution.get("product_name", ""),
                    used_quantity=solution.get("used_quantity"),
                    total_quantity=solution.get("total_quantity"),
                    other_detail=solution.get("other_detail", ""),
                    additional_info=solution.get("additional_info", ""),
                )
        else:
            for code in ("sms", "nms", "dbms", "apm", "syslog", "trap", "oz"):
                used, total = values.get(f"license_{code}_used"), values.get(f"license_{code}_total")
                other, additional = get(f"license_{code}_other"), get(f"license_{code}_additional")
                if any(item is not None and item != "" for item in (used, total, other, additional)):
                    Solution.objects.create(company=company, category=code, product_name=code.upper() if code != "oz" else "OZ 보고서", used_quantity=used, total_quantity=total, other_detail=other, additional_info=additional)
        for code in ("sms", "email", "push"):
            if values.get(f"integration_{code}"):
                Integration.objects.create(company=company, integration_type=code, enabled=True, detail=get(f"integration_{code}_detail"))
        if get("integration_other"):
            Integration.objects.create(company=company, integration_type="other", enabled=True, detail=get("integration_other"))
        system_fields = ("system_name", "system_set", "system_os", "system_os_version", "system_db", "system_db_version", "system_ip", "system_access", "web_access", "web_port", "db_port", "dashboard_port")
        if values.get("systems"):
            for system in values["systems"]:
                System.objects.create(company=company, **system)
        elif any(get(field) for field in system_fields):
            System.objects.create(company=company, name=get("system_name") or get("system_set") or "시스템", set_configuration=get("system_set"), os_type=get("system_os"), os_version=get("system_os_version"), database_type=get("system_db"), database_version=get("system_db_version"), ip_address=get("system_ip"), system_access_info=get("system_access"), web_access_info=get("web_access"), web_port=values.get("web_port"), database_port=values.get("db_port"), dashboard_port=values.get("dashboard_port"))
        for code, location_type in (("db", "database"), ("datafile", "datafile"), ("java", "java"), ("tomcat", "tomcat"), ("manager", "manager"), ("log", "log")):
            if get(f"install_{code}"):
                InstallationLocation.objects.create(company=company, location_type=location_type, path=get(f"install_{code}"))
        for code, target in (("manager1", "manager_1"), ("manager2", "manager_2"), ("db", "database")):
            cpu, memory, disk = (get(f"{code}_{part}") for part in ("cpu", "memory", "disk"))
            other = get("hw_other") if code == "db" else ""
            if cpu or memory or disk or other:
                HardwareSpec.objects.create(company=company, target=target, cpu=cpu, memory=memory, disk=disk, other_detail=other)

    @staticmethod
    def _sync_import_lookup_options(values):
        for system in values.get("systems", []):
            for field, category in (("set_configuration", "Set 구성"), ("os_type", "OS"), ("database_type", "DB")):
                value = str(system.get(field) or "").strip()
                if value:
                    LookupOption.objects.get_or_create(category=category, value=value)
        """엑셀에서 실제 사용된 선택값을 항목 관리 드롭다운에도 누적한다."""
        def add(category, value):
            value = str(value or "").strip()
            if value:
                LookupOption.objects.get_or_create(category=category, value=value)

        for category, field in (
            ("계약구분", "contract_type"),
            ("EMS 패키지", "ems_package"),
            ("Dashboard 패키지", "dashboard_package"),
            ("Set 구성", "system_set"),
            ("OS", "system_os"),
            ("DB", "system_db"),
        ):
            add(category, values.get(field))

        # 엑셀에서는 Y/N 등 여러 표현이 가능하지만, 항목 관리에는 일관되게 예/아니요로 보관한다.
        if values.get("supplied_server_os_db") is not None:
            add("Server/OS/DB 납품여부", "예" if values["supplied_server_os_db"] else "아니요")
        if values.get("inspection_report_submitted") is not None:
            add("점검지 제출여부", "예" if values["inspection_report_submitted"] else "아니요")
        imported_solutions = values.get("solutions", [])
        for solution in imported_solutions:
            add("구축 솔루션", solution.get("product_name"))
        # 내려받은 .xlsx 양식은 솔루션명이 고정 코드로 저장되므로, 값이 있는 표준 항목만 추가한다.
        if not imported_solutions:
            for code, label in (("sms", "SMS"), ("nms", "NMS"), ("dbms", "DBMS"), ("apm", "APM"), ("syslog", "SYSLOG"), ("trap", "TRAP"), ("oz", "OZ 보고서")):
                if any(values.get(f"license_{code}_{part}") not in (None, "") for part in ("used", "total", "other", "additional")):
                    add("구축 솔루션", label)

    @action(detail=False, methods=["get"])
    def mine(self, request):
        queryset = self.get_queryset() if request.user.is_staff else self.get_queryset().filter(assignments__user=request.user).distinct()
        return Response(self.get_serializer(queryset, many=True).data)


def simple_viewset(model, serializer, fields):
    return type("GeneratedViewSet", (SearchableModelViewSet,), {"queryset": model.objects.all(), "serializer_class": serializer, "search_fields": fields})


ContactViewSet = simple_viewset(Contact, ContactSerializer, ["name", "phone", "mobile", "email"])
ContractProductViewSet = simple_viewset(ContractProduct, ContractProductSerializer, ["product_name", "package_name", "version"])
SolutionViewSet = simple_viewset(Solution, SolutionSerializer, ["category", "product_name", "license_detail", "other_detail", "additional_info"])
IntegrationViewSet = simple_viewset(Integration, IntegrationSerializer, ["integration_type", "detail"])
SystemViewSet = simple_viewset(System, SystemSerializer, ["name", "set_configuration", "os_type", "database_type", "ip_address"])
InstallationLocationViewSet = simple_viewset(InstallationLocation, InstallationLocationSerializer, ["location_type", "path", "note"])
HardwareSpecViewSet = simple_viewset(HardwareSpec, HardwareSpecSerializer, ["target", "cpu", "memory", "disk"])
HardwareCapacityViewSet = simple_viewset(HardwareCapacity, HardwareCapacitySerializer, ["directory", "used_capacity", "total_capacity", "available_capacity"])
LookupOptionViewSet = simple_viewset(LookupOption, LookupOptionSerializer, ["category", "value"])
CompanyChangeHistoryViewSet = simple_viewset(CompanyChangeHistory, CompanyChangeHistorySerializer, ["company_name", "table_name", "action", "changed_fields"])
