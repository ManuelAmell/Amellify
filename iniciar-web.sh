#!/bin/bash

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HOST_IP="${HOST:-100.101.28.97}"

echo ""
echo "╔══════════════════════════════════════╗"
echo "║  📚 Amellify                        ║"
echo "╚══════════════════════════════════════╝"
echo ""

echo "🔍 Verificando dependencias..."

if [ ! -d "$APP_DIR/node_modules" ]; then
    echo "📦 Instalando dependencias..."
    cd "$APP_DIR" || exit 1
    npm install
fi

if pgrep -f "node server.js" > /dev/null; then
    echo ""
    echo "⚠️  Amellify ya está corriendo"
    echo ""
    echo "   → http://localhost:3000"
    echo "   → http://$HOST_IP:3000"
    echo ""
    echo "🛑 Detener: ./detener-web.sh"
    exit 0
fi

echo ""
echo "🚀 Iniciando servidor..."
echo ""

cd "$APP_DIR" || exit 1

echo "╔══════════════════════════════════════════╗"
echo "║  ✅ Servidor iniciado                    ║"
echo "║                                          ║"
echo "║  🌐 Acceso desde cualquier dispositivo   ║"
echo "║                                          ║"
echo "║  → http://$HOST_IP:3000                  ║"
echo "║                                          ║"
echo "║  🔌 WebSocket: activo                    ║"
echo "║  🗄️  DB: SQLite (amellify.db)            ║"
echo "╚══════════════════════════════════════════╝"
echo ""

exec node server.js
