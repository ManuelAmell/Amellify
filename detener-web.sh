#!/bin/bash
APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/amellify-common.sh
source "$APP_DIR/scripts/amellify-common.sh"

CLEAN_LOG=0
for arg in "$@"; do
  case "$arg" in
    --clean-log) CLEAN_LOG=1 ;;
  esac
done

echo "Deteniendo Amellify..."

if stop_server_force; then
  echo "Servidor detenido"
else
  echo "El servidor no estaba en ejecucion"
fi

if [ "$CLEAN_LOG" -eq 1 ]; then
  rm -f "$LOG_FILE"
  echo "Log eliminado: $LOG_FILE"
fi
