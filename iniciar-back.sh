#!/bin/bash

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HOST_IP="${HOST:-100.101.28.97}"

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║  🚀 Amellify Backend                      ║"
echo "╠══════════════════════════════════════════╣"
echo "║  → http://$HOST_IP:3000              ║"
echo "║  → Ctrl+C para detener                   ║"
echo "╚══════════════════════════════════════════╝"
echo ""

cd "$APP_DIR"
exec node server.js