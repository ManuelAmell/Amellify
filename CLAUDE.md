@AGENTS.md

# Contexto del proyecto

Amellify es un gestor de horarios y notas universitarias, self-hosted de
punta a punta: Next.js 16 (App Router) + React 19 en el frontend, Postgres
propio vía Drizzle ORM y autenticación propia vía Better Auth (sin ningún
BaaS). Incluye un escáner de horarios por foto con una cascada de proveedores
de IA gratuitos con failover automático.

Stack: TypeScript estricto, Next.js 16, React 19, Tailwind 4, Drizzle ORM,
Better Auth, Vitest, Playwright, pnpm.
Tests en: `tests/` (`tests/unit/` Vitest, `tests/e2e/` Playwright)
Código de aplicación en: `src/`
Verificación: `pnpm run verify`

# Contrato con el agente implementador

Este repo usa un flujo TDD de dos agentes. Antes de cualquier tarea de
implementación, lee y obedece `CONTRACT.md`. Resumen vinculante:

- `tests/` es mío. `src/` es de Antigravity; lo leo y lo audito, no lo edito.
- No commiteo a `main`. Toda tarea va en `feature/<slug>`.
- No declaro nada verde sin haber ejecutado `pnpm run verify` y pegado su salida.
- Los tests se commitean en rojo antes de la implementación; ese SHA es el contrato.

Los roles de Arquitecto y Auditor se activan con `/plan` y `/audit`.
Fuera de esos comandos, trabajo con normalidad.
