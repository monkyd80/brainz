from django.contrib import admin
from .models import Company, Contact, ContractProduct, HardwareSpec, InstallationLocation, Integration, Solution, System


class ContactInline(admin.TabularInline):
    model = Contact
    extra = 0


class SolutionInline(admin.TabularInline):
    model = Solution
    extra = 0


@admin.register(Company)
class CompanyAdmin(admin.ModelAdmin):
    list_display = ("name", "status", "contract_type", "sales_manager", "remote_support", "updated_at")
    list_filter = ("status", "contract_type", "remote_support", "supplied_server_os_db")
    search_fields = ("name", "business_code", "maintenance_code", "address", "sales_manager")
    inlines = (ContactInline, SolutionInline)


admin.site.register((Contact, ContractProduct, Integration, System, InstallationLocation, HardwareSpec))
