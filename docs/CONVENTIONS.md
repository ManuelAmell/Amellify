# Convenciones

Convenciones de código, commits y ramas en Amellify, tomadas de la configuración del repo y del código existente. Lo que contradiga `CONTRACT.md` lo gana `CONTRACT.md`.

## Commits

Formato semántico: `tipo(alcance): descripción en minúsculas`.

Tipos y ejemplos reales del historial:

- `feat(<slug>): ...` tras un `/audit` aprobado (Claude Code). Ejemplo: `feat(project-polish): iconos PWA reales, resiliencia de PDF, ...`.
- `test(<slug>): suite en rojo para <feature>` para el commit contrato de `/plan`. Ejemplo: `test(pdf-schedule-upload): suite en rojo para pdf-schedule-upload`.
- `docs(<slug>): registra BASE_TESTS en PLAN.md` para anotar el SHA del contrato.
- `fix(e2e): ...`, `fix(v3): ...` para correcciones.
- `docs: ...` sin alcance para documentación general.
- `chore(agents): ...` o `chore: ...` para configuración de agentes y herramientas.

Reglas:

- El cuerpo del commit de `feat` resume las decisiones de diseño reales, no una lista de archivos.
- Solo Claude Code commitea. Antigravity y los workers de Orca no commitean.
- No se commitea en `main`. No se hace push ni merge sin pedirlo.

## Ramas

- `feature/<slug>`: tareas de la feature, kebab-case, tres palabras o menos. Ej.: `feature/fix-image-part`.
- `fix/<slug>` para correcciones que no son una feature. Ej.: `fix/e2e-standalone-webserver` (mencionada en `PLAN.md` del historial).
- `docs/<slug>` para documentación. Ej.: `docs/agent-workflow`.
- `main` es el destino de los PR y no se toca directamente.

## Código TypeScript y React

Herramientas y reglas del repo:

- **Prettier** (`.prettierrc.json`): sin punto y coma, comillas simples, `printWidth: 100`, `trailingComma: es5`, y el plugin de Tailwind para ordenar clases. `pnpm format:check` solo comprueba. **No ejecutar `pnpm format` sobre el repo entero** (reformateó ~100 archivos en una ocasión). Formatear solo los archivos tocados.
- **TypeScript estricto** (`tsconfig.json`: `strict` y `noUncheckedIndexedAccess`). Alias `@/*` apunta a `src/*`.
- **ESLint** (`eslint.config.mjs`): `pnpm lint` corre con `--max-warnings=0`, así que las advertencias fallan `verify`. `no-explicit-any` es advertencia, pero como no hay tolerancia a warnings, en la práctica falla.
- Variables no usadas con prefijo `_` para ignorarlas.
- Nombres de código en inglés (`getCourses`, `computeWeightedAverage`). Textos de UI, comentarios y mensajes de error en español.
- Un componente cliente empieza con `'use client'`. Los Server Components son el valor por defecto.

## Server Actions y rutas

- Toda acción en `src/lib/actions/` empieza con `'use server'`, obtiene el usuario con `requireUser()` y valida la entrada con Zod antes de llegar a la base.
- Devuelve `ActionResult<T>` (`src/types/domain.ts`), no lanza al cliente. Los errores pasan por `toActionError`.
- `requireUser()` redirige con `NEXT_REDIRECT`. **Nunca va dentro de un `try/catch`** que pueda tragárselo.
- En Route Handlers, comprobar con `getApiUser()` y responder 401 en lugar de redirigir.
- Nunca enviar errores crudos de Postgres al cliente.
- Las lecturas repetidas por petición se deduplican con `cache()` de React.

## Base de datos

- El esquema vive en `src/db/schema.ts`. Es la única fuente de verdad, incluidas las tablas de Better Auth.
- No importar `src/db/auth-schema.ts` (es solo referencia de regeneración).
- Cambios de esquema: editar `schema.ts`, ejecutar `pnpm db:generate`, revisar el SQL nuevo en `drizzle/` y commitir SQL y `drizzle/meta/`. Se aplica con `pnpm db:migrate`.
- Recomendación: no editar una migración ya aplicada; generar una nueva.

## Entorno y configuración

- Toda variable nueva se documenta en `.env.example`. No se commitean `.env` ni secretos (`.gitignore`).
- Ninguna credencial, token o ruta absoluta de la máquina en el código (`CONTRACT.md`).
- Las variables de Compose (`POSTGRES_*`, `DOMAIN`, `ACME_EMAIL`, `BACKUP_*`) son para Docker y no para la app.

## Estilos y componentes

- Colores y sombras vía tokens de `src/app/globals.css`. Sin hex literal nuevo en componentes.
- Sin clases de Tailwind generadas dinámicamente (`bg-subject-${color}`). Usar `SUBJECT_COLOR_CLASSES`.
- Variantes de botón y tarjeta vía `cva` y `GlassCard tier`, no con clases sueltas repetidas.
- Animaciones de bucle siempre detrás de `motion-safe:`.

Detalle en `DESIGN.md`.

## Dependencias

- No añadir dependencias ni patrones nuevos sin avisar y esperar confirmación (`.agents/rules/executor.md`).
- `package.json` tiene `prepare: husky` y `lint-staged` en devDependencies, pero el repo no tiene directorio `.husky/` ni configuración de `lint-staged` que se haya encontrado. No asumir que hay hooks de pre-commit activos.

## Qué no hacer

- No commitear en `main` ni cambiar de rama sin pedirlo.
- No editar `tests/` si eres Antigravity o un worker. Tampoco "arreglar" un test que parezca mal escrito: detenerse y avisar.
- No usar `skip`, `only`, `xfail`, `.todo`, `any`, `@ts-ignore`, `eslint-disable` ni `noqa` sin justificación escrita.
- No añadir `sleep`, `setTimeout` ni reintentos ciegos para pasar tests o esquivar rate-limits.
- No dejar catch vacíos ni que se traguen errores.
- No mockear el propio sujeto bajo prueba.
- No tocar archivos fuera de la lista cerrada de `PLAN.md`.
- No ejecutar `pnpm format` sobre el repo entero, ni `pkill -f` desde una shell de agente.
