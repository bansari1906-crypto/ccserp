from django.core.management.base import BaseCommand
from datetime import datetime
from apps.notifications.services import run_start_day_reminder_job

class Command(BaseCommand):
    help = 'Executes the scheduled 10:00 AM Asia/Kolkata Start Day attendance reminder job.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--date',
            type=str,
            help='Target date in YYYY-MM-DD format (defaults to today in Asia/Kolkata)'
        )
        parser.add_argument(
            '--force',
            action='store_true',
            help='Force execution even on non-working days (Sundays)'
        )

    def handle(self, *args, **options):
        date_str = options.get('date')
        force = options.get('force', False)
        target_date = None
        if date_str:
            try:
                target_date = datetime.strptime(date_str, '%Y-%m-%d').date()
            except ValueError:
                self.stderr.write(self.style.ERROR(f"Invalid date format '{date_str}'. Expected YYYY-MM-DD."))
                return

        result = run_start_day_reminder_job(target_date=target_date, force=force)
        self.stdout.write(self.style.SUCCESS(f"Start Day Reminder Job Result: {result}"))
