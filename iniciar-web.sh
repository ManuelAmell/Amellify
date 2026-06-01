#!/bin/bash
APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/amellify-common.sh
source "$APP_DIR/scripts/amellify-common.sh"

FOREGROUND=0
for arg in "$@"; do
  case "$arg" in
    -f|--foreground) FOREGROUND=1 ;;
  esac
done

echo ""
echo "Amellify — servidor web"
echo ""

ensure_node || exit 1
ensure_deps || exit 1

if is_server_running; then
  echo "Amellify ya esta corriendo (PID $(server_pid))"
  amellify_print_urls
  echo ""
  echo "Detener: ./detener-web.sh"
  exit 0
fi

amellify_set_display_host

if [ "$FOREGROUND" -eq 1 ]; then
  echo "Modo primer plano (Ctrl+C para detener)"
  echo ""
  amellify_print_urls
  echo ""
  start_server_foreground
fi

echo "Iniciando en segundo plano..."
if start_server_background; then
  echo ""
  echo "Servidor iniciado (PID $(cat "$PID_FILE"))"
  echo "Log: tail -f $LOG_FILE"
  echo ""
  amellify_print_urls
  echo ""
  echo "Detener: ./detener-web.sh"
else
  exit 1
fi
