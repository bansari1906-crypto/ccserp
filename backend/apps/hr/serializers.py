from rest_framework import serializers
from .models import Attendance, DealerVisit, Expense, LocationTrack, DailyTourPlan

class LocationTrackSerializer(serializers.ModelSerializer):
    class Meta:
        model = LocationTrack
        fields = '__all__'
        read_only_fields = ('employee',)

class DailyTourPlanSerializer(serializers.ModelSerializer):
    employee_name = serializers.CharField(source='employee.username', read_only=True)
    manager_name = serializers.CharField(source='manager_approval.username', read_only=True)
    
    class Meta:
        model = DailyTourPlan
        fields = '__all__'
        read_only_fields = ('employee', 'status', 'manager_approval')

class AttendanceSerializer(serializers.ModelSerializer):
    employee_id = serializers.UUIDField(source='employee.id', read_only=True)
    employee_name = serializers.SerializerMethodField()
    employee_role = serializers.CharField(source='employee.role', read_only=True)
    employee_email = serializers.CharField(source='employee.email', read_only=True)

    def get_employee_name(self, obj):
        if obj.employee:
            full_name = f"{obj.employee.first_name} {obj.employee.last_name}".strip()
            return full_name or obj.employee.username or obj.employee.email.split('@')[0]
        return "Employee"

    class Meta:
        model = Attendance
        fields = '__all__'
        read_only_fields = ('employee', 'date', 'working_hours')

class DealerVisitSerializer(serializers.ModelSerializer):
    employee_name = serializers.CharField(source='employee.username', read_only=True)
    dealer_name = serializers.CharField(source='dealer.username', read_only=True, default=None)
    
    class Meta:
        model = DealerVisit
        fields = '__all__'
        read_only_fields = ('employee', 'date')
        extra_kwargs = {
            'dealer': {'required': False, 'allow_null': True}
        }

class ExpenseSerializer(serializers.ModelSerializer):
    employee_name = serializers.CharField(source='employee.username', read_only=True)
    approved_by_name = serializers.CharField(source='approved_by.username', read_only=True)
    remarks = serializers.CharField(source='description', required=False, allow_blank=True, allow_null=True)
    approval_amount = serializers.SerializerMethodField()

    def get_approval_amount(self, obj):
        return float(obj.amount) if obj.status == 'Approved' else 0.0

    class Meta:
        model = Expense
        fields = '__all__'
        read_only_fields = ('employee', 'status', 'approved_by')
        extra_kwargs = {
            'date': {'required': False},
            'amount': {'required': False},
            'description': {'required': False, 'allow_blank': True},
        }
