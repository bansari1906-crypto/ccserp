# CCS CONNECT ERP — PRODUCTION DISASTER RECOVERY RUNBOOK
**Document Version:** 1.0  
**Target Environment:** Hostinger KVM Linux VPS / Ubuntu 24.04 or 22.04 LTS  
**Target Domain:** `chitracropsciencepartners.com`  
**RTO (Recovery Time Objective):** < 30 Minutes  
**RPO (Recovery Point Objective):** < 24 Hours (Daily Automated Snapshot)

---

## 1. Overview & Disaster Scenarios

This runbook provides step-by-step procedures to recover CCS Connect ERP from:
- Total VPS hardware/hypervisor failure or operating system crash.
- Accidental catastrophic data deletion or database corruption.
- Compromised server security requiring clean rebuild on a fresh instance.
- Development or deployment mistake.

---

## 2. Prerequisites & Backup Artifacts

Every restore requires two artifacts from the latest backup set (stored off-server):
1. **PostgreSQL Dump**: `ccs_db_<YYYYMMDD_HHMMSS>.dump` (Custom binary format)
2. **Media Archive**: `ccs_media_<YYYYMMDD_HHMMSS>.tar.gz` (Attendance photos, Bilty PDFs, LR scans)
3. **Cryptographic Manifest**: `ccs_manifest_<YYYYMMDD_HHMMSS>.json` (Contains SHA-256 hashes and table record counts)

---

## 3. Step-by-Step Restoration Procedure

### Step 1: Provision Replacement Server
1. In Hostinger hPanel, provision a **KVM 1 VPS** running **Ubuntu 24.04 LTS** (or 22.04 LTS).
2. Note the new public IPv4 address (e.g. `195.xxx.xxx.xxx`).
3. Connect via SSH:
   ```bash
   ssh root@<NEW_SERVER_IP>
   ```

### Step 2: System Update & Core Dependencies Installation
Run system update and install required services:
```bash
apt-get update && apt-get upgrade -y
apt-get install -y postgresql-16 redis-server nginx python3-venv python3-pip git certbot python3-certbot-nginx curl ufw
```

Configure firewall:
```bash
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable
```

### Step 3: Database Initialization
1. Switch to the `postgres` system user and create the database and user:
   ```bash
   su - postgres -c "psql"
   ```
   Execute within `psql`:
   ```sql
   CREATE DATABASE ccs;
   CREATE USER ccs_user WITH ENCRYPTED PASSWORD 'GENERATE_STRONG_RANDOM_PASSWORD_HERE';
   GRANT ALL PRIVILEGES ON DATABASE ccs TO ccs_user;
   ALTER DATABASE ccs OWNER TO ccs_user;
   \q
   ```

2. Enable PostgreSQL and Redis:
   ```bash
   systemctl enable --now postgresql
   systemctl enable --now redis-server
   ```

### Step 4: Clone Codebase & Setup Virtual Environment
```bash
mkdir -p /var/www/ccs-connect
cd /var/www/ccs-connect

# Clone or transfer project code (excluding development secrets)
# Create Python virtual environment
python3 -m venv backend/venv
source backend/venv/bin/activate
pip install --upgrade pip
pip install -r backend/requirements.txt
```

### Step 5: Restore PostgreSQL Database
1. Copy the backup file `ccs_db_<TIMESTAMP>.dump` to `/tmp/ccs_restore.dump`.
2. Verify its SHA-256 hash against `ccs_manifest_<TIMESTAMP>.json`:
   ```bash
   sha256sum /tmp/ccs_restore.dump
   ```
3. Run `pg_restore`:
   ```bash
   PGPASSWORD='YOUR_DB_PASSWORD' pg_restore -h 127.0.0.1 -p 5432 -U ccs_user -d ccs --no-owner -v /tmp/ccs_restore.dump
   ```
4. Verify table counts match the manifest:
   ```bash
   python3 -c "
   import os, django; os.environ['DJANGO_SETTINGS_MODULE'] = 'ccs_backend.settings'; django.setup()
   from apps.accounts.models import User
   from apps.products.models import Product
   from apps.orders.models import Order
   print(f'Users: {User.objects.count()}, Products: {Product.objects.count()}, Orders: {Order.objects.count()}')
   "
   ```

### Step 6: Restore Media & Uploaded Documents
1. Extract media archive to the project media path:
   ```bash
   mkdir -p /var/www/ccs-connect/backend/media
   tar -xzf /tmp/ccs_media_<TIMESTAMP>.tar.gz -C /var/www/ccs-connect/backend/media --strip-components=1
   chown -R www-data:www-data /var/www/ccs-connect/backend/media
   chmod -R 755 /var/www/ccs-connect/backend/media
   ```

### Step 7: Secure Production Configuration
1. Create `/var/www/ccs-connect/backend/.env`:
   ```ini
   DJANGO_DEBUG=0
   DJANGO_SECRET_KEY=GENERATE_NEW_64_CHAR_KEY_NEVER_REUSE_DEV_KEY
   DATABASE_URL=postgresql://ccs_user:YOUR_DB_PASSWORD@127.0.0.1:5432/ccs
   REDIS_URL=redis://127.0.0.1:6379/0
   DJANGO_ALLOWED_HOSTS=chitracropsciencepartners.com,www.chitracropsciencepartners.com
   ```
2. Restrict `.env` permissions:
   ```bash
   chmod 600 /var/www/ccs-connect/backend/.env
   chown www-data:www-data /var/www/ccs-connect/backend/.env
   ```
3. Collect static files:
   ```bash
   python manage.py collectstatic --noinput
   ```

### Step 8: Configure Systemd Daemons & Nginx
1. Install Daphne service:
   ```bash
   cp deploy/systemd/ccs_daphne.service /etc/systemd/system/
   systemctl daemon-reload
   systemctl enable --now ccs_daphne
   ```
2. Install Start Day Reminder timer:
   ```bash
   cp deploy/systemd/ccs_attendance_reminder.service /etc/systemd/system/
   cp deploy/systemd/ccs_attendance_reminder.timer /etc/systemd/system/
   systemctl enable --now ccs_attendance_reminder.timer
   ```
3. Install Nginx configuration:
   ```bash
   cp deploy/nginx/ccs_connect.conf /etc/nginx/sites-available/
   ln -s /etc/nginx/sites-available/ccs_connect.conf /etc/nginx/sites-enabled/
   rm -f /etc/nginx/sites-enabled/default
   nginx -t
   systemctl reload nginx
   ```
4. Issue Let's Encrypt SSL certificate:
   ```bash
   certbot --nginx -d chitracropsciencepartners.com -d www.chitracropsciencepartners.com --non-interactive --agree-tos -m admin@chitracropscience.com
   ```

### Step 9: Re-point DNS
In Hostinger DNS Management for `chitracropsciencepartners.com`:
- Update `A` record `@` to point to `<NEW_SERVER_IP>`.
- Update `A` record `www` to point to `<NEW_SERVER_IP>`.
- TTL: 300 seconds (5 minutes).

### Step 10: Post-Restoration Verification & Health Check
Verify all services outside the local network:
1. `curl -I https://chitracropsciencepartners.com/api/products/` returns `401 Unauthorized` or valid API response (not 200 HTML).
2. Admin login works with verified credentials.
3. Attendance check-in with GPS and photo upload functions properly.
4. Product availability toggle and order approval succeed.
5. Real-time WebSocket connection establishes at `wss://chitracropsciencepartners.com/ws/events/`.

---

## 4. Scheduled Backup & Retention Policy

| Schedule | Job Description | Retention Policy | Storage Destination |
| :--- | :--- | :--- | :--- |
| **Daily at 02:00 AM IST** | Full DB binary dump (`.dump`) + Plain SQL + Compressed Media archive (`.tar.gz`) | Keep last **7 daily backups** | Primary: `/var/www/ccs-connect/backend/backups/`<br>Off-server: Cloud Storage / Secure Replica |
| **Weekly on Sunday 03:00 AM IST** | Weekly archive baseline snapshot | Keep last **4 weekly backups** | Off-server cold storage archive |

---

## 5. Failure Notification & Monitoring

- Backup logs are appended to `/var/log/ccs_backup.log`.
- Pre-execution disk space check prevents out-of-space failures.
- Non-zero exit code triggers operational alert notification.
- Automated quarterly non-destructive restore drill into `ccs_dr_test_isolated` ensures zero bit-rot.
