<h1 align="center">📚 Amellify v3</h1>
<p align="center">
  <sub><b>GESTIÓN INTELIGENTE DE HORARIOS UNIVERSITARIOS & SEGUIMIENTO ACADÉMICO PRIVADO (SELF-HOSTED)</b></sub>
  <br>
  <sub>Next.js 16 · React 19 · PostgreSQL 17 · Drizzle ORM · Better Auth · Tailwind CSS v4 · Serwist PWA · Docker</sub>
</p>

<p align="center">
  <a href="https://github.com/ManuelAmell/Amellify/blob/v3/LICENSE"><img src="https://img.shields.io/badge/license-MIT-%230D9488?style=for-the-badge" alt="Licencia MIT"></a>
  <img src="https://img.shields.io/badge/status-v3_active-%2322c55e?style=for-the-badge" alt="Estado: v3">
  <img src="https://img.shields.io/badge/framework-Next.js_16_Standalone-%23000000?style=for-the-badge&logo=next.js&logoColor=white" alt="Next.js 16">
  <img src="https://img.shields.io/badge/database-PostgreSQL_17_%2B_Drizzle-%23336791?style=for-the-badge&logo=postgresql&logoColor=white" alt="PostgreSQL 17">
  <img src="https://img.shields.io/badge/pwa-Serwist_Offline-%236B21A8?style=for-the-badge" alt="PWA Serwist">
  <img src="https://img.shields.io/badge/docker-Multi--stage_Compose-%232496ED?style=for-the-badge&logo=docker&logoColor=white" alt="Docker">
</p>

<p align="center">
  <b>Organiza tu semestre universitario con soberanía total de datos y sin dependencias de servicios externos cerrados.</b><br>
  Amellify v3 es una plataforma moderna, auto-alojable (self-hostable) y de código abierto que reúne un horario visual interactivo, cálculo inteligente de promedios ponderados con simulador de aprobación, extracción automatizada de horarios mediante Visión Multimodal por IA y sincronización de calendario.
</p>

---

## ✨ Novedades de la Versión 3.0

- 🚀 **Arquitectura 100% Self-Hosted:** Migración completa fuera de BaaS hacia **PostgreSQL 17 nativo**, **Drizzle ORM** y **Better Auth**.
- 🛡️ **Privacidad y Soberanía:** Tus horarios, calificaciones y notas residen en tu propia base de datos sin telemetría ni intermediarios.
- 🎨 **Liquid Glass Design System:** Nueva interfaz fluida diseñada con **Tailwind CSS v4**, sombras translúcidas, desenfoque de fondo y soporte nativo para temas Claro, Oscuro y Tokyo Night.
- 🤖 **Cascada de IA Multimodal (Free Tier):** Escáner de horarios (foto, captura o PDF) con conmutación por fallo automática entre **Google Gemini 2.5 Flash**, **Groq**, **OpenRouter**, **Mistral AI** o cualquier gateway compatible con OpenAI (ej. Ollama local) — ver [`docs/AI-PROVIDERS.md`](docs/AI-PROVIDERS.md) para el detalle de qué proveedor procesa qué formato.
- 📱 **Progressive Web App (PWA) de Nueva Generación:** Impulsada por **Serwist** (`@serwist/next`), con caché offline para la interfaz base, fuentes, iconos y assets estáticos.
- 🚢 **Despliegue en 1 Minuto con Docker Compose:** Incluye proxy inverso **Caddy** con HTTPS automático (compatible con subdominios `sslip.io` gratuitos) y contenedor de respaldo diario con retención de 14 días.

---

## 📸 Características Principales

<table>
  <tr>
    <td width="50%">
      <h3>📅 Grid Semanal con Detección de Conflictos</h3>
      <p>Línea de tiempo con ranuras de 10 min, marcador de hora actual en vivo, algoritmo de empaquetado de carriles (lane-packing) para clases simultáneas y alertas visuales de solapamiento.</p>
    </td>
    <td width="50%">
      <h3>🧮 Calculadora de Notas & Simulador</h3>
      <p>Promedios ponderados en tiempo real, desglose porcentual personalizable, simulador "¿Qué nota necesito para pasar?" y escalas configurables (0–5.0, 0–7.0, 0–10.0).</p>
    </td>
  </tr>
  <tr>
    <td width="50%">
      <h3>🤖 Extracción de Horarios con IA</h3>
      <p>Sube una foto, captura o PDF de tu horario universitario y la IA extraerá código, asignatura, docente, salón y horarios con previsualización antes de guardar.</p>
    </td>
    <td width="50%">
      <h3>📱 Modo Offline & PWA</h3>
      <p>Instálala en tu teléfono Android, iPhone o escritorio como una app nativa. Funciona sin conexión para consulta de shell y datos cacheados.</p>
    </td>
  </tr>
  <tr>
    <td width="50%">
      <h3>📤 Exportación a Calendario (.ICS)</h3>
      <p>Exporta tus clases semanales con reglas de recurrencia RFC 5545 compatibles con Google Calendar, Apple Calendar y Microsoft Outlook.</p>
    </td>
    <td width="50%">
      <h3>💾 Copias de Seguridad & Portabilidad</h3>
      <p>Exporta e importa tus datos en formato JSON en cualquier momento o utiliza los volcados automáticos <code>pg_dump</code> comprimidos con gzip.</p>
    </td>
  </tr>
</table>

---

## 🛠️ Stack Tecnológico

| Capa | Tecnologías |
|---|---|
| **Frontend** | [Next.js 16](https://nextjs.org/) (App Router, Server Components & Actions), [React 19](https://react.dev/), [TypeScript 5.9](https://www.typescriptlang.org/) |
| **Estilos & UI** | [Tailwind CSS v4](https://tailwindcss.com/), Radix UI Primitives, Lucide Icons, Sonner Toasts, Motion |
| **Base de Datos & ORM** | [PostgreSQL 17](https://www.postgresql.org/), [Drizzle ORM](https://orm.drizzle.team/), Drizzle Kit |
| **Autenticación** | [Better Auth](https://www.better-auth.com/) (Email/Password + OAuth opcional con GitHub/Google) |
| **Inteligencia Artificial** | Vercel AI SDK, Google Gemini 2.5 Flash, Groq, OpenRouter, Mistral, Ollama |
| **PWA & Offline** | [Serwist](https://serwist.pages.dev/) (`@serwist/next`) con Service Worker personalizado |
| **Infraestructura & CI** | Docker multi-stage (standalone runner non-root), Docker Compose, Caddy (SSL automático), GitHub Actions |
| **Testing** | [Vitest](https://vitest.dev/) (Unit Tests), [Playwright](https://playwright.dev/) (E2E Tests) |

---

## 🚀 Puesta en Marcha Rápida

### Opción A: Despliegue en Servidor de Producción (Docker)

La forma recomendada de ejecutar Amellify en cualquier VPS (Ubuntu, Debian, etc.):

```bash
# 1. Clonar el repositorio
git clone -b v3 https://github.com/ManuelAmell/Amellify.git
cd Amellify

# 2. Configurar el archivo .env
cp .env.example .env
nano .env

# 3. Iniciar todos los servicios con SSL automático y backups diarios
docker compose --profile proxy --profile backup up -d --build
```

Abre tu navegador en `https://tu-dominio.com` o `https://amellify.<tu-ip>.sslip.io`.

Para una guía detallada paso a paso, consulta la [**Guía Completa de Despliegue (docs/DEPLOY.md)**](docs/DEPLOY.md).

---

### Opción B: Desarrollo Local

1. **Clonar e instalar dependencias:**
   ```bash
   git clone -b v3 https://github.com/ManuelAmell/Amellify.git
   cd Amellify
   pnpm install
   ```

2. **Configurar variables de entorno:**
   ```bash
   cp .env.example .env.local
   ```

3. **Iniciar base de datos PostgreSQL local:**
   Puedes iniciar una instancia local con Docker:
   ```bash
   docker compose up -d db
   pnpm db:migrate
   ```

4. **Iniciar servidor de desarrollo:**
   ```bash
   pnpm dev
   ```
   Abre [http://localhost:3000](http://localhost:3000) en tu navegador.

---

## 🧪 Pruebas y Control de Calidad

```bash
# Verificación de tipos TypeScript estricto
pnpm typecheck

# Linter de código
pnpm lint

# Pruebas unitarias (60 tests)
pnpm test

# Pruebas E2E completas con Playwright
pnpm test:e2e
```

---

## 📚 Documentación Adicional

- 📖 [**Guía de Despliegue en Servidor Propio (Ubuntu/Debian)**](docs/DEPLOY.md)
- 🤖 [**Guía de Configuración de Claves de IA Gratuitas**](docs/AI-PROVIDERS.md)

---

## 📄 Licencia

Este proyecto está licenciado bajo los términos de la **Licencia MIT**. Consulta el archivo [LICENSE](LICENSE) para más detalles.

Creado con ❤️ por [Manuel Francisco Amell Gil](https://github.com/ManuelAmell) · 2026
