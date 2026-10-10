from rest_framework import serializers
from .models import Notification, DeviceToken

class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = [
            'id', 'user', 'title', 'message', 'type', 'event_type',
            'reference_id', 'reference_type', 'destination', 'is_read',
            'delivery_status', 'metadata', 'created_at'
        ]
        read_only_fields = ['id', 'user', 'created_at']

class DeviceTokenSerializer(serializers.ModelSerializer):
    class Meta:
        model = DeviceToken
        fields = ['id', 'token', 'platform', 'is_active', 'last_seen', 'created_at']
        read_only_fields = ['id', 'is_active', 'last_seen', 'created_at']
