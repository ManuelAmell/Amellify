# 📥 Guía de Importación de Datos — Amellify

Esta guía explica cómo crear o editar archivos JSON para importar tus materias en Amellify.

---

## 🎯 Formato Básico

El archivo debe ser un **array JSON** (lista entre corchetes `[ ]`) con objetos que representan cada materia:

```json
[
  {
    "code": "CODIGO123",
    "name": "NOMBRE DE LA MATERIA",
    "credits": 3,
    "schedules": [
      {
        "day": "Lunes",
        "start_time": "08:00",
        "end_time": "10:00",
        "room": "A-201"
      }
    ]
  }
]
```

---

## 📋 Campos de cada materia

### ✅ Campos **OBLIGATORIOS**

| Campo | Tipo | Descripción | Ejemplo |
|-------|------|-------------|---------|
| `code` | string | Código único de la materia | `"CFB0221"` |
| `name` | string | Nombre de la materia | `"CÁLCULO INTEGRAL"` |

### 📝 Campos **OPCIONALES**

| Campo | Tipo | Descripción | Valor por defecto | Ejemplo |
|-------|------|-------------|-------------------|---------|
| `professor` | string | Nombre del profesor | `""` | `"Dr. Juan Pérez"` |
| `email` | string | Email del profesor | `""` | `"juan.perez@uni.edu"` |
| `faculty` | string | Facultad o carrera | `""` | `"Ingeniería"` |
| `semester` | string | Semestre académico | `""` | `"2026-1"` |
| `credits` | número | Créditos académicos | `3` | `4` |
| `status` | string | Estado de la materia | `"active"` | Ver tabla abajo ⬇️ |
| `notes` | string | Notas o descripción | `""` | `"Requisito: Cálculo I"` |
| `color` | string | Color visual | `"blue"` | Ver tabla abajo ⬇️ |
| `schedules` | array | Lista de horarios | `[]` | Ver sección abajo ⬇️ |

### 🎨 Valores válidos para `color`

| Color | Código |
|-------|--------|
| 🔴 Rojo | `"red"` |
| 🔵 Azul | `"blue"` |
| 🟢 Verde | `"green"` |
| 🟠 Naranja | `"orange"` |
| 🟣 Morado | `"purple"` |
| 🔷 Turquesa | `"teal"` |

### 📊 Valores válidos para `status`

| Estado | Código | Emoji |
|--------|--------|-------|
| Activa | `"active"` | 🟢 |
| En pausa | `"paused"` | 🟡 |
| Completada | `"completed"` | 🔵 |
| Retirada | `"dropped"` | 🔴 |

---

## 📅 Formato de horarios (`schedules`)

Cada horario es un objeto dentro del array `schedules`:

```json
"schedules": [
  {
    "day": "Lunes",
    "start_time": "08:00",
    "end_time": "10:00",
    "room": "A-201"
  },
  {
    "day": "Miércoles",
    "start_time": "08:00",
    "end_time": "10:00",
    "room": "A-201"
  }
]
```

### Campos de horario

| Campo | Tipo | Obligatorio | Descripción | Ejemplo |
|-------|------|-------------|-------------|---------|
| `day` | string | ✅ Sí | Día de la semana | `"Lunes"` |
| `start_time` | string | ✅ Sí | Hora de inicio (HH:MM) | `"08:00"` |
| `end_time` | string | ✅ Sí | Hora de fin (HH:MM) | `"10:00"` |
| `room` | string | ❌ No | Aula o salón | `"LAB-3"` |

### ⚠️ Valores válidos para `day`

**Debes usar exactamente estos nombres (con tilde y mayúscula inicial):**

- `"Lunes"`
- `"Martes"`
- `"Miércoles"`
- `"Jueves"`
- `"Viernes"`
- `"Sábado"`
- `"Domingo"`

### ⏰ Formato de hora

- Usar formato de 24 horas: `HH:MM`
- Ejemplos válidos: `"08:00"`, `"13:30"`, `"18:45"`
- ❌ Inválido: `"8:00"` (falta el cero), `"8am"`, `"20:00:00"` (con segundos)

---

## 📝 Ejemplos Completos

### Ejemplo 1: Materia con datos mínimos

```json
[
  {
    "code": "MAT101",
    "name": "ÁLGEBRA LINEAL",
    "schedules": []
  }
]
```

### Ejemplo 2: Materia con todos los campos

```json
[
  {
    "code": "CFB0221",
    "name": "CÁLCULO INTEGRAL",
    "professor": "Dr. Juan Pérez",
    "email": "juan.perez@universidad.edu",
    "faculty": "Ingeniería",
    "semester": "2026-1",
    "credits": 4,
    "status": "active",
    "notes": "Requisito: Cálculo Diferencial aprobado. Traer calculadora científica.",
    "color": "blue",
    "schedules": [
      {
        "day": "Lunes",
        "start_time": "08:00",
        "end_time": "10:00",
        "room": "A-201"
      },
      {
        "day": "Miércoles",
        "start_time": "08:00",
        "end_time": "10:00",
        "room": "A-201"
      },
      {
        "day": "Viernes",
        "start_time": "10:00",
        "end_time": "12:00",
        "room": "LAB-5"
      }
    ]
  }
]
```

### Ejemplo 3: Múltiples materias

```json
[
  {
    "code": "CFB0221",
    "name": "CÁLCULO INTEGRAL",
    "professor": "Dr. Juan Pérez",
    "credits": 4,
    "status": "active",
    "color": "blue",
    "schedules": [
      {
        "day": "Lunes",
        "start_time": "08:00",
        "end_time": "10:00",
        "room": "A-201"
      }
    ]
  },
  {
    "code": "FIS0310",
    "name": "FÍSICA II",
    "professor": "Dra. María López",
    "credits": 5,
    "status": "active",
    "color": "green",
    "schedules": [
      {
        "day": "Martes",
        "start_time": "10:00",
        "end_time": "12:00",
        "room": "LAB-3"
      },
      {
        "day": "Jueves",
        "start_time": "10:00",
        "end_time": "12:00",
        "room": "LAB-3"
      }
    ]
  },
  {
    "code": "HIST201",
    "name": "HISTORIA DE MÉXICO",
    "professor": "Mtro. Carlos Ruiz",
    "credits": 3,
    "status": "completed",
    "color": "purple",
    "schedules": []
  }
]
```

---

## ⚠️ Errores Comunes

| Error | Problema | Solución |
|-------|----------|----------|
| `"Lun"` | Día mal escrito | Usar `"Lunes"` completo |
| `"8:00"` | Formato de hora incorrecto | Usar `"08:00"` con cero inicial |
| `color: "rojo"` | Color en español | Usar `"red"` en inglés |
| Falta coma entre materias | JSON inválido | Cada objeto debe estar separado por coma |
| Sin corchetes `[ ]` alrededor | No es un array | Encerrar todo entre `[` y `]` |

---

## 🔍 Validar tu JSON

Antes de importar, verifica que tu JSON sea válido:

1. **Online:** Pega tu JSON en [jsonlint.com](https://jsonlint.com)
2. **VS Code:** Abre el archivo `.json` — verás errores subrayados
3. **Terminal:**
   ```bash
   cat tu-archivo.json | python3 -m json.tool
   ```

---

## 💡 Método más fácil: Usar la exportación como plantilla

1. Abre Amellify
2. Crea 1-2 materias de ejemplo con todos los campos llenos
3. Ve a **⚙️ → Exportar JSON**
4. Usa ese archivo como plantilla — edítalo y agrega más materias

---

## 📤 Cómo importar

1. Abre Amellify
2. Haz clic en **⚙️** (arriba a la derecha)
3. Haz clic en **📥 Importar JSON**
4. Selecciona tu archivo `.json`

Las materias con códigos duplicados serán **ignoradas** (no se sobrescriben).

---

## 🆘 ¿Necesitas ayuda?

Si tu archivo JSON no funciona:

1. Valídalo en [jsonlint.com](https://jsonlint.com)
2. Verifica que uses exactamente los nombres de días y colores de esta guía
3. Asegúrate de que las horas estén en formato `"HH:MM"`
4. Compara con los ejemplos de arriba

---

*Amellify v1.0 · Formato de datos*
