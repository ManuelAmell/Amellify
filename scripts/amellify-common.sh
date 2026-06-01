# Amellify — funciones compartidas para scripts shell
# Uso: source "$(dirname "$0")/scripts/amellify-common.sh"  (desde raíz del repo)

# APP_DIR: raíz del proyecto (definir antes de source o detectar desde caller)
if [ -z "${APP_DIR:-}" ]; then
  _COMMON_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  APP_DIR="$(cd "$_COMMON_DIR/.." && pwd)"
fi

export PORT="${PORT:-3000}"
export HOST="${HOST:-0.0.0.0}"
export DISPLAY_HOST="${DISPLAY_HOST:-localhost}"

PID_FILE="/tmp/amellify.pid"
LOG_FILE="/tmp/amellify.log"

amellify_lan_ip() {
  local ip=""
  if command -v hostname >/dev/null 2>&1; then
    ip="$(hostname -I 2>/dev/null | awk '{print $1}')"
  fi
  if [ -z "$ip" ] && command -v ip >/dev/null 2>&1; then
    ip="$(ip -4 route get 1.1.1.1 2>/dev/null | awk '{for(i=1;i<=NF;i++) if($i=="src") print $(i+1)}')"
  fi
  if [ -z "$ip" ]; then
    ip="localhost"
  fi
  echo "$ip"
}

amellify_set_display_host() {
  DISPLAY_HOST="$(amellify_lan_ip)"
  export DISPLAY_HOST
}

amellify_local_url() {
  echo "http://127.0.0.1:${PORT}"
}

amellify_lan_url() {
  amellify_set_display_host
  echo "http://${DISPLAY_HOST}:${PORT}"
}

amellify_print_urls() {
  amellify_set_display_host
  echo "  Local:  $(amellify_local_url)"
  echo "  Red:    $(amellify_lan_url)"
  echo "  Admin:  admin@amellify.local / admin (desarrollo)"
}

ensure_node() {
  if ! command -v node >/dev/null 2>&1; then
    echo "Error: Node.js no encontrado. Instala Node 18+ desde https://nodejs.org"
    return 1
  fi
  local major
  major="$(node -e "console.log(parseInt(process.versions.node.split('.')[0],10))")"
  if [ "$major" -lt 18 ]; then
    echo "Error: se requiere Node.js 18 o superior (actual: $(node --version))"
    return 1
  fi
  return 0
}

ensure_deps() {
  if [ ! -d "$APP_DIR/node_modules" ]; then
    echo "Instalando dependencias..."
    (cd "$APP_DIR" && npm install) || return 1
  fi
  return 0
}

server_pid() {
  if [ -f "$PID_FILE" ]; then
    local pid
    pid="$(cat "$PID_FILE" 2>/dev/null)"
    if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
      echo "$pid"
      return 0
    fi
  fi
  pgrep -f "node server.js" 2>/dev/null | head -1
}

is_server_running() {
  local pid
  pid="$(server_pid)"
  [ -n "$pid" ]
}

stop_server_force() {
  local stopped=0
  if [ -f "$PID_FILE" ]; then
    local pid
    pid="$(cat "$PID_FILE" 2>/dev/null)"
    if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null
      sleep 1
      kill -9 "$pid" 2>/dev/null || true
      stopped=1
    fi
    rm -f "$PID_FILE"
  fi
  if pkill -f "node server.js" 2>/dev/null; then
    stopped=1
  fi
  if command -v fuser >/dev/null 2>&1; then
    fuser -k "${PORT}/tcp" 2>/dev/null && stopped=1 || true
  fi
  [ "$stopped" -eq 1 ]
}

start_server_background() {
  cd "$APP_DIR" || return 1
  export HOST
  export PORT
  export DISPLAY_HOST
  nohup node server.js >>"$LOG_FILE" 2>&1 &
  echo $! >"$PID_FILE"
  sleep 1
  if ! is_server_running; then
    echo "Error al iniciar. Ver: tail -20 $LOG_FILE"
    return 1
  fi
  return 0
}

start_server_foreground() {
  cd "$APP_DIR" || return 1
  export HOST
  export PORT
  export DISPLAY_HOST
  exec node server.js
}

has_graphical_session() {
  [ -n "${DISPLAY:-}" ] || [ -n "${WAYLAND_DISPLAY:-}" ]
}

has_electron() {
  [ -d "$APP_DIR/node_modules/electron" ]
}

open_browser() {
  local url="$1"
  if command -v xdg-open >/dev/null 2>&1; then
    xdg-open "$url" 2>/dev/null &
  elif command -v open >/dev/null 2>&1; then
    open "$url" 2>/dev/null &
  elif command -v wslview >/dev/null 2>&1; then
    wslview "$url" 2>/dev/null &
  else
    echo "Abre en el navegador: $url"
    return 1
  fi
  return 0
}

chmod_scripts() {
  chmod +x "$APP_DIR"/*.sh 2>/dev/null || true
  chmod +x "$APP_DIR"/scripts/*.sh 2>/dev/null || true
}
