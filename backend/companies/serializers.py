from django.db import transaction
from rest_framework import serializers
from .file_uploads import SiteUploadFileField, save_site_attachments
from .dashboard_images import DashboardUploadField, save_dashboard_image
from .models import CompanyDashboardImage, CompanyAttachment, Company, CompanyChangeHistory, Contact, ContractProduct, HardwareCapacity, HardwareSpec, InstallationLocation, Integration, LookupOption, Solution, System
from .site_assignments import can_edit_site, transfer_site


class RelatedSerializer(serializers.ModelSerializer):
    class Meta:
        fields = "__all__"


class ContactSerializer(RelatedSerializer):
    class Meta(RelatedSerializer.Meta): model = Contact
class ContractProductSerializer(RelatedSerializer):
    class Meta(RelatedSerializer.Meta): model = ContractProduct
class SolutionSerializer(RelatedSerializer):
    class Meta(RelatedSerializer.Meta): model = Solution
class IntegrationSerializer(RelatedSerializer):
    class Meta(RelatedSerializer.Meta): model = Integration
class SystemSerializer(RelatedSerializer):
    class Meta(RelatedSerializer.Meta): model = System
class InstallationLocationSerializer(RelatedSerializer):
    class Meta(RelatedSerializer.Meta): model = InstallationLocation
class HardwareSpecSerializer(RelatedSerializer):
    class Meta(RelatedSerializer.Meta): model = HardwareSpec
class HardwareCapacitySerializer(RelatedSerializer):
    class Meta(RelatedSerializer.Meta): model = HardwareCapacity
class LookupOptionSerializer(RelatedSerializer):
    class Meta(RelatedSerializer.Meta): model = LookupOption


class CompanyChangeHistorySerializer(RelatedSerializer):
    class Meta(RelatedSerializer.Meta): model = CompanyChangeHistory


class CompanyAttachmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = CompanyAttachment
        fields = ("id", "company", "original_name", "size", "uploaded_at")
        read_only_fields = fields


class DashboardImageSerializer(serializers.ModelSerializer):
    class Meta:
        model = CompanyDashboardImage
        fields = ("id", "company", "original_name", "size", "width", "height", "uploaded_at")
        read_only_fields = fields


REGISTRATION_RECORDS = {
    "contacts": ContactSerializer,
    "contract-products": ContractProductSerializer,
    "solutions": SolutionSerializer,
    "integrations": IntegrationSerializer,
    "systems": SystemSerializer,
    "installation-locations": InstallationLocationSerializer,
    "hardware-specs": HardwareSpecSerializer,
    "hardware-capacities": HardwareCapacitySerializer,
}


class CompanySerializer(serializers.ModelSerializer):
    can_edit = serializers.SerializerMethodField()
    transfer_to = serializers.IntegerField(min_value=1, max_value=2147483647, required=False, write_only=True)
    registration_records = serializers.DictField(child=serializers.ListField(child=serializers.DictField()), write_only=True, required=False)
    dashboard_image = DashboardImageSerializer(read_only=True)
    remove_dashboard_image = serializers.BooleanField(write_only=True, required=False, default=False)
    dashboard_image_upload = DashboardUploadField(max_length=255, write_only=True, required=False)
    attachments = CompanyAttachmentSerializer(many=True, read_only=True)
    uploaded_files = serializers.ListField(child=SiteUploadFileField(max_length=255), write_only=True, required=False)
    contacts = ContactSerializer(many=True, read_only=True)
    contract_products = ContractProductSerializer(many=True, read_only=True)
    solutions = SolutionSerializer(many=True, read_only=True)
    integrations = IntegrationSerializer(many=True, read_only=True)
    systems = SystemSerializer(many=True, read_only=True)
    installation_locations = InstallationLocationSerializer(many=True, read_only=True)
    hardware_specs = HardwareSpecSerializer(many=True, read_only=True)
    hardware_capacities = HardwareCapacitySerializer(many=True, read_only=True)
    change_history = CompanyChangeHistorySerializer(many=True, read_only=True)

    class Meta:
        model = Company
        fields = "__all__"
        read_only_fields = ("created_by",)


    def get_can_edit(self, company):
        request = self.context.get("request")
        if request is None:
            return False
        return can_edit_site(request.user, company, assigned=getattr(company, "assigned_to_request_user", None))

    def validate(self, attrs):
        if "transfer_to" in attrs and self.instance is None:
            raise serializers.ValidationError({"transfer_to": "등록된 사이트만 이관할 수 있습니다."})
        if "registration_records" in attrs and (
            self.instance or attrs["registration_records"].keys() - REGISTRATION_RECORDS.keys()
        ):
            raise serializers.ValidationError({"registration_records": "신규 사이트의 등록 항목만 입력할 수 있습니다."})
        if attrs.get("remove_dashboard_image") and attrs.get("dashboard_image_upload"):
            raise serializers.ValidationError({"dashboard_image_upload": "이미지 등록과 삭제를 동시에 요청할 수 없습니다."})
        return attrs

    def _save_files(self, company, files, dashboard_image, remove_dashboard_image):
        request = self.context.get("request")
        user = request.user if request else None
        stored = []
        try:
            if remove_dashboard_image:
                CompanyDashboardImage.objects.filter(company=company).delete()
                company._state.fields_cache.pop("dashboard_image", None)
            stored.extend(save_site_attachments(company, files, user))
            if dashboard_image:
                stored.extend(save_dashboard_image(company, dashboard_image, user))
        except Exception:
            for storage, name in stored:
                storage.delete(name)
            raise

    @transaction.atomic
    def create(self, validated_data):
        records = validated_data.pop("registration_records", {})
        files = validated_data.pop("uploaded_files", [])
        dashboard_image = validated_data.pop("dashboard_image_upload", None)
        remove_dashboard_image = validated_data.pop("remove_dashboard_image", False)
        company = super().create(validated_data)
        for kind, rows in records.items():
            related = REGISTRATION_RECORDS[kind](data=[{**row, "company": company.pk} for row in rows], many=True)
            related.is_valid(raise_exception=True)
            related.save()
        self._save_files(company, files, dashboard_image, remove_dashboard_image)
        return company

    @transaction.atomic
    def update(self, instance, validated_data):
        recipient = validated_data.pop("transfer_to", None)
        previous_name = instance.name
        files = validated_data.pop("uploaded_files", [])
        dashboard_image = validated_data.pop("dashboard_image_upload", None)
        remove_dashboard_image = validated_data.pop("remove_dashboard_image", False)
        company = super().update(instance, validated_data)
        if recipient is not None:
            transfer_site(company, recipient, previous_name)
        self._save_files(company, files, dashboard_image, remove_dashboard_image)
        return company


class CompanyDashboardSerializer(CompanySerializer):
    change_history = None
