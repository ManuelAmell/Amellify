<h1 align="center">📚 Amellify v2</h1>
<p align="center">
  <sub><b>GESTIÓN INTELIGENTE DE HORARIOS UNIVERSITARIOS & SEGUIMIENTO ACADÉMICO</b></sub>
  <br>
  <sub>Next.js 15 · Supabase PostgreSQL · Tailwind CSS · TypeScript · Vercel</sub>
</p>

<p align="center">
  <a href="https://amellify.vercel.app"><img src="https://img.shields.io/badge/demo-vercel-%23000000?style=for-the-badge&logo=vercel&logoColor=white" alt="Demo en Vercel"></a>
  <a href="https://github.com/ManuelAmell/Amellify/blob/v2/LICENSE"><img src="https://img.shields.io/badge/license-MIT-%230D9488?style=for-the-badge" alt="Licencia MIT"></a>
  <img src="https://img.shields.io/badge/status-v2_estable-%2322c55e?style=for-the-badge" alt="Estado: v2 estable">
  <img src="https://img.shields.io/badge/backend-Supabase_PostgreSQL-%233ECF8E?style=for-the-badge&logo=supabase&logoColor=white" alt="Supabase Backend">
  <img src="https://img.shields.io/badge/frontend-Next.js_15_App_Router-%23000000?style=for-the-badge&logo=next.js&logoColor=white" alt="Next.js 15">
</p>

<p align="center">
  <b>Organiza tu semestre universitario con sincronización en la nube en tiempo real.</b><br>
  Horario visual interactivo con línea de tiempo en vivo, calculadora de notas ponderadas con simulador de aprobación, estadísticas de carga horaria y extracción automática de horarios con Inteligencia Artificial (Gemini 2.0 Flash).
</p>

---

## ✨ Características Principales

<table>
  <tr>
    <td width="50%">
      <h3>📅 Grid Semanal Interactivo</h3>
      <p>Línea de tiempo con ranuras de 10 min, marcador de hora actual en vivo, clic directo para registrar clases y colores temáticos por materia.</p>
    </td>
    <td width="50%">
      <h3>🧮 Calculadora de Notas & Simulador</h3>
      <p>Promedios ponderados en tiempo real, presets de porcentajes (30/30/40, 50/50, 3x33%), cálculo automático de "¿Qué nota necesito para pasar?" y escalas configurables (0-5, 0-7, 0-10).</p>
    </td>
  </tr>
  <tr>
    <td width="50%">
      <h3>📊 Estadísticas & Analítica</h3>
      <p>Créditos inscritos, carga horaria semanal distribuida por día, promedio general acumulado y ranking de rendimiento por materia.</p>
    </td>
    <td width="50%">
      <h3>🤖 Escáner de Horarios con IA</h3>
      <p>Sube una foto (JPG, PNG, WebP) o captura de tu horario y Gemini 2.0 Flash extraerá automáticamente materias, docentes, salones y horarios con confirmación previa.</p>
    </td>
  </tr>
  <tr>
    <td width="50%">
      <h3>🔒 Auth & Seguridad con Supabase RLS</h3>
      <p>Inicio de sesión seguro con Google y GitHub OAuth. Aislamiento total de datos por usuario mediante Row Level Security (RLS) en PostgreSQL.</p>
    </td>
    <td width="50%">
      <h3>🎨 Design System (ui-ux-pro-max)</h3>
      <p>Paleta moderna Teal + Tokyo Night, soporte completo para Modo Claro / Oscuro / Sistema, glassmorphism sutil y accesibilidad WCAG AA.</p>
    </td>
  </tr>
  <tr>
    <td width="50%">
      <h3>📤 Exportar a Calendario (.ICS)</h3>
      <p>Exporta tu horario con reglas de recurrencia semanal (RFC 5545) compatibles con Google Calendar, Apple Calendar y Outlook.</p>
    </td>
    <td width="50%">
      <h3>📱 100% Responsivo & Mobile First</h3>
      <p>Navegación adaptativa con barra inferior en celulares y barra lateral en escritorio. Diseñado como Progressive Web App (PWA).</p>
    </td>
  </tr>
</table>

---

## 🛠️ Stack Tecnológico

- **Frontend:** Next.js 15 (App Router, Server Components & Server Actions), React 19, TypeScript (Strict).
- **Estilos & UI:** Tailwind CSS, shadcn/ui (Radix UI primitives), Lucide Icons, `next-themes`.
- **Backend as a Service:** Supabase (Auth OAuth Google/GitHub, PostgreSQL Database, Row Level Security).
- **Inteligencia Artificial:** Google Gemini 2.0 Flash / OpenRouter cascade API.
- **Despliegue:** Vercel (SSR + Edge).

---

## 🚀 Puesta en Marcha Local

### 1. Clonar el repositorio y cambiar a la rama `v2`

```bash
git clone https://github.com/ManuelAmell/Amellify.git
cd Amellify
git checkout v2
```

### 2. Instalar dependencias

```bash
npm install
```

### 3. Configurar variables de entorno

Crea un archivo `.env.local` en la raíz del proyecto:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-supabase-anon-key

# Inteligencia Artificial (para el escáner de horarios)
GEMINI_API_KEY=tu-api-key-de-gemini-ai-studio
OPENROUTER_API_KEY=tu-api-key-de-openrouter # opcional como respaldo
```

### 4. Ejecutar las migraciones en Supabase

Ejecuta el archivo `supabase/migrations/001_initial_schema.sql` en el SQL Editor de tu Dashboard de Supabase (o mediante `npx supabase db push`).

### 5. Iniciar el servidor de desarrollo

```bash
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000) en tu navegador.

---

## 🗄️ Esquema de Base de Datos (Supabase PostgreSQL)

```sql
-- Perfiles de usuario (extiende auth.users)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  university TEXT,
  faculty TEXT,
  current_semester TEXT,
  passing_grade NUMERIC(3,2) DEFAULT 3.00,
  max_grade NUMERIC(3,2) DEFAULT 5.00,
  preferences JSONB
);

-- Materias
CREATE TABLE public.courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  code VARCHAR(8) NOT NULL,
  name TEXT NOT NULL,
  professor TEXT,
  email TEXT,
  faculty TEXT,
  semester TEXT,
  credits INTEGER DEFAULT 3,
  status TEXT DEFAULT 'active',
  color TEXT DEFAULT 'blue'
);

-- Bloques de horario
CREATE TABLE public.schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  day TEXT NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  room TEXT
);

-- Notas parciales
CREATE TABLE public.partials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  grade NUMERIC(4,2),
  percent NUMERIC(5,2) NOT NULL,
  sort_order INTEGER DEFAULT 0
);
```

---

## 📄 Licencia

MIT License — Creado con ❤️ por [Manuel Francisco Amell Gil](https://github.com/ManuelAmell) · 2026
