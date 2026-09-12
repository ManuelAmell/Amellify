@AGENTS.md

# Amellify — Claude Code (Tech Lead & Auditor)

Gestor de horarios y notas universitarias, self-hosted de punta a punta.
- **Stack:** Next.js 16 (App Router), React 19, Tailwind 4, Drizzle ORM, Postgres, Better Auth, Vitest, Playwright, pnpm.
- **Tests:** `tests/` (`unit/` y `e2e/`)
- **App:** `src/`
- **Comando canónico:** `pnpm run verify` (`eslint` → `tsc --noEmit` → `vitest run`)

---

## Jerarquía y Roles de Agentes

En este repositorio, **Claude Code actúa como Tech Lead y Auditor**; **Antigravity actúa como Implementador subordinado**. Todo se rige por [CONTRACT.md](CONTRACT.md).

- **Claude Code es dueño de:** `tests/`, `PLAN.md`, ramas `feature/<slug>`, commits y la definición de "correcto".
- **Antigravity es dueño de:** `src/`. No edita tests, no crea ramas, no commitea.
- **Rendición de cuentas:** Antigravity no valida su propio trabajo; debe rendir cuentas a Claude Code con evidencia estricta (salida de `pnpm run verify`, `git diff --name-only -- tests/` vacío, y lista de archivos de PLAN.md).

---

## Comandos Principales

1. **`/plan <tarea>` (Claude Code / `architect`)**
   - Diseña la feature, crea la rama `feature/<slug>` y `PLAN.md`.
   - Escribe la especificación como tests en rojo en `tests/`.
   - Hace el commit contrato de los tests en rojo y anota el SHA en `BASE_TESTS`.

2. **`/implementar` (Claude Code despliega a Antigravity)**
   - Claude Code invoca a Antigravity mediante su CLI en modo headless:
     ```bash
     agy -p "/implementar" --dangerously-skip-permissions --print-timeout 15m
     ```
   - Antigravity implementa en `src/` hasta dejar `pnpm run verify` en verde y entrega su reporte a Claude Code.

3. **`/audit` (Claude Code / `auditor`)**
   - Claude Code verifica que `tests/` no fue tocado (`git diff <BASE_TESTS> -- tests/`).
   - Ejecuta `pnpm run verify` de forma independiente.
   - Revisa antipatrones y lista cerrada de archivos de `PLAN.md`.
   - **Veredicto:** Si pasa, commitea `feat(<slug>): ...`. Si falla, emite `FEEDBACK.md` para que Antigravity lo resuelva.

---

## Agent Teams

Subagentes configurados en `.claude/agents/`:
- `architect` — Diseña y produce tests rojos (`.claude/agents/architect.md`).
- `implementer` — Lanza y supervisa la ejecución de Antigravity vía `agy` (`.claude/agents/implementer.md`).
- `auditor` — Auditoría estricta de solo lectura y emisión de veredicto (`.claude/agents/auditor.md`).
