#!/bin/bash
# ──────────────────────────────────────────────────────────────────────────────
#  Amellify — Instalador para macOS
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
echo "  Bienvenido al instalador para macOS."
echo ""

# ── Paso 1: Verificar Node.js ─────────────────────────────────────────────────
echo -e "${CYAN}[1/4]${NC} Verificando Node.js..."
if ! command -v node &> /dev/null; then
    echo -e "  ${RED}✗${NC} Node.js no encontrado."
    echo ""
    echo -e "  ${YELLOW}Opciones para instalarlo:${NC}"
    echo ""
    echo "  Opción A — Homebrew (recomendado):"
    echo "    brew install node"
    echo ""
    echo "  Opción B — Descarga directa:"
    echo "    https://nodejs.org  (versión LTS)"
    echo ""
    read -p "  ¿Abrir nodejs.org en el navegador? [s/N]: " OPEN_NODE
    [[ "$OPEN_NODE" =~ ^[Ss]$ ]] && open "https://nodejs.org"
    echo ""
    read -p "  Presiona Enter para salir..." ; exit 1
fi
echo -e "  ${GREEN}✓${NC} Node.js $(node --version) instalado"

# ── Paso 2: Instalar dependencias ─────────────────────────────────────────────
echo ""
echo -e "${CYAN}[2/4]${NC} Instalando dependencias..."
if [ ! -d "$APP_DIR/node_modules/electron" ]; then
    echo "  Descargando Electron (~150MB, solo esta vez)..."
    cd "$APP_DIR" && npm install --progress=false 2>&1 | grep -E "added|error" | head -3
    if [ $? -ne 0 ]; then
        echo -e "  ${RED}✗${NC} Error al instalar. Verifica tu conexión a internet."
        read -p "  Presiona Enter para salir..." ; exit 1
    fi
    echo -e "  ${GREEN}✓${NC} Dependencias instaladas"
else
    echo -e "  ${GREEN}✓${NC} Dependencias ya instaladas"
fi

# ── Paso 3: Crear app en /Applications ───────────────────────────────────────
echo ""
echo -e "${CYAN}[3/4]${NC} Integrando con macOS..."

# Crear wrapper script que launch Electron
LAUNCHER="$APP_DIR/abrir-amellify.sh"
cat > "$LAUNCHER" << LAUNCHER_EOF
#!/bin/bash
cd "$APP_DIR"
exec npx electron . 2>/dev/null
LAUNCHER_EOF
chmod +x "$LAUNCHER"

# Crear un .app bundle en /Applications (opcional pero pro)
APP_BUNDLE="/Applications/Amellify.app"
APP_BUNDLE_USER="$HOME/Applications/Amellify.app"

create_app_bundle() {
    local BUNDLE="$1"
    mkdir -p "$BUNDLE/Contents/MacOS"
    mkdir -p "$BUNDLE/Contents/Resources"
    
    # Copy icon
    [ -f "$APP_DIR/build/icon.icns" ] && cp "$APP_DIR/build/icon.icns" "$BUNDLE/Contents/Resources/amellify.icns"

    # Info.plist
    cat > "$BUNDLE/Contents/Info.plist" << PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleIdentifier</key>    <string>com.amellify.app</string>
    <key>CFBundleName</key>          <string>Amellify</string>
    <key>CFBundleDisplayName</key>   <string>Amellify</string>
    <key>CFBundleVersion</key>       <string>1.0.0</string>
    <key>CFBundleIconFile</key>      <string>amellify</string>
    <key>CFBundleExecutable</key>    <string>amellify-launcher</string>
    <key>CFBundlePackageType</key>   <string>APPL</string>
    <key>NSHighResolutionCapable</key> <true/>
    <key>NSRequiresAquaSystemAppearance</key> <false/>
    <key>LSApplicationCategoryType</key> <string>public.app-category.education</string>
</dict>
</plist>
PLIST

    # Launcher executable inside .app
    cat > "$BUNDLE/Contents/MacOS/amellify-launcher" << APP_EXEC
#!/bin/bash
cd "$APP_DIR"
exec "$(which npx)" electron . 2>/dev/null
APP_EXEC
    chmod +x "$BUNDLE/Contents/MacOS/amellify-launcher"
}

# Try /Applications first, fall back to ~/Applications
if [ -w "/Applications" ] || sudo -n true 2>/dev/null; then
    echo -ne "  ¿Instalar en /Applications (para todos los usuarios)? [S/n]: "
    read GLOBAL_INSTALL
    if [[ ! "$GLOBAL_INSTALL" =~ ^[Nn]$ ]]; then
        create_app_bundle "$APP_BUNDLE"
        echo -e "  ${GREEN}✓${NC} Amellify.app creada en /Applications"
    else
        mkdir -p "$HOME/Applications"
        create_app_bundle "$APP_BUNDLE_USER"
        echo -e "  ${GREEN}✓${NC} Amellify.app creada en ~/Applications"
    fi
else
    mkdir -p "$HOME/Applications"
    create_app_bundle "$APP_BUNDLE_USER"
    echo -e "  ${GREEN}✓${NC} Amellify.app creada en ~/Applications"
fi

# ── Paso 4: Dock (opcional) ───────────────────────────────────────────────────
echo ""
echo -e "${CYAN}[4/4]${NC} Configuración final..."

# Registrar para que se vea en Spotlight
mdimport "$HOME/Applications/Amellify.app" 2>/dev/null
mdimport "/Applications/Amellify.app" 2>/dev/null

echo -e "  ${GREEN}✓${NC} App registrada en Spotlight"

# ── Resumen ───────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}${BOLD}"
echo "  ┌─────────────────────────────────────────┐"
echo "  │   ✅  ¡Amellify instalada con éxito!    │"
echo "  └─────────────────────────────────────────┘"
echo -e "${NC}"
echo "  Puedes abrir Amellify desde:"
echo -e "  ${BOLD}•${NC} Launchpad — busca 'Amellify'"
echo -e "  ${BOLD}•${NC} Spotlight — Cmd+Space → 'Amellify'"
echo -e "  ${BOLD}•${NC} Finder → Aplicaciones → Amellify.app"
echo -e "  ${BOLD}•${NC} Terminal: ${CYAN}./abrir-amellify.sh${NC}"
echo ""
echo "  Tus datos se guardan en:"
echo -e "  ${CYAN}~/Library/Application Support/amellify/amellify-data.json${NC}"
echo ""

read -p "  ¿Iniciar el servidor ahora? [S/n]: " OPEN_NOW
if [[ ! "$OPEN_NOW" =~ ^[Nn]$ ]]; then
    echo -e "  ${GREEN}Iniciando servidor...${NC}"
    cd "$APP_DIR" && ./iniciar-web.sh &
fi
echo ""
