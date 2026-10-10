#!/usr/bin/env bash
# ==============================================================================
# CCS CONNECT ERP — PRODUCTION AUTOMATED BACKUP RUNNER (Linux VPS)
# ==============================================================================
# Scheduled via Crontab (e.g. 02:00 AM IST daily)
# Runs as unprivileged deployment user with restricted file permissions (umask 077)
# ==============================================================================
set -euo pipefail
umask 077

PROJECT_ROOT="/var/www/ccs-connect"
BACKUP_DIR="${PROJECT_ROOT}/backend/backups"
LOG_FILE="/var/log/ccs_backup.log"

export DJANGO_SETTINGS_MODULE="ccs_backend.settings"

mkdir -p "${BACKUP_DIR}"
mkdir -p "$(dirname "${LOG_FILE}")"

# Invoke Python backup orchestrator within virtual environment
if [ -f "${PROJECT_ROOT}/backend/venv/bin/python" ]; then
    PYTHON_BIN="${PROJECT_ROOT}/backend/venv/bin/python"
else
    PYTHON_BIN="python3"
fi

echo "[$(date -u +"%Y-%m-%d %H:%M:%SZ")] Executing CCS Connect production backup orchestrator..." >> "${LOG_FILE}"

"${PYTHON_BIN}" "${PROJECT_ROOT}/scripts/ccs_backup_orchestrator.py" >> "${LOG_FILE}" 2>&1

EXIT_CODE=$?
if [ ${EXIT_CODE} -ne 0 ]; then
    echo "[$(date -u +"%Y-%m-%d %H:%M:%SZ")] [ERROR] Backup execution failed with exit code ${EXIT_CODE}" >> "${LOG_FILE}"
    # Optional alert hook (e.g. email or webhook) can be placed here
    exit ${EXIT_CODE}
fi

echo "[$(date -u +"%Y-%m-%d %H:%M:%SZ")] [SUCCESS] Backup execution succeeded." >> "${LOG_FILE}"
exit 0
