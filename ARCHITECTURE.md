# Arquitectura de Amellify

Descripción de cómo está montado el proyecto hoy, según el código. Si algo de aquí contradice al código, manda el código.

## Stack

| Capa | Tecnología | Dónde se ve |
| --- | --- | --- |
| Framework | Next.js 16 (App Router), React 19 | `next.config.ts`, `src/app/` |
| Estilos | Tailwind CSS 4 (`@tailwindcss/postcss`) | `src/app/globals.css`, `postcss.config.mjs` |
| Datos | PostgreSQL 17 (imagen `postgres:17-alpine`), Drizzle ORM, driver `postgres` | `src/db/`, `drizzle/`, `docker-compose.yml` |
| Auth | Better Auth (email/contraseña; GitHub y Google solo si hay variables) | `src/lib/auth/` |
| IA | Vercel AI SDK (`ai`) con `@ai-sdk/google`, `@ai-sdk/groq`, `@ai-sdk/openai-compatible` | `src/lib/ai/` |
| Validación | Zod 4 | `src/lib/validation/`, `src/lib/actions/utils.ts` |
| PWA | Serwist (`@serwist/next`, `serwist`) | `src/app/sw.ts`, `src/app/manifest.ts`, `next.config.ts` |
| Tests | Vitest (unit, jsdom), Playwright (e2e), Testing Library | `tests/`, `vitest.config.ts`, `playwright.config.ts` |
| Gestor de paquetes | pnpm 10.33.2, Node >= 22 | `package.json` |

## Estructura de `src/`

- `src/app/`: rutas (App Router).
  - `(auth)/`: `login/` y `reset-password/`.
  - `(app)/`: páginas protegidas `dashboard/`, `courses/`, `calculator/`, `stats/`, `settings/`. Su `layout.tsx` llama a `requireUser()` y precarga cursos y perfil.
  - `api/auth/[...all]/route.ts`: handler de Better Auth.
  - `api/auth/providers/route.ts`: qué métodos de auth están activos.
  - `api/ai/extract-schedule/route.ts`: escáner de horarios (POST).
  - `api/health/route.ts`: healthcheck usado por Docker. Ejecuta `SELECT 1` y responde 503 si la base no responde.
  - `sw.ts`, `manifest.ts`, `layout.tsx`, `globals.css`: PWA y raíz.
- `src/components/`: componentes por dominio (`ai/`, `ambient/`, `calculator/`, `courses/`, `layout/`, `schedule/`, `settings/`, `stats/`) y primitivas en `ui/`.
- `src/lib/`:
  - `actions/`: Server Actions (`courses.ts`, `profile.ts`, `partials.ts`) y helpers en `utils.ts`.
  - `ai/`: `providers.ts` (construye la lista de proveedores desde variables de entorno), `cascade.ts` (ejecuta la cascada), `schema.ts` y `validation.ts`.
  - `auth/`: `auth.ts` (configuración de Better Auth), `session.ts` (`getCurrentSession`, `requireUser`, `getApiUser`), `client.ts`, `mailer.ts`, `redirect.ts`.
  - `utils/`: cálculo de notas (`grades.ts`), solapamiento de bloques (`overlap.ts`), tiempo (`time.ts`).
  - `validation/`: esquemas Zod de curso, parcial, perfil y datos de respaldo.
  - `ics-export.ts`, `rate-limit.ts`, `utils.ts`.
- `src/db/`:
  - `schema.ts`: fuente única del esquema (Amellify y tablas de Better Auth).
  - `index.ts`: cliente `postgres` + `drizzle`, con pool de 10. Falla al arrancar si falta `DATABASE_URL`.
  - `queries/`: consultas (`courses.ts`, `profile.ts`) y mapeadores (`mappers.ts`).
  - `auth-schema.ts`: solo referencia de regeneración con `pnpm auth:generate`. Nada lo importa.
  - `seed.ts`: `pnpm db:seed`.
- `src/proxy.ts`: guarda de rutas (ver "Flujo de datos").
- `src/config/`: navegación (`nav.ts`) y colores de materias (`subject-colors.ts`).
- `src/types/`: `database.ts`, `domain.ts` (incluye `ActionResult`).

Tablas (`src/db/schema.ts`): `user` (con campos de perfil y `preferences` en jsonb), `session`, `account`, `verification`, `courses`, `schedules`, `partials`. Enums: `course_status`, `day_of_week`, `subject_color`.

## Flujo de datos

### Lectura y escritura: Server Actions

1. Los componentes cliente llaman a funciones con `'use server'` de `src/lib/actions/`.
2. Cada acción obtiene el usuario con `requireUser()` (que redirige a `/login` si no hay sesión). Ese `redirect` no debe ir dentro de un `try/catch`.
3. La entrada se valida con Zod (`src/lib/validation/`) antes de tocar la base.
4. Las consultas van en `src/db/queries/` con Drizzle. Las comprobaciones de propiedad (`assertCourseOwnership`) viven ahí.
5. La acción devuelve `ActionResult<T>` (`{ ok, data }` o `{ ok, error, fieldErrors }`). Los errores pasan por `toActionError`, que nunca expone errores crudos de Postgres: mapea `23505`, `23503` y `23514` a mensajes en español.
6. Las lecturas usan `cache()` de React para deduplicar dentro de una petición.

### Autenticación

- `src/lib/auth/auth.ts` configura Better Auth con el adaptador de Drizzle y el esquema de `src/db/schema.ts`.
- Contraseña mínima de 8 caracteres. Recuperación de contraseña y verificación de correo solo si `SMTP_HOST` está definido.
- `src/proxy.ts` comprueba solo que exista la cookie de sesión (`getSessionCookie`) para redirigir a `/login` en `/dashboard`, `/courses`, `/calculator`, `/stats` y `/settings`. Falla cerrado. La validación real de la sesión ocurre en `requireUser()` dentro de los Server Components.
- En Route Handlers se usa `getApiUser()` y se responde 401 en lugar de redirigir.

### Cascada de IA (escáner de horarios)

- `POST /api/ai/extract-schedule` exige sesión (401 si no la hay) y limita a 5 peticiones por minuto por usuario con un token bucket en memoria (`src/lib/rate-limit.ts`). Es válido solo con una instancia.
- El cuerpo admite hasta 5 imágenes (PNG, JPEG o WebP) o un PDF, y texto de hasta 20.000 caracteres. El límite de cuerpo es 6 MB para imágenes y 15 MB para PDF.
- El cliente no puede elegir modelo. `getActiveProviders()` arma la lista en orden desde variables de entorno: gateway propio (`AI_GATEWAY_URL` + `AI_GATEWAY_KEY`), Google, Groq, OpenRouter (lista `OPENROUTER_FREE_MODELS`, un modelo por entrada) y Mistral. Cada proveedor entra solo si tiene su clave.
- `cascade.ts` llama `generateObject` con el esquema de horario por cada proveedor en orden. Ante error, registra un enfriamiento por proveedor: backoff exponencial de 1 min a 15 min para cualquier error que no sea de esquema (429, 5xx, timeout, etc.; respeta `Retry-After`), y 5 s para salida con esquema inválido. Timeout de 25 s, o 60 s con PDF.
- Solo Google acepta PDF (`supportsPdf`). Si la petición trae PDF, se filtran los demás proveedores.
- Las instrucciones del sistema van en `instructions`, separadas del contenido del usuario, que viaja como mensaje `user`. Es la mitigación contra inyección de instrucciones.
- Se registra con pino qué proveedor respondió (`ai_extract_schedule_exhausted` si todos fallan), sin claves ni cuerpos de error del proveedor.

### PWA (Serwist)

- `next.config.ts` envuelve la config con `withSerwist` (`swSrc: src/app/sw.ts`, `swDest: public/sw.js`). Deshabilitado en `development`.
- `src/app/sw.ts` define estrategias: páginas de navegación con `NetworkFirst` (timeout de 3 s, caché de 7 días), fuentes con `CacheFirst`, iconos e imágenes con `StaleWhileRevalidate`, y `/_next/static/` con `CacheFirst`.
- `src/app/manifest.ts` genera `/manifest.webmanifest` (`start_url: /dashboard`, modo `standalone`). `public/manifest.json` existe pero no es el que se sirve.
- `sw.js` no pasa por `src/proxy.ts`.

### Cabeceras de seguridad

`next.config.ts` añade a todas las rutas: `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy` y `Permissions-Policy` (cámara, micrófono y geolocalización desactivados). Caddy añade HSTS.

## Despliegue

### Imagen Docker (`Dockerfile`)

Tres etapas sobre `node:22-alpine`: `deps` (instala con `--frozen-lockfile`), `builder` (`pnpm build`, con valores placeholder de `DATABASE_URL` y `BETTER_AUTH_SECRET` solo para el build) y `runner` (copia `.next/standalone`, `.next/static`, `public`, `drizzle/` y `src/db/schema.ts`, y corre como usuario `nextjs` con `node server.js` en el puerto 3000).

### Compose (`docker-compose.yml`)

- `db`: `postgres:17-alpine`, con healthcheck `pg_isready`. Sin puerto publicado por defecto.
- `migrate`: usa el target `builder` y ejecuta `pnpm db:migrate` (`drizzle-kit migrate`). Espera a que `db` esté sano.
- `app`: imagen de producción en `3000:3000`. Espera a `db` sano y a `migrate` completado. Healthcheck sobre `/api/health`.
- `caddy` (perfil `proxy`): reverse proxy con HTTPS automático, `Caddyfile` en la raíz. Proxy a `app:3000` y cabeceras `X-Forwarded-*`.
- `backup` (perfil `backup`): `pg_dump` periódico con `scripts/backup.sh`, retención configurable.

Migraciones: `drizzle/` contiene las SQL generadas (hoy solo `0000_damp_prowler.sql`) y `drizzle/meta/`. Se generan con `pnpm db:generate` y se aplican con `pnpm db:migrate`.

Variables: `.env.example` documenta todas. Las de Compose (`POSTGRES_*`, `DOMAIN`, `ACME_EMAIL`, `BACKUP_*`) se leen del `.env` del host.

Guía de operación: `docs/DEPLOY.md`.

## CI (`.github/workflows/ci.yml`)

Se dispara en `push` y `pull_request` contra `main`. Tres jobs:

1. `check`: `pnpm typecheck`, `pnpm lint` y `pnpm test` (unit).
2. `build` (necesita `check`): build de la imagen Docker, sin push.
3. `e2e` (necesita `check`): levanta `db`, corre `migrate`, levanta `app` con `docker compose up -d --wait` y ejecuta `pnpm test:e2e --project=chromium` con `PLAYWRIGHT_BASE_URL=http://localhost:3000`. Sube el reporte como artefacto y baja el stack al final.

Local, `pnpm run verify` cubre lo mismo que `check` (lint, typecheck, unit). La e2e no entra en `verify` (ver `CONTRACT.md`).
