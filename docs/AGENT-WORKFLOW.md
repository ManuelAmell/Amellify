# Flujo de trabajo con agentes

Guía paso a paso para sacar una feature adelante con el ciclo `/plan` → `/implementar` → `/audit`, y su variante multi-agente con Orca. Reglas completas en `CONTRACT.md`. Este archivo solo dice el orden de los pasos.

## Roles

- **Claude Code (Orquestador y Auditor de solo lectura):** define la tarea, delega, lee reportes, verifica con `pnpm run verify` y revisa diffs. Es dueño de la definición de "correcto", `tests/`, `PLAN.md`, `FEEDBACK.md`, ramas `feature/<slug>` y commits, pero no los edita: los encarga.
- **`command-code` (escritor de tests y housekeeping):** escribe `tests/`, `PLAN.md`, `FEEDBACK.md`, y se encarga de CI, config y housekeeping, por encargo de Claude Code. No edita `src/`.
- **Implementador (`opencode` por defecto; Antigravity vía `agy` como alternativa opcional):** `src/`. No edita tests, no crea ramas, no commitea.
- **Persona:** decide ante ambigüedad, autoriza los commits y es quien escala si el ciclo no converge.

Claude Code tiene denegadas las escrituras en `src/` (`.claude/settings.json`: `Edit(src/**)` y `Write(src/**)`). Si necesita tocar `src/`, lo hace el implementador.

### Regla de trabajo: Claude Code solo orquesta

Regla fijada por el dueño del repo. Detalle y specs en `.claude/skills/amellify-agentes/SKILL.md` (sección "Regla de oro").

- Claude Code no edita archivos (ni `src/`, `tests/`, config, CI o docs). Solo hace correcciones mínimas de revisión; todo cambio real se delega.
- Agentes: `command-code` para testing, CI, config, housekeeping y tests; `opencode` para implementación y tests de UI (GLM-5.3-Flash Free, esfuerzo `max`); Haiku, subagente de Claude Code, para documentación.
- Un agente a la vez (dos como máximo, en worktrees distintos). Esperar con `orca orchestration check --wait`, no con polling. Liberar con `worker-release`.
- Claude Code crea el run y los workers, lee los reportes, verifica con `pnpm run verify` (solo lectura), revisa `git status` y el diff de cada worktree, y commitea o abre PR solo con permiso de la persona. Nunca fusiona a `main` sin permiso explícito.

## Piezas del repo

| Pieza | Ruta | Para qué |
| --- | --- | --- |
| Contrato | `CONTRACT.md` | Reglas de oro, prohibiciones y definición de "rojo válido" y "verde" |
| Instrucciones de proyecto | `CLAUDE.md`, `AGENTS.md` | Roles y comandos; `AGENTS.md` añade la nota de Next.js 16 |
| Comandos de Claude Code | `.claude/commands/plan.md`, `implementar.md`, `audit.md` | Los tres pasos del ciclo |
| Subagentes | `.claude/agents/architect.md`, `implementer.md`, `auditor.md` | Roles delegables |
| Reglas de Antigravity (alternativa opcional) | `.agents/rules/executor.md`, `.agents/workflows/implementar.md` | Qué puede tocar y cómo informa |
| Skill del proyecto | `.claude/skills/amellify-agentes/SKILL.md` | Preferencias de delegación, Orca y OpenCode |
| Evidencia visual | `.artifacts/verification/` | Capturas y `VERIFICATION.md` |

## Ciclo básico

### 1. Planificar (`/plan <tarea>`, Claude Code define y `command-code` escribe)

1. **Reconocimiento.** Leer el código que toca la tarea y citar los archivos reales. No diseñar sobre suposiciones.
2. **Preguntas.** Si una ambigüedad cambia el diseño (contrato de la API, forma del error, permisos, persistencia), preguntar. Máximo tres preguntas.
3. **Rama.** Claude Code encarga a `command-code` crear `feature/<slug>` (kebab-case, tres palabras o menos).
4. **`PLAN.md`.** Claude Code redacta el contenido con solo estas secciones: Objetivo, Decisiones de diseño, Archivos (lista cerrada), Checklist, Rojo esperado y BASE_TESTS. `command-code` lo escribe.
5. **Tests.** `command-code` los escribe en `tests/` según el encargo. Deben cubrir camino feliz, al menos dos casos borde, un caso de error con tipo y mensaje, y una entrada inválida si hay entrada externa.
6. **Rojo válido.** Ejecutar `pnpm run verify`. Cada test nuevo falla en una aserción. Si falla por import o módulo inexistente, el implementador (`opencode`) crea en `src/` solo el andamiaje mínimo (funciones que lancen `NotImplementedError`). Pegar la salida en "Rojo esperado".
7. **Commit contrato.** Con permiso de la persona, Claude Code lo hace: `git add` de `tests/`, `PLAN.md` y el andamiaje. Commit `test(<slug>): suite en rojo para <feature>`. El SHA va en `PLAN.md` bajo BASE_TESTS.
8. **Cierre.** Tres líneas: qué se delega, cuántos tests hay y el encargo para el implementador.

### 2. Implementar (`/implementar`, implementador: `opencode` por defecto)

Claude Code lanza al implementador como worker de Orca (ver la variante multi-agente). Alternativa opcional, si la persona elige Antigravity, en modo headless:

```bash
agy -p "/implementar" --dangerously-skip-permissions --print-timeout 15m
```

El implementador debe:

1. Leer `FEEDBACK.md` si existe (prioridad absoluta), luego `PLAN.md`, `CONTRACT.md` y la especificación en `tests/`.
2. Implementar archivo por archivo, solo dentro de la lista cerrada de `PLAN.md`.
3. Repetir `pnpm run verify` hasta verde. Sin cambiar de estrategia por frustración: tras cinco intentos sin progreso sobre el mismo test, detenerse y explicar.
4. Comprobar `git diff --name-only -- tests/` (debe salir vacío).
5. Si hay interfaz, levantar la app, guardar capturas en `.artifacts/verification/` y escribir `VERIFICATION.md`.
6. Responder con el bloque de informe final de `.agents/workflows/implementar.md`.

Al terminar, Claude Code hace una comprobación preliminar (`/implementar`, punto 3): `git diff --name-only <BASE_TESTS> -- tests/` y revisión del alcance. Si hay cambios en `tests/`, no los revierte él: encarga a `command-code` hacer `git checkout -- tests/` e informa.

### 3. Auditar (`/audit`, Claude Code, solo lectura)

Comprobaciones en orden. Cada una imprime PASA o FALLA con evidencia:

1. **Integridad del contrato:** `git diff --name-only <BASE_TESTS> -- tests/` debe salir vacío. Si no, falla de inmediato.
2. **Alcance:** `git diff --name-only <BASE_TESTS>..HEAD` contra la lista de `PLAN.md`.
3. **Verde real:** Claude Code ejecuta `pnpm run verify` él mismo y pega la salida completa.
4. **Antipatrones:** skip, xfail, `.only`, `any`, `@ts-ignore`, `eslint-disable`, `sleep`, `setTimeout` en tests, catch vacío, valores a fuego, funciones de más de ~40 líneas, consultas en bucle y entradas sin validar.
5. **Evidencia visual:** si toca interfaz, buscar capturas y `VERIFICATION.md`. Sin ellas, lo visual queda como NO VERIFICADO (no bloquea por sí solo).
6. **Coherencia con el plan:** recorrer el checklist de `PLAN.md`.
7. **Veredicto:**
   - Sin bloqueantes: encargar a `command-code` marcar el checklist y borrar `FEEDBACK.md` si existe. El commit `feat(<slug>): ...`, con un cuerpo que resuma las decisiones reales, lo hace Claude Code solo con permiso de la persona.
   - Con bloqueantes: encargar a `command-code` escribir `FEEDBACK.md` con `ITERACION`, `BLOQUEANTE` y `NO BLOQUEANTE`, y volver al paso 2.

Límite: máximo dos rondas de `FEEDBACK.md` por tarea. En la tercera, el ciclo se detiene y se escala a la persona.

## Variante multi-agente con Orca

Útil cuando la implementación y el testing corren en paralelo a la conversación. Preferencias y comandos completos en `.claude/skills/amellify-agentes/SKILL.md`. Resumen:

1. **Plan y tests** como en el ciclo básico, en la rama `feature/<slug>` del coordinador (Claude Code define; `command-code` escribe).
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
6. **Commit:** los cambios de `src/` están sin commitear en el worktree del worker. Antes de commitear, confirmar con `git -C <worktree> branch --show-current` que está en `feature/<slug>`. El commit lo hace Claude Code, solo con permiso de la persona, nunca el worker.
7. **Testing:** después de que los implementadores terminen, mandar a `command-code` a correr `pnpm run verify` y, si aplica, e2e (`docs/TESTING.md`). La salida real es la única evidencia válida.
8. **Liberar:** `orca orchestration worker-release --dispatch <id>` cuando el worker esté asentado.
9. **Auditoría final** con `/audit` en el worktree que contiene los cambios.

**Verificado:** `--agent opencode` y `--agent command-code` son ids válidos; `--worktree new-top-level` crea la rama `<usuario-git>/<name>`, no `feature/<slug>`, así que hay que renombrarla (`git branch -m feature/<slug>`) antes de commitear. Sin verificar: si `--agent` acepta `agy`.

## Errores frecuentes

- Trabajar o commitear en `main`. Toda tarea va en `feature/<slug>`.
- Dejar que un agente corra `pnpm format` sobre el repo entero (reformateó ~100 archivos en una ocasión).
- Dar "verde" sin pegar la salida de `pnpm run verify`.
- Matar procesos con `pkill -f <patrón>` desde una shell de agente: el patrón coincide con la propia línea de comando. Usar pid o `pgrep -x`.
- Que Claude Code edite archivos directamente en vez de delegar. Solo cabe una corrección mínima de revisión.
- Añadir `sleep` o reintentos para esquivar flakiness. Se investiga la causa (por ejemplo, el rate-limit de Better Auth en `docs/TESTING.md`).
