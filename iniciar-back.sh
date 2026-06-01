#!/bin/bash
APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/amellify-common.sh
source "$APP_DIR/scripts/amellify-common.sh"

echo ""
echo "Amellify — backend (primer plano)"
echo ""

ensure_node || exit 1
ensure_deps || exit 1

if is_server_running; then
  echo "Ya hay un servidor activo (PID $(server_pid)). Detenlo con ./detener-web.sh"
  exit 1
fi

amellify_set_display_host
amellify_print_urls
echo ""
echo "Ctrl+C para detener"
echo ""

start_server_foreground
