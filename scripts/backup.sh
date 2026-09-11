#!/bin/sh
set -e

# Configuration
PGHOST="${PGHOST:-db}"
PGPORT="${PGPORT:-5432}"
PGUSER="${PGUSER:-amellify}"
PGDATABASE="${PGDATABASE:-amellify}"
BACKUP_DIR="${BACKUP_DIR:-/backups}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"
CRON_SCHEDULE="${BACKUP_CRON:-0 3 * * *}"

mkdir -p "${BACKUP_DIR}"

run_backup() {
    TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
    BACKUP_FILE="${BACKUP_DIR}/amellify_${TIMESTAMP}.sql.gz"
    echo "[$(date -u +'%Y-%m-%d %H:%M:%S UTC')] Starting backup of database '${PGDATABASE}' from host '${PGHOST}'..."

    # Check postgres availability
    if command -v pg_isready >/dev/null 2>&1; then
        if ! pg_isready -h "${PGHOST}" -p "${PGPORT}" -U "${PGUSER}" -d "${PGDATABASE}" -q; then
            echo "[ERROR] Database is not ready. Aborting backup." >&2
            return 1
        fi
    fi

    # Perform dump with gzip
    if pg_dump -h "${PGHOST}" -p "${PGPORT}" -U "${PGUSER}" -d "${PGDATABASE}" --clean --if-exists --no-owner --no-privileges | gzip > "${BACKUP_FILE}"; then
        BACKUP_SIZE=$(ls -lh "${BACKUP_FILE}" | awk '{print $5}')
        echo "[$(date -u +'%Y-%m-%d %H:%M:%S UTC')] Backup created successfully: ${BACKUP_FILE} (${BACKUP_SIZE})"
    else
        echo "[ERROR] pg_dump failed!" >&2
        rm -f "${BACKUP_FILE}"
        return 1
    fi

    # Enforce retention policy (14 days by default)
    echo "[$(date -u +'%Y-%m-%d %H:%M:%S UTC')] Applying retention policy (deleting backups older than ${RETENTION_DAYS} days)..."
    find "${BACKUP_DIR}" -type f -name "amellify_*.sql.gz" -mtime "+${RETENTION_DAYS}" -exec echo "Removing expired backup: {}" \; -exec rm -f {} +
    echo "[$(date -u +'%Y-%m-%d %H:%M:%S UTC')] Retention cleanup complete."
}

if [ "$1" = "--daemon" ]; then
    echo "=== Amellify Backup Daemon Started ==="
    echo "Host: ${PGHOST}:${PGPORT} | Database: ${PGDATABASE} | Retention: ${RETENTION_DAYS} days"
    echo "Cron Schedule: ${CRON_SCHEDULE}"

    # Wait for database to be ready before starting
    if command -v pg_isready >/dev/null 2>&1; then
        echo "Waiting for database to be ready..."
        until pg_isready -h "${PGHOST}" -p "${PGPORT}" -U "${PGUSER}" -d "${PGDATABASE}" -q; do
            sleep 2
        done
        echo "Database is ready."
    fi

    # Perform initial backup on container startup
    run_backup || echo "[WARNING] Initial backup failed, will retry on scheduled cron."

    # Setup crontab
    CRON_TAB_FILE="/tmp/crontab.txt"
    echo "${CRON_SCHEDULE} /bin/sh /scripts/backup.sh --now >> /var/log/cron-backup.log 2>&1" > "${CRON_TAB_FILE}"
    crontab "${CRON_TAB_FILE}"
    rm -f "${CRON_TAB_FILE}"

    touch /var/log/cron-backup.log
    echo "Starting crond in foreground..."
    exec crond -f -l 2
else
    # One-shot execution
    run_backup
fi
