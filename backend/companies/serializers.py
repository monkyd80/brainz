from rest_framework import serializers
from .models import Company, CompanyChangeHistory, Contact, ContractProduct, HardwareCapacity, HardwareSpec, InstallationLocation, Integration, LookupOption, Solution, System


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


class CompanySerializer(serializers.ModelSerializer):
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
