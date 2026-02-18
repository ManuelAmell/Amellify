# 📚 Amellify — Gestor de Horarios Universitarios v1.0

Gestiona tus materias, horarios, profesores y aulas en una app de escritorio elegante y rápida. Sin internet, sin cuentas, tus datos son tuyos.

![Version](https://img.shields.io/badge/version-1.0.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Node](https://img.shields.io/badge/node-%3E%3D16-brightgreen)

---

## ✨ Características

- 📅 **Tres vistas**: Grid semanal, vista por día, lista completa
- ⏰ **Temporizador**: Cuenta regresiva hasta tu próxima clase
- 🎨 **Temas**: Modo claro y oscuro
- 📊 **Estadísticas**: Créditos, horas semanales, carga académica
- 🔔 **Detección de conflictos**: Alerta automática de horarios superpuestos
- 💾 **Exportar/Importar**: Respaldo de datos en JSON
- 🗑️ **Gestión completa**: Agregar, editar, eliminar materias
- 🚀 **Offline**: Funciona sin conexión a internet

---

## ⚡ Instalación Rápida

### 🐧 Linux
```bash
chmod +x instalar-linux.sh && ./instalar-linux.sh
```

### 🪟 Windows
```cmd
instalar-windows.bat
```

### 🍎 macOS
```bash
chmod +x instalar-macos.sh && ./instalar-macos.sh
```

**Requisito**: Node.js v16+ → [Descargar aquí](https://nodejs.org)

---

## 🚀 Uso

### Iniciar la aplicación
```bash
./abrir-amellify.sh    # Linux/macOS
```

O ejecuta directamente:
```bash
npm start
```

### Agregar una materia
1. Click en **➕ Nueva Materia**
2. Completa la información (código, nombre, créditos, profesor)
3. Agrega horarios con el botón **➕ Agregar Horario**
4. Selecciona un color y guarda

### Gestión de datos
- **Exportar**: Menú ⚙️ → 📤 Exportar JSON
- **Importar**: Menú ⚙️ → 📥 Importar JSON
- **Borrar todo**: Menú ⚙️ → 🗑️ Borrar Horario

---

## 🗄️ Ubicación de Datos

| Sistema | Ruta |
|---------|------|
| Linux   | `~/.config/amellify/amellify-data.json` |
| macOS   | `~/Library/Application Support/amellify/amellify-data.json` |
| Windows | `%APPDATA%\amellify\amellify-data.json` |

---

## ⌨️ Atajos de Teclado

| Atajo | Acción |
|-------|--------|
| `Ctrl+N` | Nueva materia |
| `Ctrl+1` | Vista Grid |
| `Ctrl+2` | Vista Semanal |
| `Ctrl+3` | Vista Lista |
| `Ctrl+Shift+T` | Cambiar tema |
| `F11` | Pantalla completa |
| `Esc` | Cerrar modal |

---

## 📁 Estructura del Proyecto

```
amellify/
├── src/
│   ├── css/          # Estilos
│   └── js/           # Lógica de la app
├── electron-main.js  # Configuración Electron
├── server.js         # API REST local
├── index.html        # Interfaz principal
└── package.json      # Dependencias
```

---

## 🛠️ Tecnologías

- **Electron** - Framework de escritorio
- **Express** - API REST
- **Vanilla JS** - Sin frameworks pesados
- **CSS Variables** - Temas dinámicos

---

## 💡 Ideas y Mejoras

Revisa [IDEAS-MEJORAS.md](IDEAS-MEJORAS.md) para ver funcionalidades planeadas y sugerencias de mejora.

---

## 📝 Formato de Importación

Consulta [FORMATO-IMPORTACION.md](FORMATO-IMPORTACION.md) para el esquema JSON de importación de materias.

---

## 🤝 Contribuir

1. Fork el proyecto
2. Crea una rama (`git checkout -b feature/nueva-funcionalidad`)
3. Commit tus cambios (`git commit -m 'Agregar nueva funcionalidad'`)
4. Push a la rama (`git push origin feature/nueva-funcionalidad`)
5. Abre un Pull Request

---

## 📄 Licencia

MIT License - Usa, modifica y distribuye libremente.

---

## 👨‍💻 Autor

Desarrollado con ☕ para estudiantes universitarios.

---

## 🐛 Reportar Problemas

¿Encontraste un bug? [Abre un issue](../../issues)
