from rest_framework.routers import DefaultRouter
from .attachment_views import CompanyAttachmentViewSet
from .dashboard_images import DashboardImageViewSet
from .views import CompanyChangeHistoryViewSet, CompanyViewSet, ContactViewSet, ContractProductViewSet, HardwareCapacityViewSet, HardwareSpecViewSet, InstallationLocationViewSet, IntegrationViewSet, LookupOptionViewSet, SolutionViewSet, SystemViewSet

router = DefaultRouter()
router.register("companies", CompanyViewSet)
router.register("site-files", CompanyAttachmentViewSet)
router.register("dashboard-images", DashboardImageViewSet, basename="dashboard-image")
router.register("contacts", ContactViewSet)
router.register("contract-products", ContractProductViewSet)
router.register("solutions", SolutionViewSet)
router.register("integrations", IntegrationViewSet)
router.register("systems", SystemViewSet)
router.register("installation-locations", InstallationLocationViewSet)
router.register("hardware-specs", HardwareSpecViewSet)
router.register("hardware-capacities", HardwareCapacityViewSet)
router.register("lookup-options", LookupOptionViewSet)
router.register("history", CompanyChangeHistoryViewSet)
urlpatterns = router.urls
