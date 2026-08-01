<h1 align="center">📚 Amellify</h1>
<p align="center">
  <sub><b>GESTIÓN DE HORARIOS UNIVERSITARIOS</b></sub>
  <br>
  <sub>Sin servidor · Sin registro · 100% navegador</sub>
</p>

<p align="center">
  <a href="https://amellify.vercel.app"><img src="https://img.shields.io/badge/demo-vercel-%23000000?style=for-the-badge&logo=vercel&logoColor=white" alt="Demo en Vercel"></a>
  <a href="https://github.com/ManuelAmell/Amellify/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-%23007aff?style=for-the-badge" alt="Licencia MIT"></a>
  <img src="https://img.shields.io/badge/status-estable-%2322c55e?style=for-the-badge" alt="Estado: estable">
  <img src="https://img.shields.io/badge/sin%20backend-100%25%20frontend-%235856d6?style=for-the-badge" alt="100% frontend">
</p>

<p align="center">
  <b>Organizá tu semestre sin depender de ningún servidor.</b><br>
  Horario visual, calculadora de notas y estadísticas — todo corre en tu navegador y se guarda en tu equipo.
</p>

<p align="center">
  <a href="#-demo">Demo</a> ·
  <a href="#-características">Características</a> ·
  <a href="#-inicio-rápido">Inicio rápido</a> ·
  <a href="#-importar-desde-ia">Importar desde IA</a> ·
  <a href="#%EF%B8%8F-estructura-del-proyecto">Estructura</a> ·
  <a href="#-licencia">Licencia</a>
</p>

<br>

<div align="center">
  <table>
    <tr>
      <td align="center" width="120">📅<br><small>Grid<br>Semanal</small></td>
      <td align="center" width="120">📋<br><small>Lista de<br>Materias</small></td>
      <td align="center" width="120">🧮<br><small>Calculadora<br>de Notas</small></td>
      <td align="center" width="120">📊<br><small>Estadísticas</small></td>
      <td align="center" width="120">📤<br><small>Exportar<br>ICS</small></td>
      <td align="center" width="120">🎨<br><small>Temas<br>Visuales</small></td>
    </tr>
  </table>
</div>

<br>

---

## 🚀 Demo

<div align="center">
  <br>
  <a href="https://amellify.vercel.app">
    <img src="https://img.shields.io/badge/🌐%20Abrir%20Amellify-007aff?style=for-the-badge&logo=vercel&logoColor=white&labelColor=%23000" height="48" alt="Abrir demo">
  </a>
  <br><br>
  <code>https://amellify.vercel.app</code>
  <br><br>
</div>

No necesitás instalar nada: abrí el link y empezá a usar. Tus datos quedan guardados localmente en tu navegador (`localStorage`), nunca se envían a ningún servidor.

---

## ✨ Características

<table>
  <tr>
    <td width="50%">
      <h3>📅 Vista Grid Semanal</h3>
      <p>Arrastrá y soltá materias, colores por materia, días exactos con nombres en español.</p>
    </td>
    <td width="50%">
      <h3>🧮 Calculadora de Notas</h3>
      <p>Promedios ponderados, simulación de notas y cálculo de la nota mínima necesaria para pasar.</p>
    </td>
  </tr>
  <tr>
    <td width="50%">
      <h3>📊 Estadísticas</h3>
      <p>Créditos activos, horas semanales, distribución por día y rendimiento académico.</p>
    </td>
    <td width="50%">
      <h3>📤 Exportar a ICS</h3>
      <p>Exportá tu horario a cualquier calendario: Google, Apple u Outlook.</p>
    </td>
  </tr>
  <tr>
    <td width="50%">
      <h3>🎨 Temas Visuales</h3>
      <p>10 temas: Claro, Oscuro, Azul, Púrpura, Verde, Naranja, Rosa, Vidrio, Sepia y Alto Contraste.</p>
    </td>
    <td width="50%">
      <h3>🤖 Importar desde IA</h3>
      <p>Cargá una foto de tu horario y la IA lo analiza automáticamente. También podés pegar el prompt en ChatGPT o Claude.</p>
    </td>
  </tr>
  <tr>
    <td width="50%">
      <h3>🔔 Notificaciones</h3>
      <p>Recordatorios de clases próximas con notificaciones nativas del navegador.</p>
    </td>
    <td width="50%">
      <h3>📱 100% Responsive</h3>
      <p>Funciona en PC, tablet y celular. Se puede instalar como app (PWA).</p>
    </td>
  </tr>
</table>

---

## 🛠️ Tecnologías

<p align="center">
  <img src="https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white" alt="HTML5">
  <img src="https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css3&logoColor=white" alt="CSS3">
  <img src="https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black" alt="JavaScript">
  <img src="https://img.shields.io/badge/Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white" alt="Vercel">
  <img src="https://img.shields.io/badge/localStorage-FF6F00?style=for-the-badge&logo=googlechrome&logoColor=white" alt="localStorage">
</p>

Sin frameworks, sin build step, sin dependencias de backend: HTML, CSS y JavaScript puro (vanilla), pensado para ser fácil de leer, modificar y desplegar en cualquier hosting estático.

---

## 📦 Inicio rápido

```bash
git clone https://github.com/ManuelAmell/Amellify.git
cd Amellify
```

Levantá un servidor estático con la herramienta que prefieras:

```bash
# Con Python
python3 -m http.server 8080

# Con Node.js
npx serve .

# Con PHP
php -S localhost:8080
```

Después abrí **http://localhost:8080** en tu navegador. Listo, no hace falta instalar dependencias ni compilar nada.

---

## ⚙️ Configuración

| Función | Descripción |
|---|---|
| **Tamaño de fuente** | Pequeño / Normal / Grande |
| **Compactar grid** | Reduce el alto de las celdas para ver más horas |
| **Día de inicio** | Lunes o Domingo |
| **Arrastrar clases** | Activar/desactivar drag & drop en el grid |
| **Tema visual** | 10 temas de color |
| **Notificaciones** | Recordatorio de la próxima clase |
| **Importar desde IA** | Cargar foto con IA o archivo JSON |
| **Exportar ICS** | A Google Calendar, Apple Calendar u Outlook |

---

## 🤖 Importar desde IA

Amellify puede generar tu horario automáticamente a partir de **una foto de tu horario** usando IA.

### Cargar foto con IA (recomendado)

En la pestaña **IA** de Configuración:

1. Hacé clic en **Seleccionar foto** y elegí una imagen de tu horario (JPG, PNG, WebP — máx. 5 MB).
2. Seleccioná el modelo de IA (por defecto se usa **Gemini 2.0 Flash**, rápido y preciso).
3. Hacé clic en **Analizar horario con IA**. La IA procesará la imagen y detectará las materias.
4. Revisá el preview y confirmá la importación.

> La api key de OpenRouter se configura como variable de entorno `OPENROUTER_API_KEY` en Vercel.

### Alternativa manual: copiar prompt

Si preferís usar ChatGPT o Claude directamente:

<details>
  <summary><b>📋 Ver el prompt para copiar y pegar</b></summary>

Copiá esto y pegáselo a ChatGPT o Claude junto con la foto de tu horario:

```
Quiero que actúes como un generador de horarios universitarios en formato JSON.
Te voy a pasar una descripción (texto o imagen) de mi horario de clases y vos
debés devolver SOLO un arreglo JSON válido, sin markdown fences, sin
explicaciones, sin texto adicional.

FORMATO EXACTO DE SALIDA:
[
  {
    "code": "CALCVEC",
    "name": "Cálculo Vectorial",
    "professor": "Juan Pérez",
    "email": "",
    "faculty": "Ingeniería de Sistemas",
    "semester": "2025-1",
    "credits": 3,
    "status": "active",
    "color": "blue",
    "schedules": [
      { "day": "Lunes", "start_time": "08:40", "end_time": "10:20", "room": "A-301" }
    ],
    "partials": []
  }
]

Reglas:
- code: máx. 8 caracteres, mayúsculas, sin espacios. Nunca vacío.
- name: obligatorio.
- credits: entero 1-6. Default 3.
- status: siempre "active".
- color: "blue", "red", "green", "orange", "purple", "teal".
- day: "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo".
- start_time / end_time: "HH:MM" en formato 24h. Incorrecto: "7:00", "3pm".
- partials: siempre [].
```

</details>

Luego pegá el JSON resultante en la sección **Importar JSON** de la app.

---

## 🧪 Ejemplo: calculadora de notas

Así se estructuran las notas parciales que usa la calculadora internamente:

```js
const partials = [
  { name: "P1",    grade: 3.5,  percent: 30 },
  { name: "P2",    grade: 4.0,  percent: 30 },
  { name: "Final", grade: null, percent: 40 } // null = nota aún no definida
];
```

La calculadora usa esto para mostrar el promedio actual, simular escenarios y calcular la nota mínima que necesitás en el `Final` para aprobar.

---

## 🏗️ Estructura del proyecto

```
Amellify/
├── index.html                 ← Entry point (SPA)
├── favicon.svg                ← Ícono principal
├── manifest.json               ← PWA manifest
├── vercel.json                 ← Config de Vercel
└── src/
    ├── css/
    │   ├── variables.css       ← Tokens de diseño
    │   ├── base.css            ← Reset y tipografía
    │   ├── layout.css          ← Layout principal
    │   ├── components.css      ← Componentes reutilizables
    │   ├── schedule.css        ← Grid y horarios
    │   ├── colors.css          ← Paletas de color
    │   ├── glass.css           ← Efecto vidrio
    │   ├── features.css        ← Características adicionales
    │   └── themes-extra.css    ← Temas extra
    └── js/
        ├── app.js              ← Core de la aplicación
        ├── api.js              ← Capa de datos (localStorage)
        ├── features.js         ← Funcionalidades principales
        ├── features-advanced.js← Features avanzadas
        ├── grid-dnd.js         ← Drag & drop en grid
        ├── ics.js              ← Exportación ICS
        ├── notifications.js    ← Notificaciones
        └── utils.js            ← Utilidades
```

---

## 🤝 Contribuir

¿Tenés una idea o encontraste un bug? Las contribuciones son bienvenidas:

1. Hacé un fork del repositorio.
2. Creá una rama para tu cambio: `git checkout -b feature/mi-mejora`.
3. Commiteá tus cambios: `git commit -m "Agrega mi mejora"`.
4. Subí la rama: `git push origin feature/mi-mejora`.
5. Abrí un Pull Request.

Para bugs o sugerencias, también podés abrir un [issue](https://github.com/ManuelAmell/Amellify/issues).

---

## 📄 Licencia

<div align="center">
  <br>
  <strong>MIT</strong> — hacé lo que quieras con este código.
  <br><br>
  <sub>Hecho con ❤️ para estudiantes universitarios</sub>
  <br>
  <sub>Manuel Amell · 2026</sub>
  <br>
</div>

---

<div align="center">
  <a href="https://amellify.vercel.app">
    <img src="https://img.shields.io/badge/🚀%20Probar%20Amellify-007aff?style=for-the-badge" alt="Probar Amellify">
  </a>
  &nbsp;
  <a href="https://github.com/ManuelAmell/Amellify/issues">
    <img src="https://img.shields.io/badge/🐛%20Reportar%20Bug-ef4444?style=for-the-badge" alt="Reportar Bug">
  </a>
  &nbsp;
  <a href="https://github.com/ManuelAmell/Amellify">
    <img src="https://img.shields.io/badge/⭐%20Star%20en%20GitHub-22c55e?style=for-the-badge" alt="Star en GitHub">
  </a>
</div>
