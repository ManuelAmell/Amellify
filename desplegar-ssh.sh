#!/bin/bash
# Despliega Amellify en un host remoto via SSH (rsync + npm + systemd user)
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/amellify-common.sh
source "$APP_DIR/scripts/amellify-common.sh"

REMOTE=""
REMOTE_PATH="~/amellify"
PORT="${PORT:-3000}"
DRY_RUN=0
WITH_DB=0
RESTART_ONLY=0

usage() {
  cat <<EOF
Uso: ./desplegar-ssh.sh usuario@host [ruta-remota] [opciones]

Opciones:
  --dry-run       Solo muestra lo que haria rsync/ssh
  --with-db       Copia amellify.db al remoto
  --port N        Puerto del servidor (default: 3000)
  --restart-only  Reinicia servicio sin sincronizar archivos

Ejemplo:
  ./desplegar-ssh.sh pi@192.168.1.50 ~/apps/amellify
  npm run deploy:ssh -- usuario@servidor

Remoto: systemd user (amellify.service) o nohup si no hay systemd.
EOF
}

while [ $# -gt 0 ]; do
  case "$1" in
    -h|--help) usage; exit 0 ;;
    --dry-run) DRY_RUN=1 ;;
    --with-db) WITH_DB=1 ;;
    --restart-only) RESTART_ONLY=1 ;;
    --port)
      PORT="$2"
      shift
      ;;
    *)
      if [ -z "$REMOTE" ]; then
        REMOTE="$1"
      elif [[ "$1" != --* ]]; then
        REMOTE_PATH="$1"
      fi
      ;;
  esac
  shift
done

if [ -z "$REMOTE" ]; then
  usage
  exit 1
fi

command -v ssh >/dev/null 2>&1 || { echo "Error: ssh no instalado"; exit 1; }
command -v rsync >/dev/null 2>&1 || { echo "Error: rsync no instalado"; exit 1; }

RSYNC_OPTS=(-avz --delete
  --exclude node_modules
  --exclude .git
  --exclude backups
  --exclude 'tests/e2e-screenshots'
  --exclude 'tests/e2e-*.db'
  --exclude .env
  --exclude 'CREDENCIALES-ADMIN-DEV.txt'
)

if [ "$WITH_DB" -eq 0 ]; then
  RSYNC_OPTS+=(--exclude amellify.db)
fi

if [ "$DRY_RUN" -eq 1 ]; then
  RSYNC_OPTS+=(--dry-run)
fi

echo "Destino: $REMOTE:$REMOTE_PATH (puerto $PORT)"

if [ "$RESTART_ONLY" -eq 0 ]; then
  echo "Sincronizando archivos..."
  rsync "${RSYNC_OPTS[@]}" "$APP_DIR/" "$REMOTE:$REMOTE_PATH/"
fi

REMOTE_SCRIPT=$(cat <<'REMOTE_EOF'
set -e
APP_DIR="$1"
PORT="$2"
NODE_BIN="$(command -v node)"
SYSTEMD_USER_DIR="$HOME/.config/systemd/user"
SERVICE_NAME="amellify.service"

cd "$APP_DIR"

NODE_MAJOR="$("$NODE_BIN" -e "console.log(parseInt(process.versions.node.split('.')[0],10))")"
if [ "$NODE_MAJOR" -lt 18 ]; then
  echo "Error remoto: Node 18+ requerido"
  exit 1
fi

if [ -f package-lock.json ]; then
  npm ci --ignore-scripts 2>/dev/null || npm install --ignore-scripts
else
  npm install --ignore-scripts
fi

if [ ! -f .env ] && [ -f .env.example ]; then
  cp .env.example .env
  echo "AVISO: editar .env en el servidor (AMELLIFY_JWT_SECRET, etc.)"
fi

NODE_PATH="$NODE_BIN"
APP_ESC="$APP_DIR"
PORT_ESC="$PORT"

install_systemd() {
  mkdir -p "$SYSTEMD_USER_DIR"
  sed -e "s|@APP_DIR@|$APP_ESC|g" \
      -e "s|@PORT@|$PORT_ESC|g" \
      -e "s|@NODE@|$NODE_PATH|g" \
      "$APP_DIR/scripts/amellify.service.template" > "$SYSTEMD_USER_DIR/$SERVICE_NAME"
  systemctl --user daemon-reload
  systemctl --user enable "$SERVICE_NAME"
  systemctl --user restart "$SERVICE_NAME"
  echo "systemd: systemctl --user status amellify"
}

start_nohup() {
  pkill -f "node server.js" 2>/dev/null || true
  export HOST=0.0.0.0
  export PORT="$PORT_ESC"
  nohup "$NODE_PATH" server.js >>/tmp/amellify.log 2>&1 &
  echo $! >/tmp/amellify.pid
  echo "nohup: PID $(cat /tmp/amellify.pid), log /tmp/amellify.log"
}

if command -v systemctl >/dev/null 2>&1 && systemctl --user show-environment >/dev/null 2>&1; then
  install_systemd
else
  echo "systemd user no disponible, usando nohup"
  start_nohup
fi

LAN_IP="$(hostname -I 2>/dev/null | awk '{print $1}')"
[ -z "$LAN_IP" ] && LAN_IP="localhost"
echo "URLs: http://127.0.0.1:$PORT_ESC  http://${LAN_IP}:$PORT_ESC"
REMOTE_EOF
)

if [ "$DRY_RUN" -eq 1 ]; then
  echo "[dry-run] Omitiendo instalacion remota"
  exit 0
fi

echo "Configurando servicio remoto..."
ssh "$REMOTE" "bash -s" -- "$REMOTE_PATH" "$PORT" <<<"$REMOTE_SCRIPT"

echo ""
echo "Despliegue completado."
echo "  ssh $REMOTE 'systemctl --user status amellify'  # si usa systemd"
echo "  ssh $REMOTE 'tail -f /tmp/amellify.log'         # logs nohup"
LAN="$(ssh "$REMOTE" "hostname -I 2>/dev/null | awk '{print \$1}'" 2>/dev/null || echo "host")"
echo "  http://${LAN}:${PORT}"
