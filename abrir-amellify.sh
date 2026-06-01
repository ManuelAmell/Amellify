#!/bin/bash
APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/amellify-common.sh
source "$APP_DIR/scripts/amellify-common.sh"

ensure_node || exit 1
ensure_deps || exit 1

if has_graphical_session && has_electron; then
  echo "Iniciando Amellify (Electron)..."
  cd "$APP_DIR" || exit 1
  exec npm start
fi

echo "Iniciando modo web..."
if ! is_server_running; then
  start_server_background || exit 1
fi

amellify_set_display_host
URL="$(amellify_local_url)"
open_browser "$URL"
echo ""
amellify_print_urls
echo "Log: tail -f $LOG_FILE"
