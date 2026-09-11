#!/bin/sh
set -e

# ==============================================================================
# Amellify - Database Restore Script
# Safely restores a pg_dump file (.sql or .sql.gz) into PostgreSQL.
#
# Usage:
#   ./scripts/restore.sh [options] <backup_file>
#
# Options:
#   -y, --yes      Skip interactive confirmation prompt (for automation/CI)
#   -h, --help     Show this help message
#
# Environment variables:
#   PGHOST         PostgreSQL host (default: localhost or 'db' inside docker)
#   PGPORT         PostgreSQL port (default: 5432)
#   PGUSER         PostgreSQL user (default: amellify)
#   PGPASSWORD     PostgreSQL password (default: amellify)
#   PGDATABASE     Target database name (default: amellify)
# ==============================================================================

AUTO_CONFIRM=0
BACKUP_FILE=""

# Parse arguments
while [ $# -gt 0 ]; do
    case "$1" in
        -y|--yes)
            AUTO_CONFIRM=1
            shift
            ;;
        -h|--help)
            echo "Usage: $0 [-y|--yes] <backup_file.sql.gz | backup_file.sql>"
            exit 0
            ;;
        *)
            if [ -z "$BACKUP_FILE" ]; then
                BACKUP_FILE="$1"
            else
                echo "[ERROR] Unexpected argument: $1" >&2
                exit 1
            fi
            shift
            ;;
    esac
done

if [ -z "$BACKUP_FILE" ]; then
    echo "[ERROR] No backup file specified." >&2
    echo "Usage: $0 [-y|--yes] <path_to_backup_file>" >&2
    exit 1
fi

if [ ! -f "$BACKUP_FILE" ]; then
    echo "[ERROR] File '$BACKUP_FILE' does not exist." >&2
    exit 1
fi

PGHOST="${PGHOST:-db}"
PGPORT="${PGPORT:-5432}"
PGUSER="${PGUSER:-amellify}"
PGDATABASE="${PGDATABASE:-amellify}"

echo "=================================================="
echo " Amellify Database Restore"
echo "=================================================="
echo " Target Host:     ${PGHOST}:${PGPORT}"
echo " Target Database: ${PGDATABASE}"
echo " Database User:   ${PGUSER}"
echo " Backup File:     ${BACKUP_FILE}"
echo " File Size:       $(ls -lh "$BACKUP_FILE" | awk '{print $5}')"
echo "=================================================="

# Check postgres availability
if command -v pg_isready >/dev/null 2>&1; then
    echo "Checking PostgreSQL connection..."
    if ! pg_isready -h "${PGHOST}" -p "${PGPORT}" -U "${PGUSER}" -d "${PGDATABASE}" -q; then
        echo "[ERROR] Target database is not reachable at ${PGHOST}:${PGPORT}." >&2
        exit 1
    fi
    echo "Connection verified."
fi

# Confirmation prompt if interactive
if [ "$AUTO_CONFIRM" -ne 1 ]; then
    printf "\nWARNING: This will overwrite tables in '%s' on %s.\nAre you sure you want to proceed? (yes/NO): " "$PGDATABASE" "$PGHOST"
    read -r CONFIRMATION
    if [ "$CONFIRMATION" != "yes" ] && [ "$CONFIRMATION" != "y" ] && [ "$CONFIRMATION" != "YES" ]; then
        echo "Restore cancelled by user."
        exit 0
    fi
fi

echo "[$(date -u +'%Y-%m-%d %H:%M:%S UTC')] Starting restore..."

# Detect format and stream to psql
case "$BACKUP_FILE" in
    *.gz)
        if command -v gzip >/dev/null 2>&1; then
            gzip -dc "$BACKUP_FILE" | psql -h "${PGHOST}" -p "${PGPORT}" -U "${PGUSER}" -d "${PGDATABASE}" -v ON_ERROR_STOP=1
        else
            echo "[ERROR] 'gzip' utility is required to decompress $BACKUP_FILE" >&2
            exit 1
        fi
        ;;
    *.sql)
        psql -h "${PGHOST}" -p "${PGPORT}" -U "${PGUSER}" -d "${PGDATABASE}" -v ON_ERROR_STOP=1 -f "$BACKUP_FILE"
        ;;
    *)
        echo "[ERROR] Unsupported file extension. Expected .sql or .sql.gz" >&2
        exit 1
        ;;
esac

echo "[$(date -u +'%Y-%m-%d %H:%M:%S UTC')] Database restored successfully from ${BACKUP_FILE}!"
