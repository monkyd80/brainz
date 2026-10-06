from django.db import models
from django.core.serializers.json import DjangoJSONEncoder
from django.conf import settings


class Company(models.Model):
    class Status(models.TextChoices):
        ACTIVE = "active", "운영"
        PENDING = "pending", "구축 예정"
        CLOSED = "closed", "종료"

    name = models.CharField("사이트명", max_length=200, unique=True, db_index=True)
    status = models.CharField("상태", max_length=16, choices=Status, default=Status.ACTIVE, db_index=True)
    build_year = models.PositiveSmallIntegerField("구축년도", null=True, blank=True, db_index=True)
    build_date = models.DateField("구축 날짜", null=True, blank=True, db_index=True)
    business_code = models.CharField("사업 코드", max_length=80, blank=True, db_index=True)
    maintenance_code = models.CharField("유지보수 코드", max_length=80, blank=True, db_index=True)
    contract_type = models.CharField("계약 구분", max_length=100, blank=True, db_index=True)
    sales_manager = models.CharField("담당 영업", max_length=100, blank=True, db_index=True)
    support_staff = models.CharField("지원/인력", max_length=200, blank=True, db_index=True)
    current_file_date = models.DateField("현행화 일자", null=True, blank=True)
    supplied_server_os_db = models.BooleanField("Server/OS/DB 납품", default=False)
    remote_support = models.BooleanField("원격 지원", default=False, db_index=True)
    address = models.CharField("위치", max_length=500, blank=True, db_index=True)
    notes = models.TextField("참고 사항", blank=True)
    special_notes = models.TextField("특이사항 및 전달사항", blank=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="created_companies", verbose_name="등록자")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "com_company"
        db_table_comment = "업체 및 사이트 기본 정보: 계약, 담당 영업, 지원 인력, 위치, 원격지원 여부"
        ordering = ["name"]
        verbose_name = "업체/사이트"
        verbose_name_plural = "업체/사이트"

    def __str__(self):
        return self.name


class ContractProduct(models.Model):
    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name="contract_products")
    product_name = models.CharField("제품", max_length=100, db_index=True)
    package_name = models.CharField("패키지", max_length=100, blank=True, db_index=True)
    version = models.CharField("버전", max_length=100, blank=True, db_index=True)
    installation_location = models.CharField("설치 위치", max_length=200, blank=True, db_index=True)
    configuration = models.CharField("구성", max_length=200, blank=True)

    class Meta:
        db_table = "com_product"
        db_table_comment = "계약 제품 정보: EMS·Dashboard 패키지, 버전, 설치 위치, 구성"


class Contact(models.Model):
    class Role(models.TextChoices):
        CUSTOMER = "customer", "고객 담당자"
        SALES = "sales", "영업"
        SUPPORT = "support", "기술 지원"
        OTHER = "other", "기타"

    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name="contacts")
    role = models.CharField("역할", max_length=20, choices=Role, default=Role.CUSTOMER, db_index=True)
    name = models.CharField("이름", max_length=100, db_index=True)
    phone = models.CharField("유선번호", max_length=50, blank=True, db_index=True)
    mobile = models.CharField("휴대전화", max_length=50, blank=True, db_index=True)
    email = models.EmailField(blank=True, db_index=True)
    fax = models.CharField("FAX", max_length=50, blank=True)
    inspection_report_submitted = models.BooleanField("점검지 제출", default=False)
    inspection_report_detail = models.TextField("점검지 제출 상세", blank=True)

    class Meta:
        db_table = "com_contact"
        db_table_comment = "업체별 고객·영업·기술지원 담당자 및 연락처"


class Solution(models.Model):
    class Category(models.TextChoices):
        SMS = "sms", "SMS"
        NMS = "nms", "NMS"
        DBMS = "dbms", "DBMS"
        APM = "apm", "APM"
        SYSLOG = "syslog", "SYSLOG"
        TRAP = "trap", "TRAP"
        OZ = "oz", "OZ 보고서"
        OTHER = "other", "기타"

    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name="solutions")
    category = models.CharField("분류", max_length=20, choices=Category, db_index=True)
    product_name = models.CharField("솔루션명", max_length=150, blank=True, db_index=True)
    license_detail = models.CharField("라이선스", max_length=300, blank=True, db_index=True)
    quantity = models.PositiveIntegerField("수량", null=True, blank=True)
    used_quantity = models.PositiveIntegerField("사용 개수", null=True, blank=True, db_index=True)
    total_quantity = models.PositiveIntegerField("전체 개수", null=True, blank=True, db_index=True)
    other_detail = models.CharField("기타", max_length=300, blank=True, db_index=True)
    additional_info = models.TextField("추가 정보", blank=True)

    class Meta:
        db_table = "com_lic"
        db_table_comment = "구축 솔루션과 라이선스 정보: SMS, NMS, DBMS, APM, SYSLOG 등의 사용·전체 개수, 기타, 추가 정보"
        indexes = [models.Index(fields=["company", "category"], name="com_lic_company_category_idx")]


class Integration(models.Model):
    class Type(models.TextChoices):
        SMS = "sms", "단문자"
        EMAIL = "email", "메일"
        PUSH = "push", "PushAPP"
        OTHER = "other", "기타"

    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name="integrations")
    integration_type = models.CharField("연동 유형", max_length=20, choices=Type, db_index=True)
    enabled = models.BooleanField("사용", default=True, db_index=True)
    detail = models.TextField("상세", blank=True)

    class Meta:
        db_table = "com_dev"
        db_table_comment = "외부 연동 개발 정보: 단문자, 메일, PushAPP 및 기타 연동 설정"


class System(models.Model):
    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name="systems")
    name = models.CharField("시스템명", max_length=150, db_index=True)
    set_configuration = models.CharField("Set 구성", max_length=200, blank=True, db_index=True)
    os_type = models.CharField("OS 종류", max_length=100, blank=True, db_index=True)
    os_version = models.CharField("OS 버전", max_length=100, blank=True, db_index=True)
    database_type = models.CharField("DB", max_length=100, blank=True, db_index=True)
    database_version = models.CharField("DB 버전", max_length=100, blank=True)
    ip_address = models.CharField("IP 주소", max_length=500, null=True, blank=True, db_index=True)
    system_access_info = models.CharField("시스템 접속 정보", max_length=500, blank=True)
    web_access_info = models.CharField("Web 접속 정보", max_length=500, blank=True)
    web_port = models.TextField(null=True, blank=True)
    database_port = models.PositiveIntegerField(null=True, blank=True, db_index=True)
    dashboard_port = models.TextField(null=True, blank=True)

    class Meta:
        db_table = "com_system"
        db_table_comment = "시스템 구성 정보: OS, DB, IP 주소, 접속 정보 및 서비스 포트"


class InstallationLocation(models.Model):
    class Type(models.TextChoices):
        DATABASE = "database", "DB"
        DATAFILE = "datafile", "Zenius Datafile"
        JAVA = "java", "JAVA"
        TOMCAT = "tomcat", "TOMCAT"
        MANAGER = "manager", "Manager"
        LOG = "log", "LOG"
        OTHER = "other", "기타"

    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name="installation_locations")
    location_type = models.CharField("항목", max_length=20, choices=Type, db_index=True)
    path = models.CharField("설치 경로", max_length=1000, db_index=True)
    note = models.CharField("비고", max_length=300, blank=True)

    class Meta:
        db_table = "com_install"
        db_table_comment = "서버 설치 경로 정보: DB, Zenius Datafile, JAVA, TOMCAT, Manager, LOG"


class HardwareSpec(models.Model):
    class Target(models.TextChoices):
        MANAGER_1 = "manager_1", "Manager #1"
        MANAGER_2 = "manager_2", "Manager #2"
        DATABASE = "database", "DB"

    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name="hardware_specs")
    target = models.CharField("대상", max_length=20, choices=Target, db_index=True)
    cpu = models.CharField("CPU", max_length=200, blank=True, db_index=True)
    memory = models.CharField("Memory", max_length=100, blank=True, db_index=True)
    disk = models.CharField("Disk", max_length=200, blank=True, db_index=True)
    other_detail = models.TextField("기타", blank=True)

    class Meta:
        db_table = "com_spec"
        db_table_comment = "하드웨어 사양: Manager #1, Manager #2, DB의 CPU, Memory, Disk"
        constraints = [models.UniqueConstraint(fields=["company", "target"], name="unique_hardware_target_per_company")]


class HardwareCapacity(models.Model):
    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name="hardware_capacities")
    directory = models.CharField("디렉토리", max_length=1000, db_index=True)
    used_capacity = models.CharField("사용량", max_length=100, blank=True)
    total_capacity = models.CharField("전체", max_length=100, blank=True)
    available_capacity = models.CharField("가용량", max_length=100, blank=True)

    class Meta:
        db_table = "com_hw_capacity"
        db_table_comment = "업체별 H/W 디렉토리 용량: 사용량, 전체 용량, 가용량"


class CompanyChangeHistory(models.Model):
    """Immutable audit snapshots for every company-related record change."""

    class Action(models.TextChoices):
        CREATE = "create", "생성"
        UPDATE = "update", "수정"
        DELETE = "delete", "삭제"

    company = models.ForeignKey(Company, on_delete=models.SET_NULL, null=True, blank=True, related_name="change_history", db_index=True)
    company_name = models.CharField("업체명(기록 시점)", max_length=200, db_index=True)
    table_name = models.CharField("대상 테이블", max_length=80, db_index=True)
    record_id = models.PositiveBigIntegerField("대상 레코드 ID", db_index=True)
    action = models.CharField("변경 유형", max_length=10, choices=Action, db_index=True)
    before_data = models.JSONField("변경 전 데이터", default=dict, encoder=DjangoJSONEncoder)
    after_data = models.JSONField("변경 후 데이터", default=dict, encoder=DjangoJSONEncoder)
    changed_fields = models.JSONField("변경 컬럼", default=list, encoder=DjangoJSONEncoder)
    changed_at = models.DateTimeField("변경 일시", auto_now_add=True, db_index=True)

    class Meta:
        db_table = "com_history"
        db_table_comment = "업체별 변경 이력: 수정 전후 스냅샷, 변경 컬럼, 변경 시각"
        ordering = ["-changed_at", "-id"]
        indexes = [models.Index(fields=["company", "-changed_at"], name="com_history_company_time_idx")]


class CompanyAssignment(models.Model):
    """Connects a user account to the sites they are allowed to manage."""

    class Role(models.TextChoices):
        MANAGER = "manager", "담당자"
        VIEWER = "viewer", "조회자"

    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name="assignments")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="company_assignments")
    role = models.CharField("권한", max_length=20, choices=Role, default=Role.MANAGER)
    is_primary = models.BooleanField("주 담당 사이트", default=False)
    assigned_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "com_assignment"
        db_table_comment = "사용자와 담당 업체를 연결하는 권한 매핑 정보"
        constraints = [models.UniqueConstraint(fields=["company", "user"], name="unique_company_user_assignment")]


class UserProfile(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="employee_profile")
    employee_number = models.CharField("사번", max_length=50, blank=True, default="")


class LookupOption(models.Model):
    category = models.CharField("항목 분류", max_length=60, db_index=True)
    value = models.CharField("선택값", max_length=200, db_index=True)
    sort_order = models.PositiveIntegerField("표시 순서", default=0)
    is_active = models.BooleanField("사용", default=True)

    class Meta:
        db_table = "com_lookup_option"
        db_table_comment = "수동 등록 선택 항목 관리: 계약, 제품, OS, DB 등 드롭다운 값"
        ordering = ["category", "sort_order", "value"]
        constraints = [models.UniqueConstraint(fields=["category", "value"], name="unique_lookup_category_value")]
