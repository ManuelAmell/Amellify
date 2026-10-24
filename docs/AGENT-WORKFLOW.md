# Flujo de trabajo con agentes

Guía paso a paso para sacar una feature adelante con el ciclo `/plan` → `/implementar` → `/audit`, y su variante multi-agente con Orca. Reglas completas en `CONTRACT.md`. Este archivo solo dice el orden de los pasos.

## Roles

- **Claude Code (Tech Lead y Auditor):** `tests/`, `PLAN.md`, ramas `feature/<slug>`, commits y la definición de "correcto".
- **Antigravity (`agy`, Implementador):** `src/`. No edita tests, no crea ramas, no commitea.
- **Persona:** decide ante ambigüedad y es quien escala si el ciclo no converge.

Claude Code tiene denegadas las escrituras en `src/` (`.claude/settings.json`: `Edit(src/**)` y `Write(src/**)`). Si necesita tocar `src/`, lo hace Antigravity.

## Piezas del repo

| Pieza | Ruta | Para qué |
| --- | --- | --- |
| Contrato | `CONTRACT.md` | Reglas de oro, prohibiciones y definición de "rojo válido" y "verde" |
| Instrucciones de proyecto | `CLAUDE.md`, `AGENTS.md` | Roles y comandos; `AGENTS.md` añade la nota de Next.js 16 |
| Comandos de Claude Code | `.claude/commands/plan.md`, `implementar.md`, `audit.md` | Los tres pasos del ciclo |
| Subagentes | `.claude/agents/architect.md`, `implementer.md`, `auditor.md` | Roles delegables |
| Reglas de Antigravity | `.agents/rules/executor.md`, `.agents/workflows/implementar.md` | Qué puede tocar y cómo informa |
| Skill del proyecto | `.claude/skills/amellify-agentes/SKILL.md` | Preferencias de delegación, Orca y OpenCode |
| Evidencia visual | `.artifacts/verification/` | Capturas y `VERIFICATION.md` |

## Ciclo básico

### 1. Planificar (`/plan <tarea>`, Claude Code)

1. **Reconocimiento.** Leer el código que toca la tarea y citar los archivos reales. No diseñar sobre suposiciones.
2. **Preguntas.** Si una ambigüedad cambia el diseño (contrato de la API, forma del error, permisos, persistencia), preguntar. Máximo tres preguntas.
3. **Rama.** `git checkout -b feature/<slug>` (kebab-case, tres palabras o menos).
4. **`PLAN.md`** con solo estas secciones: Objetivo, Decisiones de diseño, Archivos (lista cerrada), Checklist, Rojo esperado y BASE_TESTS.
5. **Tests.** Escribirlos en `tests/`. Deben cubrir camino feliz, al menos dos casos borde, un caso de error con tipo y mensaje, y una entrada inválida si hay entrada externa.
6. **Rojo válido.** Ejecutar `pnpm run verify`. Cada test nuevo falla en una aserción. Si falla por import o módulo inexistente, crear en `src/` solo el andamiaje mínimo (funciones que lancen `NotImplementedError`). Pegar la salida en "Rojo esperado".
7. **Commit contrato.** `git add` de `tests/`, `PLAN.md` y el andamiaje. Commit `test(<slug>): suite en rojo para <feature>`. El SHA va en `PLAN.md` bajo BASE_TESTS.
8. **Cierre.** Tres líneas: qué se delega, cuántos tests hay y el comando para Antigravity.

### 2. Implementar (`/implementar`, Antigravity)

Claude Code lanza al implementador en modo headless:

```bash
agy -p "/implementar" --dangerously-skip-permissions --print-timeout 15m
```

Antigravity debe:

1. Leer `FEEDBACK.md` si existe (prioridad absoluta), luego `PLAN.md`, `CONTRACT.md` y la especificación en `tests/`.
2. Implementar archivo por archivo, solo dentro de la lista cerrada de `PLAN.md`.
3. Repetir `pnpm run verify` hasta verde. Sin cambiar de estrategia por frustración: tras cinco intentos sin progreso sobre el mismo test, detenerse y explicar.
4. Comprobar `git diff --name-only -- tests/` (debe salir vacío).
5. Si hay interfaz, levantar la app, guardar capturas en `.artifacts/verification/` y escribir `VERIFICATION.md`.
6. Responder con el bloque de informe final de `.agents/workflows/implementar.md`.

Al terminar, Claude Code hace una comprobación preliminar (`/implementar`, punto 3): `git diff --name-only <BASE_TESTS> -- tests/` y revisión del alcance. Si hay cambios en `tests/`, los revierte con `git checkout -- tests/` e informa.

### 3. Auditar (`/audit`, Claude Code)

Comprobaciones en orden. Cada una imprime PASA o FALLA con evidencia:

1. **Integridad del contrato:** `git diff --name-only <BASE_TESTS> -- tests/` debe salir vacío. Si no, falla de inmediato.
2. **Alcance:** `git diff --name-only <BASE_TESTS>..HEAD` contra la lista de `PLAN.md`.
3. **Verde real:** Claude Code ejecuta `pnpm run verify` él mismo y pega la salida completa.
4. **Antipatrones:** skip, xfail, `.only`, `any`, `@ts-ignore`, `eslint-disable`, `sleep`, `setTimeout` en tests, catch vacío, valores a fuego, funciones de más de ~40 líneas, consultas en bucle y entradas sin validar.
5. **Evidencia visual:** si toca interfaz, buscar capturas y `VERIFICATION.md`. Sin ellas, lo visual queda como NO VERIFICADO (no bloquea por sí solo).
6. **Coherencia con el plan:** recorrer el checklist de `PLAN.md`.
7. **Veredicto:**
   - Sin bloqueantes: marcar el checklist, borrar `FEEDBACK.md` si existe, y commitear `feat(<slug>): ...` con un cuerpo que resuma las decisiones reales.
   - Con bloqueantes: escribir `FEEDBACK.md` con `ITERACION`, `BLOQUEANTE` y `NO BLOQUEANTE`, y volver al paso 2.

Límite: máximo dos rondas de `FEEDBACK.md` por tarea. En la tercera, el ciclo se detiene y se escala a la persona.

## Variante multi-agente con Orca

Útil cuando la implementación y el testing corren en paralelo a la conversación. Preferencias y comandos completos en `.claude/skills/amellify-agentes/SKILL.md`. Resumen:

1. **Plan y tests** como en el ciclo básico, en la rama `feature/<slug>` del coordinador (Claude Code).
2. **Run:** `orca orchestration run-create --objective "<feature>"`.
3. **Worker implementador:** `orca orchestration worker-start --spec "<spec>" --worktree new-top-level --agent opencode` (o Antigravity vía `agy`). La spec debe decir explícitamente: no commitear, no tocar `tests/`, tocar solo los archivos de `PLAN.md`, y no ejecutar `pnpm format`.
   - OpenCode toma el modelo de un `opencode.json` local en el worktree (`{"model":"opencode/glm-5.3-flash-free"}`), no commiteado.
4. **Esperar y leer:** `orca orchestration check --run <run_id> --wait` y `worker-read --dispatch <id>`.
5. **Auditar el worktree del worker antes de aceptar:**
   ```bash
   git -C <worktree> status --short
   git -C <worktree> diff --stat
   git -C <worktree> diff --name-only -- tests/
   ```
   Revertir lo fuera de alcance. Si el worker tocó `tests/`, revertir e informar.
6. **Commit:** los cambios de `src/` están sin commitear en el worktree del worker. Antes de commitear, confirmar con `git -C <worktree> branch --show-current` que está en `feature/<slug>`. El commit lo hace Claude Code, nunca el worker.
7. **Testing:** después de que los implementadores terminen, mandar a `command-code` a correr `pnpm run verify` y, si aplica, e2e (`docs/TESTING.md`). La salida real es la única evidencia válida.
8. **Liberar:** `orca orchestration worker-release --dispatch <id>` cuando el worker esté asentado.
9. **Auditoría final** con `/audit` en el worktree que contiene los cambios.

**Verificado:** `--agent opencode` y `--agent command-code` son ids válidos; `--worktree new-top-level` crea la rama `<usuario-git>/<name>`, no `feature/<slug>`, así que hay que renombrarla (`git branch -m feature/<slug>`) antes de commitear. Sin verificar: si `--agent` acepta `agy`.

## Errores frecuentes

- Trabajar o commitear en `main`. Toda tarea va en `feature/<slug>`.
- Dejar que un agente corra `pnpm format` sobre el repo entero (reformateó ~100 archivos en una ocasión).
- Dar "verde" sin pegar la salida de `pnpm run verify`.
- Matar procesos con `pkill -f <patrón>` desde una shell de agente: el patrón coincide con la propia línea de comando. Usar pid o `pgrep -x`.
- Añadir `sleep` o reintentos para esquivar flakiness. Se investiga la causa (por ejemplo, el rate-limit de Better Auth en `docs/TESTING.md`).
