# 📚 Amellify — Gestor de Horarios Universitarios v1.0

Gestiona tus materias, horarios, profesores y aulas en una app de escritorio elegante y rápida. Sin internet, sin cuentas, tus datos son tuyos.

![Version](https://img.shields.io/badge/version-1.0.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Node](https://img.shields.io/badge/node-%3E%3D16-brightgreen)

---

## 📸 Capturas de Pantalla

### Interfaz Principal

<table>
  <tr>
    <td width="50%">
      <img src="imagenlight.png" alt="Interfaz Principal - Modo Claro" />
      <p align="center"><b>Modo Claro</b></p>
    </td>
    <td width="50%">
      <img src="imagedark.png" alt="Interfaz Principal - Modo Oscuro" />
      <p align="center"><b>Modo Oscuro</b></p>
    </td>
  </tr>
</table>

### Vista de Horario Grid

<table>
  <tr>
    <td width="50%">
      <img src="hlight.png" alt="Vista Horario - Modo Claro" />
      <p align="center"><b>Horario Grid - Modo Claro</b></p>
    </td>
    <td width="50%">
      <img src="hdark.png" alt="Vista Horario - Modo Oscuro" />
      <p align="center"><b>Horario Grid - Modo Oscuro</b></p>
    </td>
  </tr>
</table>

---

## 🌟 Características Destacadas

### 🎯 Vista Grid Completa (24 horas)
Visualiza todo tu día de 00:00 a 23:59, no solo las horas con clases. Perfecto para planificar tu tiempo libre y ver el contexto completo de tu jornada.

### 🔴 Indicador de Hora Actual
Línea roja horizontal que atraviesa todas las columnas, con un círculo pulsante en el día actual. Se actualiza automáticamente cada minuto para que siempre sepas dónde estás en tu día.

### 🎯 Auto-scroll Inteligente
Al abrir la app, el horario se posiciona automáticamente en:
1. Tu clase actual (si hay una en curso)
2. Tu próxima clase del día
3. La primera clase del día
4. La hora actual (si no hay clases)

### ⌨️ Atajos de Teclado Potentes
Control total sin tocar el mouse:
- `Ctrl/Cmd + H`: Volver al horario y enfocar tu próxima clase
- `Ctrl/Cmd + 1/2/3`: Cambiar entre vistas
- `Ctrl/Cmd + +/-/0`: Controlar zoom
- `?`: Ver todos los atajos disponibles

### 📏 Personalización de Texto
Tres tamaños de texto configurables desde el menú de configuración (⚙️):
- **Pequeño**: Para ver más información en pantalla
- **Normal**: Tamaño por defecto, equilibrado
- **Grande**: Para mejor legibilidad

---

## ✨ Características

- 📅 **Tres vistas**: Grid semanal (24h completas), vista por día, lista completa
- ⏰ **Temporizador en tiempo real**: Cuenta regresiva hasta tu próxima clase
- 🔴 **Indicador de hora actual**: Línea roja estilo Google Calendar que se actualiza cada minuto
- 🎯 **Auto-scroll inteligente**: Enfoque automático en tu próxima clase o clase actual
- 🎨 **Temas**: Modo claro y oscuro con transiciones suaves
- 📏 **Tamaño de texto configurable**: Tres niveles (Pequeño, Normal, Grande)
- 📊 **Estadísticas en tiempo real**: Créditos totales, horas semanales, carga académica
- 🔔 **Detección de conflictos**: Alerta automática de horarios superpuestos al agregar materias
- 💾 **Exportar/Importar**: Respaldo completo de datos en formato JSON
- 🗑️ **Gestión completa**: Agregar, editar, eliminar materias con interfaz intuitiva
- ⌨️ **Atajos de teclado**: Control total desde el teclado (13 atajos disponibles)
- 🔍 **Zoom**: Control de zoom con atajos (Ctrl/Cmd + +/-/0)
- 📭 **Estado vacío elegante**: Modal flotante cuando no hay materias
- 🚀 **100% Offline**: Funciona sin conexión a internet, datos almacenados localmente
- ⚡ **Rendimiento**: Carga instantánea, sin lag, optimizado para uso diario

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
| `Ctrl/Cmd + N` | Nueva materia |
| `Ctrl/Cmd + 1` | Vista Grid |
| `Ctrl/Cmd + 2` | Vista Semana |
| `Ctrl/Cmd + 3` | Vista Lista |
| `Ctrl/Cmd + H` | Ir al horario (Grid + enfoque) |
| `Ctrl/Cmd + Shift + T` | Cambiar tema |
| `Ctrl/Cmd + R` | Recargar |
| `Ctrl/Cmd + +/=` | Acercar zoom |
| `Ctrl/Cmd + -` | Alejar zoom |
| `Ctrl/Cmd + 0` | Restablecer zoom |
| `F11` | Pantalla completa |
| `Esc` | Cerrar modal |
| `?` | Mostrar todos los atajos |

> **Nota**: En Mac usa `Cmd`, en Windows/Linux usa `Ctrl`

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

## 🎯 Funcionalidades Detalladas

Consulta [FUNCIONALIDADES.md](FUNCIONALIDADES.md) para una descripción completa de todas las características implementadas, incluyendo:
- Vista Grid completa (24 horas)
- Indicador de hora actual en tiempo real
- Auto-scroll inteligente
- Sistema de configuración de tamaño de texto
- Y mucho más...

---

## 📝 Formato de Importación

Consulta [FORMATO-IMPORTACION.md](FORMATO-IMPORTACION.md) para el esquema JSON de importación de materias.

---

## 🎥 Demo y Uso

### Primer Uso
1. Instala la aplicación usando los scripts de instalación
2. Abre Amellify con `./abrir-amellify.sh` o `npm start`
3. Haz clic en **➕ Nueva Materia** para agregar tu primera materia
4. Completa la información: código, nombre, créditos, profesor
5. Agrega horarios con **➕ Agregar Horario**
6. Selecciona día, hora de inicio, hora de fin y aula
7. Elige un color para identificar la materia
8. Guarda y ¡listo! Tu horario aparecerá en el Grid

### Navegación Rápida
- **Vista Grid** (`Ctrl+1`): Horario semanal completo con todas las 24 horas
- **Vista Semana** (`Ctrl+2`): Tarjetas por día con tus clases
- **Vista Lista** (`Ctrl+3`): Lista completa de todas tus materias

### Gestión de Datos
- **Exportar**: Menú ⚙️ → 📤 Exportar JSON (crea un backup)
- **Importar**: Menú ⚙️ → 📥 Importar JSON (restaura desde backup)
- **Configurar**: Menú ⚙️ → Ajustar tamaño de texto
- **Borrar**: Menú ⚙️ → 🗑️ Borrar Horario (elimina todo)

### Atajos Útiles
- `Ctrl/Cmd + H`: Volver rápidamente a tu próxima clase
- `Ctrl/Cmd + N`: Agregar nueva materia
- `Ctrl/Cmd + Shift + T`: Cambiar entre modo claro/oscuro
- `?`: Ver modal con todos los atajos

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
