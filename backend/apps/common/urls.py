from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import DashboardAPIView, CompanyProfileViewSet, AuditLogViewSet, HealthCheckView

router = DefaultRouter()
router.register(r'company-profile', CompanyProfileViewSet, basename='company-profile')
router.register(r'audit-logs', AuditLogViewSet, basename='audit-log')

urlpatterns = [
    path('health/', HealthCheckView.as_view(), name='health_check'),
    path('dashboard/', DashboardAPIView.as_view(), name='dashboard'),
    path('', include(router.urls)),
]
