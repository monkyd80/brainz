from django.db import transaction
from rest_framework import serializers
from .file_uploads import SiteUploadFileField, save_site_attachments
from .dashboard_images import DashboardUploadField, save_dashboard_image
from .models import CompanyDashboardImage, CompanyAttachment, Company, CompanyChangeHistory, Contact, ContractProduct, HardwareCapacity, HardwareSpec, InstallationLocation, Integration, LookupOption, Solution, System


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


class CompanySerializer(serializers.ModelSerializer):
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


    def validate(self, attrs):
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
        files = validated_data.pop("uploaded_files", [])
        dashboard_image = validated_data.pop("dashboard_image_upload", None)
        remove_dashboard_image = validated_data.pop("remove_dashboard_image", False)
        company = super().create(validated_data)
        self._save_files(company, files, dashboard_image, remove_dashboard_image)
        return company

    @transaction.atomic
    def update(self, instance, validated_data):
        files = validated_data.pop("uploaded_files", [])
        dashboard_image = validated_data.pop("dashboard_image_upload", None)
        remove_dashboard_image = validated_data.pop("remove_dashboard_image", False)
        company = super().update(instance, validated_data)
        self._save_files(company, files, dashboard_image, remove_dashboard_image)
        return company
