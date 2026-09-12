## Objetivo

Cerrar los 4 pendientes identificados para considerar el proyecto terminado:
iconos PWA reales, resiliencia/mensajería del import de PDF, cobertura e2e
faltante (import con IA, restaurar JSON, stats) y limpieza de los 59
warnings de lint preexistentes.

## Decisiones de diseño

**Iconos PWA**
- `sharp` ya está resuelto transitivamente en `pnpm-lock.yaml` (dependencia
  de la optimización de imágenes de Next.js) — lo agrego como
  `devDependency` explícita en vez de depender de una transitiva no
  declarada (frágil ante un futuro upgrade de Next), y lo uso solo en un
  script de generación (`scripts/generate-pwa-icons.mjs`), nunca en
  runtime — no infla el bundle de la app.
- El script rasteriza `public/icons/icon.svg` → `icon-192.png` (192×192) y
  `icon-512.png` (512×512), y `public/icons/icon-maskable.svg` →
  `icon-512-maskable.png` (512×512, `purpose: maskable`) y
  `apple-touch-icon.png` (180×180, convención de iOS). No agrego padding de
  safe-zone a mano: el SVG maskable ya existe separado del normal
  precisamente porque su arte ya está pensado para esa zona segura.
- `manifest.ts` mantiene las entradas SVG existentes (siguen sirviendo como
  fallback vectorial de alta calidad) y AGREGA las 3 PNG nuevas — no las
  reemplazo, para no perder la escalabilidad perfecta del SVG en
  plataformas que sí lo soportan bien.
- `layout.tsx`: `icons.apple` pasa de apuntar al SVG a
  `/icons/apple-touch-icon.png` — iOS/Safari no acepta SVG para el icono de
  pantalla de inicio, que es exactamente el TODO documentado.

**Resiliencia del import de PDF**
- NO agrego un segundo proveedor con soporte de PDF: no hay ninguno gratis
  verificado en vivo (Groq/OpenRouter/Mistral son solo-visión), y convertir
  el PDF a imagen en el cliente ya fue rechazado explícitamente por el
  usuario en la tarea anterior. Inventar un proveedor sin probarlo en vivo
  sería peor que no tocar nada.
- `cascade.ts` separa `TIMEOUT_MS` (25s, se mantiene para imágenes) de un
  nuevo `PDF_TIMEOUT_MS` (60s) — encontré en vivo que Google puede tardar
  26-89s+ solo en RESPONDER un error 503 de sobrecarga con este documento
  real de 2 páginas; 25s es corto para darle a un PDF una oportunidad justa
  bajo carga normal. Sigue siendo un límite duro (no espera indefinido) para
  no colgar la UI.
- `route.ts` distingue un tercer caso en el mensaje de error: si el único
  intento (Google, con PDF) falló con un código reintentable
  (`timeout`, `api_error_429`, `api_error_503`), el mensaje pasa a ser
  específico ("Google AI está temporalmente saturado, intenta de nuevo en
  unos minutos") en vez del genérico actual. Extraigo esta decisión a una
  función pura y testeable, `selectFailureMessage(hasPdf, attempts)` en
  `cascade.ts`, en vez de dejarla como un ternario inline en el Route
  Handler (que no tiene test unitario y no lo va a tener en esta tarea).

**Cobertura e2e**
- Los 3 specs nuevos (`ai-import`, `settings-import`, `stats`) siguen el
  patrón ya establecido en `tests/e2e/export.spec.ts` y
  `helpers/auth.ts` (`registerAndLogin`).
- `ai-import.spec.ts` NO llama a un proveedor de IA real: intercepta
  `POST /api/ai/extract-schedule` con `page.route(...)` y responde un
  cuerpo fijo. Depender de un proveedor gratis real en e2e sería lento,
  flaky (ya lo vimos: Google puede tardar minutos bajo demanda alta) y
  potencialmente sin cupo — el contrato de la API (`courses`/`provider`/
  `model`) ya está cubierto por los tests unitarios de `cascade.ts`; lo que
  este e2e cubre es la UI (subir → analizar → previsualizar → guardar).
- Fixture nueva `tests/e2e/fixtures/tiny-schedule.png`: un PNG 1×1 real
  (el mismo que ya usa `ai-cascade.test.ts` para no inventar un formato
  nuevo) — alcanza porque el backend está mockeado, no hace falta una
  imagen realista para probar el flujo de UI.
- `settings-import.spec.ts` reutiliza el backup JSON de
  `tests/e2e/fixtures/backup-sample.json` (una materia mínima válida contra
  `importDataSchema`) para probar "Restaurar desde JSON", complementando el
  test de exportación que ya existe en `export.spec.ts`.
- `stats.spec.ts` verifica que la vista carga y muestra sus elementos
  clave sin crashear, con y sin materias registradas (dos casos, ya que
  `stats-view` recibe `courses`/`profile` que pueden venir vacíos).
- Como ya documenta `CONTRACT.md`, estos specs NO corren dentro de
  `pnpm run verify` (esa suite excluye e2e a propósito). El "rojo válido"
  para esta parte se demuestra con `pnpm test:e2e` contra la app+Postgres
  reales, no con el comando rápido.

**Limpieza de lint**
- Subo la vara: `"lint": "eslint ."` → `"lint": "eslint . --max-warnings=0"`
  en `package.json`. Hoy mismo eso convierte los 59 warnings existentes en
  rojo real de `pnpm run verify` — es el "rojo" de esta parte de la tarea,
  ya que no hay una aserción de negocio que escribir para "un import sin
  usar".
- Los 6 warnings de `react-hooks/set-state-in-effect` (courses-view.tsx,
  course-dialog.tsx, sidebar.tsx, schedule-grid.tsx, calculator-view.tsx)
  SÍ tocan comportamiento (sincronizan estado local a partir de
  props/mount) — no son solo cosmética. Antigravity debe preservar el
  comportamiento observable exacto (los tests unitarios y los e2e
  existentes de `calculator`/`courses`/`theme` no pueden regresar) al
  aplicar el patrón que sugiere el propio lint (mover el `setState` a un
  manejador de evento, derivar en render, o resetear con `key` en vez de
  sincronizar por efecto).
- NO agrego una regla de lint nueva ni cambio ninguna regla existente más
  allá de `--max-warnings=0` — el resto es corregir código para cumplir las
  reglas que YA existen.

## Archivos (lista cerrada)

- `package.json`: `sharp` como devDependency; `lint` con `--max-warnings=0`.
- `scripts/generate-pwa-icons.mjs` (nuevo): genera las 4 PNG desde los SVG.
- `public/icons/icon-192.png`, `icon-512.png`, `icon-512-maskable.png`,
  `apple-touch-icon.png` (nuevos, generados por el script).
- `src/app/manifest.ts`: agrega las 3 entradas PNG al array `icons`.
- `src/app/layout.tsx`: `icons.apple` → `/icons/apple-touch-icon.png`;
  quita los comentarios TODO ya resueltos.
- `src/lib/ai/cascade.ts`: `PDF_TIMEOUT_MS` (60s) separado de `TIMEOUT_MS`
  (25s); `callProvider` elige el timeout según `hasPdf`; nueva función
  pura exportada `selectFailureMessage(hasPdf, attempts)`.
- `src/app/api/ai/extract-schedule/route.ts`: usa `selectFailureMessage`
  en vez del ternario inline.
- Solo warnings de lint, sin API pública nueva: `src/app/(app)/settings/page.tsx`,
  `src/components/ai/ai-import-dialog.tsx`,
  `src/components/calculator/calculator-view.tsx`,
  `src/components/courses/course-dialog.tsx`,
  `src/components/courses/courses-view.tsx`,
  `src/components/layout/sidebar.tsx`,
  `src/components/schedule/schedule-grid.tsx`,
  `src/components/settings/settings-view.tsx`,
  `src/components/ui/avatar.tsx`.
- `tests/unit/pwa-icons.test.ts` (nuevo): 3 tests.
- `tests/unit/ai-cascade.test.ts`: +4 tests (`PDF_TIMEOUT_MS` vs
  `TIMEOUT_MS` vía spy de `AbortSignal.timeout`, + `selectFailureMessage`).
- `tests/e2e/ai-import.spec.ts` (nuevo).
- `tests/e2e/settings-import.spec.ts` (nuevo).
- `tests/e2e/stats.spec.ts` (nuevo).
- `tests/e2e/fixtures/tiny-schedule.png` (nuevo, binario).
- `tests/e2e/fixtures/backup-sample.json` (nuevo).
- `PLAN.md`.

## Checklist

- [x] Escribir `tests/unit/pwa-icons.test.ts`
- [x] Escribir los 4 tests nuevos en `tests/unit/ai-cascade.test.ts`
- [x] Escribir `tests/e2e/ai-import.spec.ts` + fixture PNG
- [x] Escribir `tests/e2e/settings-import.spec.ts` + fixture JSON
- [x] Escribir `tests/e2e/stats.spec.ts`
- [x] Subir `package.json` lint a `--max-warnings=0` (rojo real de los 59
      warnings existentes)
- [x] Confirmar rojo válido en `pnpm run verify` (unit) y documentar el
      estado de los e2e nuevos (no corren dentro de `verify`)
- [x] (Antigravity) generar los iconos, ajustar manifest/layout
- [x] (Antigravity) separar timeout de PDF + `selectFailureMessage`
- [x] (Antigravity) limpiar los 59 warnings preservando comportamiento
- [x] (Antigravity) poner en verde `pnpm test:e2e` para los 3 specs nuevos
- [x] Commit del contrato con el SHA en BASE_TESTS
- [x] Delegar a Antigravity vía `/implementar`

## Rojo esperado

**Excepción documentada al protocolo** (misma que en la tarea anterior): mi
regla `deny` en `.claude/settings.json` (`Edit(src/**)`, `Write(src/**)`) me
impide crear el andamiaje mínimo que el paso 6 de `/plan` me autoriza a
escribir en `src/`. Antigravity debe crear PRIMERO, textual, el siguiente
andamiaje (sin lógica real) como primer paso de `/implementar`:

**Andamiaje exacto a añadir en `src/lib/ai/cascade.ts`** (nueva función
exportada; no toca nada más del archivo en este primer paso):
```ts
export function selectFailureMessage(
  _hasPdf: boolean,
  _attempts: ExtractScheduleAttempt[]
): string {
  throw new Error('NotImplemented')
}
```

Salida real de `pnpm run typecheck` ANTES de este andamiaje (falla en
`tsc`, no en tests — documentado a propósito, no es el rojo válido final):
```
tests/unit/ai-cascade.test.ts(3,43): error TS2305: Module '"@/lib/ai/cascade"'
has no exported member 'selectFailureMessage'.
 ELIFECYCLE  Command failed with exit code 2.
```

Una vez creado ese andamiaje, `pnpm run verify` debe fallar así (rojo válido
por aserción, no por import/módulo inexistente):

1. **`eslint . --max-warnings=0`** — falla de inmediato con los 43 warnings
   reales que ya existían (subí la vara desde `eslint .` sin límite). Salida
   real ya confirmada en esta sesión:
   ```
   ✖ 43 problems (0 errors, 43 warnings)
   ```
   en exactamente estos 9 archivos:
   `src/app/(app)/settings/page.tsx`, `src/components/ai/ai-import-dialog.tsx`,
   `src/components/calculator/calculator-view.tsx`,
   `src/components/courses/course-dialog.tsx`,
   `src/components/courses/courses-view.tsx`,
   `src/components/layout/sidebar.tsx`,
   `src/components/schedule/schedule-grid.tsx`,
   `src/components/settings/settings-view.tsx`,
   `src/components/ui/avatar.tsx`.

2. **`tsc --noEmit`** — limpio una vez creado el andamiaje de arriba (ya
   confirmado: el único error de tipos hoy es justamente la ausencia de
   `selectFailureMessage`, resuelta por el stub).

3. **`vitest run`** — nuevos tests en rojo por aserción:
   - `tests/unit/pwa-icons.test.ts` (3 tests): fallan en
     `expect(fs.existsSync(filePath)).toBe(true)` — los PNG no existen
     todavía. Confirmado real en esta sesión (los archivos no existen en
     `public/icons/`).
   - `tests/unit/ai-cascade.test.ts`, describe `per-request timeout...`:
     el test de 25s ya pasa hoy (el código actual siempre usa 25s); el de
     PDF (60s) falla — confirmado real:
     `expect(timeoutSpy).toHaveBeenCalledWith(60_000)` recibe `25_000`.
   - `tests/unit/ai-cascade.test.ts`, describe `selectFailureMessage` (6
     tests): confirmado real en esta sesión que hoy fallan con
     `TypeError: selectFailureMessage is not a function` (vitest transpila
     sin type-check completo, así que el import roto no frena la suite
     como si frena a `tsc`) — eso NO es rojo válido por sí solo. Una vez
     creado el stub de arriba, las 6 pasan a fallar limpio con
     `Error: NotImplemented`, que junto con el `tsc` ya limpio sí es rojo
     válido según `CONTRACT.md`.

`tests/e2e/*.spec.ts` (3 specs nuevos) no corren dentro de `pnpm run
verify` — así lo definió `CONTRACT.md` desde el principio (necesitan la app
y Postgres reales). Confirmé que compilan (`tsc --noEmit` los incluye y ya
está limpio) pero NO ejecuté `pnpm test:e2e` en esta sesión de planeación;
Antigravity debe correrlo como parte de `/implementar` y dejar evidencia
del resultado.

## BASE_TESTS

45b6560
