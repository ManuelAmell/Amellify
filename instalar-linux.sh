#!/bin/bash
# ──────────────────────────────────────────────────────────────────────────────
#  Amellify — Instalador para Linux
# ──────────────────────────────────────────────────────────────────────────────
clear
APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Colores
RED='\033[0;31m'; GREEN='\033[0;32m'; BLUE='\033[0;34m'
CYAN='\033[0;36m'; YELLOW='\033[1;33m'; BOLD='\033[1m'; NC='\033[0m'

echo ""
echo -e "${BLUE}${BOLD}"
echo "  ┌─────────────────────────────────────────┐"
echo "  │                                         │"
echo "  │         📚  AMELLIFY  v1.0              │"
echo "  │    Gestor de Horarios Universitarios    │"
echo "  │                                         │"
echo "  └─────────────────────────────────────────┘"
echo -e "${NC}"
echo -e "  Bienvenido al instalador de ${BOLD}Amellify${NC}."
echo "  Este proceso tomará unos minutos la primera vez."
echo ""

# ── Paso 1: Verificar Node.js ─────────────────────────────────────────────────
echo -e "${CYAN}[1/4]${NC} Verificando Node.js..."
if ! command -v node &> /dev/null; then
    echo -e "  ${RED}✗${NC} Node.js no encontrado."
    echo ""
    echo -e "  ${YELLOW}Instálalo con uno de estos comandos:${NC}"
    echo "    Arch/Manjaro:   sudo pacman -S nodejs npm"
    echo "    Ubuntu/Debian:  sudo apt install nodejs npm"
    echo "    Fedora:         sudo dnf install nodejs npm"
    echo ""
    echo "  O descárgalo desde: https://nodejs.org"
    echo ""
    read -p "  Presiona Enter para salir..." ; exit 1
fi
NODE_VER=$(node --version)
echo -e "  ${GREEN}✓${NC} Node.js $NODE_VER instalado"

# ── Paso 2: Instalar dependencias ─────────────────────────────────────────────
echo ""
echo -e "${CYAN}[2/4]${NC} Instalando dependencias..."
if [ ! -d "$APP_DIR/node_modules/electron" ]; then
    echo "  Descargando Electron (~150MB, solo esta vez)..."
    cd "$APP_DIR" && npm install --progress=false 2>&1 | grep -E "added|warn|error" | head -5
    if [ $? -ne 0 ]; then
        echo -e "  ${RED}✗${NC} Error al instalar. Verifica tu conexión a internet."
        read -p "  Presiona Enter para salir..." ; exit 1
    fi
    echo -e "  ${GREEN}✓${NC} Dependencias instaladas"
else
    echo -e "  ${GREEN}✓${NC} Dependencias ya instaladas"
fi

# ── Paso 3: Instalar íconos y .desktop ───────────────────────────────────────
echo ""
echo -e "${CYAN}[3/4]${NC} Registrando la aplicación en el sistema..."

ICON_DEST="$HOME/.local/share/icons/hicolor/512x512/apps/amellify.png"
DESKTOP_FILE="$HOME/.local/share/applications/amellify.desktop"

mkdir -p "$HOME/.local/share/icons/hicolor/512x512/apps"
mkdir -p "$HOME/.local/share/applications"

[ -f "$APP_DIR/build/icon.png" ] && cp "$APP_DIR/build/icon.png" "$ICON_DEST"

cat > "$DESKTOP_FILE" << DESKTOP
[Desktop Entry]
Version=1.0
Type=Application
Name=Amellify
GenericName=Gestor de Horarios
Comment=Gestiona tus materias y horarios universitarios
Exec=bash -c "cd $APP_DIR && npx electron . 2>/dev/null" -- %u
Icon=$ICON_DEST
Terminal=false
StartupNotify=true
StartupWMClass=amellify
Categories=Education;Utility;
Keywords=universidad;horario;materias;clases;
MimeType=
DESKTOP

chmod +x "$DESKTOP_FILE"
chmod +x "$APP_DIR/instalar-linux.sh"
chmod +x "$APP_DIR/abrir-amellify.sh" 2>/dev/null

command -v update-desktop-database &>/dev/null && \
    update-desktop-database "$HOME/.local/share/applications" 2>/dev/null
command -v gtk-update-icon-cache &>/dev/null && \
    gtk-update-icon-cache -f -t "$HOME/.local/share/icons/hicolor" 2>/dev/null

echo -e "  ${GREEN}✓${NC} Amellify registrada en el menú de aplicaciones"

# ── Paso 4: Acceso directo en escritorio ─────────────────────────────────────
echo ""
echo -e "${CYAN}[4/4]${NC} Configuración final..."

DESKTOP_PATH="$(xdg-user-dir DESKTOP 2>/dev/null || echo "$HOME/Escritorio")"
[ ! -d "$DESKTOP_PATH" ] && DESKTOP_PATH="$HOME/Desktop"

if [ -d "$DESKTOP_PATH" ]; then
    echo -ne "  ¿Crear acceso directo en el escritorio? [S/n]: "
    read RESP
    if [[ "$RESP" =~ ^[Nn]$ ]]; then
        echo -e "  ${YELLOW}—${NC} Omitido"
    else
        cp "$DESKTOP_FILE" "$DESKTOP_PATH/amellify.desktop"
        chmod +x "$DESKTOP_PATH/amellify.desktop"
        gio set "$DESKTOP_PATH/amellify.desktop" metadata::trusted true 2>/dev/null
        echo -e "  ${GREEN}✓${NC} Acceso directo creado en el escritorio"
    fi
fi

# ── Resumen ───────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}${BOLD}"
echo "  ┌─────────────────────────────────────────┐"
echo "  │   ✅  ¡Amellify instalada con éxito!    │"
echo "  └─────────────────────────────────────────┘"
echo -e "${NC}"
echo "  Puedes abrir Amellify desde:"
echo -e "  ${BOLD}•${NC} El menú de aplicaciones (busca 'Amellify')"
echo -e "  ${BOLD}•${NC} El acceso directo en el escritorio"
echo -e "  ${BOLD}•${NC} Ejecutando: ${CYAN}./abrir-amellify.sh${NC}"
echo ""
echo "  Tus datos se guardan en:"
echo -e "  ${CYAN}~/.config/amellify/amellify-data.json${NC}"
echo ""

echo ""
echo -e "  Puedes abrir Amellify desde:"
echo -e "  ${BOLD}•${NC} El menú de aplicaciones (busca 'Amellify')"
echo -e "  ${BOLD}•${NC} El acceso directo en el escritorio"
echo -e "  ${BOLD}•${NC} Ejecutando: ${CYAN}./iniciar-web.sh${NC} (modo web)"
echo -e "  ${BOLD}•${NC} Ejecutando: ${CYAN}./iniciar-back.sh${NC} (backend)"
echo ""
echo -e "  Para acceso desde otros dispositivos:"
echo -e "  ${CYAN}http://100.101.28.97:3000${NC}"
echo ""

read -p "  ¿Iniciar el servidor ahora? [S/n]: " OPEN_NOW
if [[ ! "$OPEN_NOW" =~ ^[Nn]$ ]]; then
    echo ""
    echo -e "  ${GREEN}Iniciando servidor...${NC}"
    cd "$APP_DIR" && ./iniciar-web.sh &
fi
echo ""
