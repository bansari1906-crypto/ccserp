from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import NotificationViewSet, DeviceTokenViewSet

router = DefaultRouter()
router.register(r'notifications/devices', DeviceTokenViewSet, basename='device_token')
router.register(r'notifications', NotificationViewSet, basename='notification')

urlpatterns = [
    path('', include(router.urls)),
]
