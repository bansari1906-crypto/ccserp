import logging
from datetime import date
from django.db.models.signals import post_save
from django.dispatch import receiver
from apps.orders.models import Order, OrderStatus
from apps.accounts.models import User, UserRole
from apps.wallet.models import LedgerEntry, LedgerEntryType
from apps.products.models import Product
from apps.hr.models import Expense, ExpenseStatus, Attendance
from .models import Notification, NotificationType
from .services import notify_user, notify_roles

logger = logging.getLogger(__name__)

@receiver(post_save, sender=Order)
def order_lifecycle_notifications(sender, instance, created, **kwargs):
    if kwargs.get('raw', False):
        return

    dealer_name = ""
    if instance.dealer:
        dealer_name = f"{instance.dealer.first_name} {instance.dealer.last_name}".strip() or instance.dealer.username or instance.dealer.email

    if created:
        # 1. Notify Admins
        notify_roles(
            roles=['Admin'],
            title="New Order Received",
            message=f"Order #{instance.order_number} placed by {dealer_name or 'Distributor'} totaling ₹{instance.grand_total:,.2f} is waiting for review.",
            type=NotificationType.ORDER,
            event_type='order.created',
            reference_id=str(instance.id),
            reference_type='order',
            destination='orders',
            metadata={"order_number": instance.order_number, "dealer_name": dealer_name, "total": str(instance.grand_total)}
        )

        # 2. Notify Employee (if submitted by Employee)
        if instance.created_by and instance.created_by.role == UserRole.EMPLOYEE:
            notify_user(
                user=instance.created_by,
                title="Order Submitted",
                message=f"Order #{instance.order_number} for {dealer_name} submitted successfully.",
                type=NotificationType.ORDER,
                event_type='order.created_confirmation',
                reference_id=str(instance.id),
                reference_type='order',
                destination='orders',
                metadata={"order_number": instance.order_number}
            )

        # 3. Notify Distributor
        if instance.dealer and instance.dealer != instance.created_by:
            notify_user(
                user=instance.dealer,
                title="Order Placed",
                message=f"Your order #{instance.order_number} for ₹{instance.grand_total:,.2f} has been submitted.",
                type=NotificationType.ORDER,
                event_type='order.created_distributor',
                reference_id=str(instance.id),
                reference_type='order',
                destination='orders',
                metadata={"order_number": instance.order_number}
            )
    else:
        # Status Lifecycle Notifications
        if instance.status == OrderStatus.APPROVED:
            if instance.dealer:
                notify_user(
                    user=instance.dealer,
                    title="Order Approved",
                    message=f"Your order #{instance.order_number} has been approved by Admin.",
                    type=NotificationType.APPROVAL,
                    event_type='order.approved',
                    reference_id=str(instance.id),
                    reference_type='order',
                    destination='orders'
                )
            if instance.created_by and instance.created_by != instance.dealer:
                notify_user(
                    user=instance.created_by,
                    title="Order Approved",
                    message=f"Order #{instance.order_number} for {dealer_name} was approved by Admin.",
                    type=NotificationType.APPROVAL,
                    event_type='order.approved',
                    reference_id=str(instance.id),
                    reference_type='order',
                    destination='orders'
                )

        elif instance.status == OrderStatus.REJECTED:
            if instance.dealer:
                notify_user(
                    user=instance.dealer,
                    title="Order Rejected",
                    message=f"Your order #{instance.order_number} was rejected by Admin.",
                    type=NotificationType.ORDER,
                    event_type='order.rejected',
                    reference_id=str(instance.id),
                    reference_type='order',
                    destination='orders'
                )
            if instance.created_by and instance.created_by != instance.dealer:
                notify_user(
                    user=instance.created_by,
                    title="Order Rejected",
                    message=f"Order #{instance.order_number} for {dealer_name} was rejected by Admin.",
                    type=NotificationType.ORDER,
                    event_type='order.rejected',
                    reference_id=str(instance.id),
                    reference_type='order',
                    destination='orders'
                )

        elif instance.status == OrderStatus.BILTY_UPLOADED:
            # Notify Warehouse that Bilty is attached and ready for LR
            notify_roles(
                roles=['Warehouse'],
                title="Bilty Uploaded",
                message=f"Bilty generated for Order #{instance.order_number} ({instance.bilty_number}). Ready for LR generation.",
                type=NotificationType.DISPATCH,
                event_type='order.bilty_uploaded',
                reference_id=str(instance.id),
                reference_type='order',
                destination='dispatch'
            )
            if instance.dealer:
                notify_user(
                    user=instance.dealer,
                    title="Bilty Generated",
                    message=f"Bilty #{instance.bilty_number} generated for your order #{instance.order_number}.",
                    type=NotificationType.DISPATCH,
                    event_type='order.bilty_uploaded',
                    reference_id=str(instance.id),
                    reference_type='order',
                    destination='orders'
                )

        elif instance.status == OrderStatus.READY_DISPATCH:
            # Notify Warehouse
            notify_roles(
                roles=['Warehouse'],
                title="Ready to Dispatch",
                message=f"Order #{instance.order_number} is Ready to Dispatch. Please attach LR details.",
                type=NotificationType.DISPATCH,
                event_type='order.ready_dispatch',
                reference_id=str(instance.id),
                reference_type='order',
                destination='dispatch'
            )

        elif instance.status == OrderStatus.DISPATCHED:
            # Notify Admin, Warehouse, Employee, and Distributor
            notify_roles(
                roles=['Admin'],
                title="Order Dispatched",
                message=f"Order #{instance.order_number} dispatched to {dealer_name} (LR: {instance.lr_number or 'Standard'}).",
                type=NotificationType.DISPATCH,
                event_type='order.dispatched',
                reference_id=str(instance.id),
                reference_type='order',
                destination='orders'
            )
            if instance.dealer:
                notify_user(
                    user=instance.dealer,
                    title="Order Dispatched",
                    message=f"Your order #{instance.order_number} has been dispatched! LR: {instance.lr_number or 'In Transit'} via {instance.transport_details or 'Transport'}.",
                    type=NotificationType.DISPATCH,
                    event_type='order.dispatched',
                    reference_id=str(instance.id),
                    reference_type='order',
                    destination='orders'
                )
            if instance.created_by and instance.created_by != instance.dealer:
                notify_user(
                    user=instance.created_by,
                    title="Order Dispatched",
                    message=f"Order #{instance.order_number} for {dealer_name} has been dispatched.",
                    type=NotificationType.DISPATCH,
                    event_type='order.dispatched',
                    reference_id=str(instance.id),
                    reference_type='order',
                    destination='orders'
                )


@receiver(post_save, sender=LedgerEntry)
def payment_collection_notification(sender, instance, created, **kwargs):
    """
    Triggers payment receipt notifications when a Collection ledger entry is recorded.
    Deduplicated via unique reference_id to prevent duplicate alerts on retries.
    """
    if kwargs.get('raw', False) or not created:
        return

    if instance.type == LedgerEntryType.COLLECTION:
        distributor = instance.wallet.dealer
        dist_name = f"{distributor.first_name} {distributor.last_name}".strip() or distributor.username or distributor.email

        # 1. Notify Admin
        notify_roles(
            roles=['Admin'],
            title="Payment Recorded",
            message=f"Payment of ₹{instance.amount:,.2f} recorded for {dist_name} (Ref: {instance.reference or 'Direct'}).",
            type=NotificationType.PAYMENT,
            event_type='payment.recorded',
            reference_id=str(instance.id),
            reference_type='payment',
            destination='distributors',
            metadata={"amount": str(instance.amount), "distributor_id": str(distributor.id)}
        )

        # 2. Notify Distributor
        notify_user(
            user=distributor,
            title="Payment Received",
            message=f"Payment of ₹{instance.amount:,.2f} credited to your ledger (Outstanding: ₹{instance.wallet.outstanding_amount:,.2f}).",
            type=NotificationType.PAYMENT,
            event_type='payment.recorded',
            reference_id=str(instance.id),
            reference_type='payment',
            destination='payments',
            metadata={"amount": str(instance.amount)}
        )


@receiver(post_save, sender=Product)
def product_availability_notification(sender, instance, created, **kwargs):
    """
    Product inventory warnings disabled per Availability-Based Workflow rules.
    Admin controls availability explicitly via Available/Unavailable status.
    """
    pass


@receiver(post_save, sender=Expense)
def expense_status_notification(sender, instance, created, **kwargs):
    """
    Notifies employee when expense claim is approved or rejected.
    """
    if kwargs.get('raw', False) or created:
        return

    if instance.status in [ExpenseStatus.APPROVED, ExpenseStatus.REJECTED]:
        notify_user(
            user=instance.employee,
            title=f"Expense Claim {instance.status}",
            message=f"Your expense claim of ₹{instance.amount:,.2f} for {instance.category} was {instance.status.lower()} by Admin.",
            type=NotificationType.EXPENSE,
            event_type=f'expense.{instance.status.lower()}',
            reference_id=str(instance.id),
            reference_type='expense',
            destination='expenses'
        )
