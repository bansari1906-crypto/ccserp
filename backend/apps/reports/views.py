from datetime import datetime, date, timedelta
import calendar
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from django.db.models import Sum, Count, F, Q
from apps.orders.models import Order, OrderStatus
from apps.products.models import Product
from apps.hr.models import Attendance, Expense
from apps.wallet.models import LedgerEntry, Wallet
from apps.support.models import Complaint, ReturnRequest, ComplaintStatus, ReturnStatus
from apps.accounts.models import User, UserRole

@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def generate_report(request):
    report_type = request.query_params.get('type')
    start_date = request.query_params.get('start_date')
    end_date = request.query_params.get('end_date')

    if not all([report_type, start_date, end_date]):
        return Response({"error": "type, start_date, and end_date are required"}, status=400)
        
    try:
        start = datetime.strptime(start_date, '%Y-%m-%d').date()
        end = datetime.strptime(end_date, '%Y-%m-%d').date()
    except ValueError:
        return Response({"error": "Invalid date format. Use YYYY-MM-DD"}, status=400)

    if request.user.role not in [UserRole.SUPER_ADMIN, UserRole.ADMIN]:
        return Response({"error": "Unauthorized"}, status=403)

    if report_type == 'sales':
        # Daily sales aggregation
        qs = Order.objects.filter(created_at__date__gte=start, created_at__date__lte=end, status='Approved')
        data = list(qs.values(date=F('created_at__date')).annotate(total=Sum('grand_total')).order_by('date'))
        return Response({"report_type": "Sales", "data": data})
        
    elif report_type == 'dealer':
        # Sales per dealer
        qs = Order.objects.filter(created_at__date__gte=start, created_at__date__lte=end)
        data = list(qs.values(dealer_name=F('dealer__username')).annotate(total_orders=Count('id'), total_sales=Sum('grand_total')).order_by('-total_sales'))
        return Response({"report_type": "Dealer Performance", "data": data})

    elif report_type == 'expense':
        # Expenses per employee
        qs = Expense.objects.filter(date__gte=start, date__lte=end, status='Approved')
        data = list(qs.values(employee_name=F('employee__username')).annotate(total_expenses=Sum('amount')).order_by('-total_expenses'))
        return Response({"report_type": "Employee Expenses", "data": data})

    return Response({"error": "Unknown report type"}, status=400)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def dashboard_summary(request):
    user = request.user
    today = date.today()
    role = user.role

    # Common valid sales order status list
    valid_sales_statuses = [
        OrderStatus.APPROVED,
        OrderStatus.BILTY_UPLOADED,
        OrderStatus.READY_DISPATCH,
        OrderStatus.DISPATCHED,
        OrderStatus.DELIVERED
    ]

    # Past 6 months chart data
    sales_graph_data = []
    for i in range(5, -1, -1):
        # Calculate month date
        # Month offset
        year = today.year
        month = today.month - i
        while month <= 0:
            month += 12
            year -= 1
        month_name = calendar.month_abbr[month]

        orders_qs = Order.objects.filter(
            created_at__year=year,
            created_at__month=month,
            status__in=valid_sales_statuses
        )
        if role == UserRole.DEALER:
            orders_qs = orders_qs.filter(dealer=user)
        elif role == UserRole.DISTRIBUTOR:
            orders_qs = orders_qs.filter(created_by=user)

        total_month_sales = float(orders_qs.aggregate(total=Sum('grand_total'))['total'] or 0.0)
        # in Lakhs or raw INR
        sales_graph_data.append({
            'month': month_name,
            'sales': round(total_month_sales / 100000.0, 2),
            'raw_sales': total_month_sales
        })

    # Order status pie breakdown
    orders_base = Order.objects.all()
    if role == UserRole.DEALER:
        orders_base = orders_base.filter(dealer=user)
    elif role == UserRole.DISTRIBUTOR:
        orders_base = orders_base.filter(created_by=user)

    status_counts_raw = dict(
        orders_base.values('status').annotate(count=Count('id')).values_list('status', 'count')
    )
    status_color_map = {
        'Delivered': '#1B5E20',
        'Approved': '#2E7D32',
        'Ready to Dispatch': '#81C784',
        'Bilty Uploaded': '#4CAF50',
        'Dispatched': '#66BB6A',
        'Pending Approval': '#F57F17',
        'Rejected': '#C62828',
        'Cancelled': '#D32F2F',
    }
    order_status_distribution = [
        {
            'name': st,
            'value': count,
            'color': status_color_map.get(st, '#757575')
        }
        for st, count in status_counts_raw.items()
    ]

    # Admin / Super Admin metrics
    if role in [UserRole.SUPER_ADMIN, UserRole.ADMIN]:
        total_sales = float(
            Order.objects.filter(status__in=valid_sales_statuses).aggregate(total=Sum('grand_total'))['total'] or 0.0
        )
        today_orders_count = Order.objects.filter(created_at__date=today).count()
        pending_orders_count = Order.objects.filter(status=OrderStatus.PENDING_APPROVAL).count()
        total_dealers_count = User.objects.filter(role=UserRole.DEALER).count()
        total_distributors_count = User.objects.filter(role=UserRole.DISTRIBUTOR).count()
        active_field_staff_count = Attendance.objects.filter(
            date=today, status__in=['Working', 'Present']
        ).values('employee').distinct().count()
        total_products_count = Product.objects.count()
        unavailable_products_count = Product.objects.filter(status__in=['Unavailable', 'Inactive', 'Discontinued']).count()
        low_stock_count = unavailable_products_count
        total_collections = float(
            LedgerEntry.objects.filter(type='Collection').aggregate(total=Sum('amount'))['total'] or 0.0
        )
        pending_complaints_count = Complaint.objects.filter(
            status__in=[ComplaintStatus.OPEN, ComplaintStatus.IN_PROGRESS]
        ).count()
        pending_returns_count = ReturnRequest.objects.filter(
            status=ReturnStatus.REQUESTED
        ).count()

        return Response({
            'role': role,
            'total_sales': total_sales,
            'total_sales_display': f"₹{total_sales:,.2f}",
            'today_orders_count': today_orders_count,
            'pending_orders_count': pending_orders_count,
            'total_dealers_count': total_dealers_count,
            'total_distributors_count': total_distributors_count,
            'active_field_staff_count': active_field_staff_count,
            'total_products_count': total_products_count,
            'unavailable_products_count': unavailable_products_count,
            'low_stock_count': low_stock_count,
            'total_collections': total_collections,
            'pending_complaints_count': pending_complaints_count,
            'pending_returns_count': pending_returns_count,
            'sales_graph_data': sales_graph_data,
            'order_status_distribution': order_status_distribution,
        })

    # Dealer metrics
    elif role == UserRole.DEALER:
        dealer_orders = Order.objects.filter(dealer=user)
        total_sales = float(
            dealer_orders.filter(status__in=valid_sales_statuses).aggregate(total=Sum('grand_total'))['total'] or 0.0
        )
        today_orders_count = dealer_orders.filter(created_at__date=today).count()
        pending_orders_count = dealer_orders.filter(status=OrderStatus.PENDING_APPROVAL).count()
        total_orders_count = dealer_orders.count()

        wallet = getattr(user, 'wallet', None)
        credit_limit = float(wallet.credit_limit) if wallet else 0.0
        outstanding_amount = float(wallet.outstanding_amount) if wallet else 0.0

        open_complaints = Complaint.objects.filter(
            dealer=user, status__in=[ComplaintStatus.OPEN, ComplaintStatus.IN_PROGRESS]
        ).count()

        return Response({
            'role': role,
            'total_sales': total_sales,
            'total_sales_display': f"₹{total_sales:,.2f}",
            'today_orders_count': today_orders_count,
            'pending_orders_count': pending_orders_count,
            'total_orders_count': total_orders_count,
            'credit_limit': credit_limit,
            'outstanding_amount': outstanding_amount,
            'open_complaints': open_complaints,
            'sales_graph_data': sales_graph_data,
            'order_status_distribution': order_status_distribution,
        })

    # Distributor / Field Staff metrics
    else:
        field_orders = Order.objects.filter(created_by=user)
        total_sales = float(
            field_orders.filter(status__in=valid_sales_statuses).aggregate(total=Sum('grand_total'))['total'] or 0.0
        )
        today_orders_count = field_orders.filter(created_at__date=today).count()
        pending_orders_count = field_orders.filter(status=OrderStatus.PENDING_APPROVAL).count()
        total_orders_count = field_orders.count()
        total_collections = float(
            LedgerEntry.objects.filter(created_by=user, type='Collection').aggregate(total=Sum('amount'))['total'] or 0.0
        )

        return Response({
            'role': role,
            'total_sales': total_sales,
            'total_sales_display': f"₹{total_sales:,.2f}",
            'today_orders_count': today_orders_count,
            'pending_orders_count': pending_orders_count,
            'total_orders_count': total_orders_count,
            'total_collections': total_collections,
            'sales_graph_data': sales_graph_data,
            'order_status_distribution': order_status_distribution,
        })

