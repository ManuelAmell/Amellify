# Funcionalidades de Amellify

## Calculadora de Notas

Calculadora standalone para calcular notas ponderadas de materias.

### Características:
- **Vista Calculadora**: Nuevo tab en la barra de vistas
- **Parciales dinámicos**: Agregar/eliminar parciales
- **Validación 100%**: Los porcentajes deben sumar exactamente 100%
- **Indicador visual**: Muestra error si no suma 100%
- **Escala 0-5**: Passing >= 2.96 (aprox. 2.96)

### Calculadora en formulario de materia:
- **Dentro del modal**: Integrated en el formulario de matéria
- **3 parciales por defecto**: P1: 30%, P2: 30%, P3: 40%
- **Cálculo en tiempo real**: Botón para calcular
- **Estados**: Verde (aprobado), Rojo (reprobado)

## Vista Grid Completa (24 horas)

La vista Grid muestra todas las horas del día (00:00 - 23:59) en lugar de solo las horas con clases programadas. Esto proporciona una visión completa del día y permite ver mejor el contexto temporal.

- **Rango completo**: 24 horas × 6 slots de 10 minutos = 144 filas
- **Scroll suave**: Navegación fluida por todo el día
- **Diseño compacto**: Optimizado para mostrar el máximo de información

## 🔴 Indicador de Hora Actual

Línea roja horizontal estilo Google Calendar que muestra la hora actual en tiempo real.

- **Línea roja**: Atraviesa todas las columnas del día
- **Círculo rojo**: Centrado en la columna del día actual con animación de pulso
- **Actualización automática**: Se actualiza cada minuto
- **Sombra y efectos**: Visualización clara y moderna

## 🎯 Auto-scroll Inteligente

Al abrir la aplicación, el Grid se posiciona automáticamente en el contenido más relevante.

**Prioridad de enfoque:**
1. Clase actual (si hay una en curso)
2. Próxima clase del día
3. Primera clase del día
4. Primera clase de la semana
5. Hora actual (si no hay materias)

**Características:**
- Centra las clases en el viewport
- Scroll suave y preciso
- Cálculo exacto en píxeles

## 📭 Estado Vacío con Overlay

Cuando no hay materias agregadas, aparece un modal flotante elegante.

**Características:**
- Modal centrado con backdrop semi-transparente
- Animación fade in + scale
- Botón X minimalista para cerrar
- Se puede cerrar con: X, Esc, click en backdrop, o al agregar materia
- Diseño moderno con blur effect

## 🔍 Zoom con Atajos de Teclado

Control completo del zoom desde el teclado (funciona en Electron).

**Atajos:**
- `Ctrl/Cmd + +` o `=`: Acercar
- `Ctrl/Cmd + -`: Alejar
- `Ctrl/Cmd + 0`: Restablecer zoom

**Características:**
- Incremento de 0.5 niveles por acción
- Notificaciones silenciosas al cambiar zoom
- Funciona en toda la aplicación

## ❓ Modal de Atajos de Teclado

Botón circular con "?" en el header que muestra todos los atajos disponibles.

**Características:**
- Detección automática del SO (Mac → Cmd, Windows/Linux → Ctrl)
- 11 atajos organizados en 6 categorías
- Teclas estilizadas con efecto 3D usando `<kbd>`
- Hover interactivo y scroll personalizado
- Diseño moderno y legible

## ⌨️ Atajo Ctrl/Cmd+H - Ir al Horario

Atajo rápido para volver al Grid y enfocar el horario.

**Funcionalidad:**
- Cambia automáticamente a Vista Grid (si no estás ahí)
- Enfoca en la clase más relevante o hora actual
- Usa la misma lógica de prioridad que el auto-scroll inicial
- Notificación con el nombre de la clase enfocada

## 🔔 Notificaciones Silenciosas

Notificaciones discretas para todos los atajos de teclado.

**Características:**
- Posición: Esquina inferior derecha
- Duración: 1.5 segundos
- Animación: Fade in + slide up
- Fuente: Monospace para mejor legibilidad
- Incluye: Atajos de app (H, N, 1/2/3, Shift+T, R) y zoom (+, -, 0)

## 📜 Scroll Dual Coordinado

Sistema de scroll coordinado entre la página principal y el contenedor Grid.

**Funcionamiento:**
1. Scroll de la página principal con `window.scrollTo()`
2. Calcula posición exacta de `view-content` con offset de 80px para el header
3. Después de 100ms, hace scroll del contenedor Grid
4. Ambos con `behavior: 'smooth'`
5. Timing coordinado: página → 100ms → grid → 300ms → notificación

## 📏 Configuración de Tamaño de Texto

Sistema completo de configuración de tamaño de fuente para las celdas del Grid.

**Tres tamaños disponibles:**
- **Pequeño**: Código 11px, Nombre 13px
- **Normal** (por defecto): Código 13px, Nombre 15px
- **Grande**: Código 15px, Nombre 17px

**Características:**
- Acceso desde el botón de configuración (⚙️)
- Persistencia en localStorage
- Notificación al cambiar tamaño
- Variables CSS para aplicación dinámica
- Afecta: código, nombre, salón, profesor, horario, padding y gap

## 🎨 Diseño Compacto y Optimizado

El Grid ha sido optimizado para mostrar más información en menos espacio.

**Optimizaciones:**
- SLOT_H: 12px (altura de cada slot de 10 minutos)
- Columna de horas: 48px
- Min-width: 680px
- Max-height: 78vh
- Círculo indicador: 10px
- Scrollbar: 8px

**Tipografía optimizada:**
- Headers: 10px
- Etiquetas de hora: 10px (font-weight 600, color más visible)
- Textos en celdas: Configurables (pequeño/normal/grande)

## ⚡ Atajos de Teclado Completos

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
| `?` | Mostrar atajos |

---

**Última actualización**: Febrero 2026
