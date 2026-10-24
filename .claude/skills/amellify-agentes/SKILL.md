---
name: amellify-agentes
description: Preferencias de trabajo con agentes en Amellify. Usar al planificar, delegar o auditar trabajo con Antigravity (agy), OpenCode o command-code, al orquestar workers con Orca CLI, o al crear worktrees y ramas feature/<slug>. Cubre roles, orquestación, modelo de OpenCode, reglas de seguridad al delegar y testing.
---

# Agentes en Amellify

Fuente única de verdad: `CONTRACT.md`. Si esta skill contradice a `CONTRACT.md`, manda `CONTRACT.md`.

## Regla de oro: Claude Code solo orquesta

Regla fijada por el dueño del repo. Tiene prioridad sobre el resto de esta skill cuando haya duda.

- **Claude Code solo orquesta y revisa.** No edita archivos: ni `src/`, ni `tests/`, ni config, ni CI, ni docs. Como mucho hace correcciones mínimas de revisión; todo cambio real se delega.
- **Siempre se mandan agentes:**
  - `command-code`: testing, CI, config, housekeeping y tests.
  - `opencode`: implementación y tests de UI. Modelo GLM-5.3-Flash Free con esfuerzo `max`, fijado por el `opencode.json` local no commiteado (ver "OpenCode: modelo y esfuerzo").
  - Haiku (subagente de Claude Code con `model: haiku`): documentación.
- **Un agente a la vez** como regla general. Como máximo dos, y solo en worktrees distintos, para no saturar el PC.
- **Esperar sin polling:** `orca orchestration check --run <run_id> --wait` en vez de consultar en bucle. Al terminar, `worker-release`.
- **Lo que hace Claude Code:** crear el run y los workers en Orca, leer los reportes, verificar de forma independiente con `pnpm run verify` (solo lectura), revisar `git status` y el diff de cada worktree. Commitea o abre PR solo cuando la persona lo autoriza. **Nunca fusiona a `main` sin permiso explícito.**
- **Cada spec a un agente debe decir:** no commitear; no `pnpm format` global; alcance con lista cerrada de archivos; y que el shell de `command-code` corta a los 30 s, así que las tareas largas van en segundo plano con log en disco que se consulta después.
- **Evidencia en disco.** El mensaje `worker_done` de Orca no es legible tras leerlo. Pedir a cada agente que deje su evidencia (salida de comandos, resultado) en un log dentro del worktree, fuera de git, y leer ese log.

## Roles

- **Claude Code = Tech Lead y Auditor.** Dueño de `tests/`, `PLAN.md`, las ramas `feature/<slug>`, los commits y la definición de "correcto".
- **Antigravity (`agy`) = Implementador.** Dueño de `src/`. No edita `tests/`, no crea ramas, no commitea.
- **Nunca se trabaja ni se commitea en `main`.** Cada tarea vive en `feature/<slug>` (kebab-case, tres palabras o menos).
- Ciclo: `/plan` → `/implementar` → `/audit`. Detalle en `docs/AGENT-WORKFLOW.md`.

## Orquestación con Orca CLI

Usar `orca orchestration` (versión verificada: `orca` 1.4.232; los subcomandos y flags de abajo se comprobaron con `--help`).

1. Crear el run, con su objetivo:
   ```bash
   orca orchestration run-create --objective "<objetivo>"
   ```
2. Lanzar un worker por agente, cada uno en su propio worktree nuevo:
   ```bash
   orca orchestration worker-start --spec "<especificación>" --worktree new-top-level --agent <id>
   ```
   - Hace falta `--task <task_id>` o `--spec <texto>`, y `--agent <id>` o `--terminal <handle>`.
   - Agentes disponibles: `command-code` (testing y housekeeping), `opencode` (implementación), y Antigravity vía `agy` (ver `.claude/commands/implementar.md`; si Orca no acepta `agy` como `--agent`, no está verificado y hay que lanzarlo a mano en su worktree).
3. Esperar el reporte. Inspeccionar el estado con:
   ```bash
   orca orchestration worker-list --run <run_id>
   orca orchestration check --run <run_id> --wait --timeout-ms <ms>
   orca orchestration worker-show --dispatch <dispatch_id>
   ```
4. Leer la salida acotada del worker:
   ```bash
   orca orchestration worker-read --dispatch <dispatch_id>
   ```
5. Liberar la terminal solo cuando el worker esté asentado:
   ```bash
   orca orchestration worker-release --dispatch <dispatch_id>
   ```

Los worktrees creados por Orca viven bajo `/home/amell/orca/workspaces/Amellify/<nombre>` (visibles con `git worktree list`).

## OpenCode: modelo y esfuerzo

- Orca no puede fijar el modelo de OpenCode al lanzar: `worker-start --model` responde `capability_unsupported` ("This OpenCode TUI cannot verify launch-time model selection"), verificado. Por eso el modelo se fija con un `opencode.json` local en la raíz del worktree:
  ```json
  {"model":"opencode/glm-5.3-flash-free"}
  ```
- Este archivo **no se commitea**. Comprobar con `git status` que no aparece. No añadirlo a `.gitignore` sin decidirlo antes.
- Modelo preferido: `opencode/glm-5.3-flash-free` (GLM-5.3-Flash Free), esfuerzo `max`.
- Ver modelos disponibles con `opencode models`.
- No pasar `--model` con `opencode`; omitirlo y usar el `opencode.json`. El archivo no se commitea ni se toca desde el worker.
- `--agent opencode` y `--agent command-code` son ids válidos (verificado). `--agent cmd` no lo es.
- Con `--worktree new-top-level --name <n>` Orca crea la rama `<usuario-git>/<n>` (p. ej. `ManuelAmell/test-ui-coverage`), no `feature/<slug>`: renombrarla con `git branch -m` al auditar.

## Reglas de seguridad al delegar

En cada spec que se envía a un worker, escribir explícitamente:

- **NO commitear.** Los commits los hace Claude Code.
- **NO tocar `src/`** si la tarea no es de implementación. **NO tocar `tests/`** nunca (salvo que el agente sea el Tech Lead).
- **NO ejecutar `pnpm format` ni `prettier --write .`** sobre el repo. Un agente reformateó ~100 archivos y hubo que revertir. Formatear solo los archivos del alcance, si hace falta.
- Lista cerrada de archivos (la de `PLAN.md`). Lo que esté fuera, no se toca.
- Sin `sleep` ni reintentos ciegos para esquivar flakiness. La causa se investiga.

Antes de aceptar el trabajo de cualquier worker, auditar su worktree:

```bash
git -C <worktree> status --short
git -C <worktree> diff --stat
git -C <worktree> diff --name-only -- tests/   # debe estar vacío
```

- Revertir lo que se salga del alcance: `git -C <worktree> checkout -- <archivo>`. Los archivos nuevos sin seguimiento se borran a mano, tras revisar que son del worker y no del usuario.
- Si el worker tocó `tests/`, revertir esos archivos e informar de inmediato. Es violación del contrato.

## Testing

- Se manda a `command-code` a testear (`pnpm run verify`, y e2e si aplica) **después** de que los implementadores terminen, no en paralelo con ellos.
- `pnpm run verify` es el único "verde" válido. Se pega la salida real; ningún agente declara verde de palabra.
- La suite e2e (`pnpm test:e2e`) no entra en `verify`. Ver `docs/TESTING.md`.
- Lecciones del proyecto para los agentes de testing:
  - El shell de `command-code` trae `NODE_ENV=production`. Vitest ya fija `NODE_ENV=test`, pero cualquier otro comando hereda el valor (p. ej. el rate-limit de Better Auth se activa en producción, ver `docs/TESTING.md`).
  - El e2e falló en CI por un heredoc indentado en `.github/workflows/ci.yml`. No usar heredocs indentados en los pasos de CI.
  - `.env.example` deja `BETTER_AUTH_SECRET` vacío. Para e2e local o en CI hay que darle valor (ver `.github/workflows/ci.yml`).

## Procesos

- **No usar `pkill -f <patrón>` desde una shell de agente.** El patrón coincide con la propia línea de comando y mata la shell. Usar el pid concreto o `pgrep -x <nombre>` y matar por pid.

## Límites

- Máximo 2 rondas de `FEEDBACK.md` por tarea. En la tercera, el ciclo se detiene y se escala a la persona (`CONTRACT.md`).
- Instalar dependencias nuevas requiere confirmación previa de la persona.
