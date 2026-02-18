@echo off
setlocal enabledelayedexpansion
title Amellify — Instalador
color 0F
cls

echo.
echo   ===========================================
echo    ^>^>  AMELLIFY v1.0  ^<^<
echo    Gestor de Horarios Universitarios
echo   ===========================================
echo.
echo   Bienvenido al instalador de Amellify.
echo   Este proceso tomara unos minutos la primera vez.
echo.
echo   -------------------------------------------
echo.

:: ── Paso 1: Verificar Node.js ─────────────────────────────────────────────
echo   [1/4] Verificando Node.js...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo   [!] Node.js no encontrado.
    echo.
    echo   Por favor instala Node.js antes de continuar:
    echo   https://nodejs.org  (descarga la version LTS)
    echo.
    echo   Despues de instalarlo, vuelve a ejecutar este archivo.
    echo.
    pause
    start https://nodejs.org
    exit /b 1
)

for /f "tokens=*" %%v in ('node --version') do set NODE_VER=%%v
echo   [OK] Node.js !NODE_VER! instalado
echo.

:: ── Paso 2: Instalar dependencias ────────────────────────────────────────
echo   [2/4] Instalando dependencias...
if not exist "%~dp0node_modules\electron" (
    echo   Descargando Electron (~150MB, solo esta vez)...
    echo   Por favor espera, esto puede tardar 2-5 minutos...
    echo.
    cd /d "%~dp0"
    call npm install --progress=false
    if %errorlevel% neq 0 (
        echo.
        echo   [ERROR] No se pudieron instalar las dependencias.
        echo   Verifica tu conexion a internet e intenta de nuevo.
        echo.
        pause
        exit /b 1
    )
    echo   [OK] Dependencias instaladas
) else (
    echo   [OK] Dependencias ya instaladas
)
echo.

:: ── Paso 3: Crear acceso directo en el escritorio ─────────────────────────
echo   [3/4] Creando accesos directos...

set SCRIPT_DIR=%~dp0
set SCRIPT_DIR=%SCRIPT_DIR:~0,-1%

:: Crear VBScript temporal para generar el acceso directo
set VBS_FILE=%TEMP%\amellify_shortcut.vbs
(
echo Set oWS = WScript.CreateObject^("WScript.Shell"^)
echo sLinkFile = oWS.SpecialFolders^("Desktop"^) ^& "\Amellify.lnk"
echo Set oLink = oWS.CreateShortcut^(sLinkFile^)
echo oLink.TargetPath = "cmd.exe"
echo oLink.Arguments = "/c ""cd /d %SCRIPT_DIR% && npx electron . 2>nul"""
echo oLink.WorkingDirectory = "%SCRIPT_DIR%"
echo oLink.WindowStyle = 7
echo oLink.Description = "Amellify - Gestor de Horarios Universitarios"
echo oLink.IconLocation = "%SCRIPT_DIR%\build\icon.ico"
echo oLink.Save
) > "%VBS_FILE%"
cscript //nologo "%VBS_FILE%" >nul 2>&1
del "%VBS_FILE%" >nul 2>&1

:: Acceso directo en Menú Inicio
set START_MENU=%APPDATA%\Microsoft\Windows\Start Menu\Programs
set VBS_FILE2=%TEMP%\amellify_startmenu.vbs
(
echo Set oWS = WScript.CreateObject^("WScript.Shell"^)
echo sLinkFile = "%START_MENU%\Amellify.lnk"
echo Set oLink = oWS.CreateShortcut^(sLinkFile^)
echo oLink.TargetPath = "cmd.exe"
echo oLink.Arguments = "/c ""cd /d %SCRIPT_DIR% && npx electron . 2>nul"""
echo oLink.WorkingDirectory = "%SCRIPT_DIR%"
echo oLink.WindowStyle = 7
echo oLink.Description = "Amellify - Gestor de Horarios Universitarios"
echo oLink.IconLocation = "%SCRIPT_DIR%\build\icon.ico"
echo oLink.Save
) > "%VBS_FILE2%"
cscript //nologo "%VBS_FILE2%" >nul 2>&1
del "%VBS_FILE2%" >nul 2>&1

echo   [OK] Acceso directo creado en el escritorio
echo   [OK] Acceso directo creado en el Menu Inicio
echo.

:: ── Paso 4: Listo ─────────────────────────────────────────────────────────
echo   [4/4] Finalizando instalacion...
echo.
echo   ===========================================
echo    [OK] Amellify instalada correctamente!
echo   ===========================================
echo.
echo   Puedes abrir Amellify desde:
echo   * El icono en el Escritorio  (Amellify)
echo   * El Menu Inicio  ^> Amellify
echo   * Ejecutando:  npx electron .
echo.
echo   Tus datos se guardan en:
echo   %APPDATA%\amellify\amellify-data.json
echo.
echo   -------------------------------------------
echo.

choice /c SN /m "  Abrir Amellify ahora? [S/N]"
if %errorlevel% equ 1 (
    echo.
    echo   Abriendo Amellify...
    start "" cmd /c "cd /d %SCRIPT_DIR% && npx electron . 2>nul"
)

echo.
echo   Presiona cualquier tecla para cerrar...
pause >nul
