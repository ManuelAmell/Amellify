## Objetivo

Eliminar la flakiness de `registerAndLogin` en los tests e2e, causada por el
rate-limit de sign-up/sign-in de Better Auth (3 peticiones/10s por IP en
producción), reduciendo los registros reales de ~20 por corrida a solo 3.

## Decisiones de diseño

- **Causa raíz confirmada leyendo `node_modules/better-auth`**: la regla
  especial por defecto (`getDefaultSpecialRules` en
  `api/rate-limiter/index.mjs`) limita `/sign-up`, `/sign-in`,
  `/change-password` y `/change-email` a 3 peticiones cada 10s por IP,
  activa por defecto cuando `NODE_ENV=production` (`create-context.mjs`:
  `enabled: options.rateLimit?.enabled ?? isProduction`). Nuestro `auth.ts`
  no sobrescribe esto, y el `webServer` local de e2e (arreglado en
  `fix/e2e-standalone-webserver`) corre el build de producción real — así
  que el límite SÍ está activo durante los tests. Con ~8 specs llamando
  `registerAndLogin` (un sign-up nuevo cada vez) varios se agrupan dentro
  de la misma ventana de 10s y se cuelgan esperando el redirect a
  `/dashboard` que nunca llega.
- **Arreglo 100% en `tests/`, cero cambios en `src/`** (decisión del
  usuario entre las dos alternativas que planteé): en vez de tocar la
  configuración de seguridad real de Better Auth (aunque fuera detrás de
  un flag), reestructuro los e2e para que casi ningún test tenga que
  registrarse a sí mismo.
- **`tests/e2e/global-setup.ts` (nuevo)**: registra exactamente 2 usuarios
  reutilizables UNA vez antes de toda la suite (patrón oficial de
  Playwright para "autenticar una vez, reusar en todos lados"), y guarda
  su sesión con `context.storageState()` en `tests/e2e/.auth/*.json`.
  Dos usuarios, no uno, porque `calculator.spec.ts` y `stats.spec.ts`
  tienen aserciones de "estado vacío" (cero materias) que romperían si
  compartieran cuenta con un test que ya agregó una materia.
- **`playwright.config.ts`**: agrega `globalSetup`. Cada spec usa
  `test.use({ storageState: EMPTY_USER_STATE | MAIN_USER_STATE })` en vez
  de llamar `registerAndLogin` — ya no inician sesión, la sesión ya viene
  cargada. `calculator.spec.ts` y `stats.spec.ts` se dividen en dos
  `describe` anidados (uno por estado) porque mezclan tests que necesitan
  cuenta vacía con tests que necesitan materias.
- **`auth.spec.ts` NO se toca**: sus 3 primeros tests no requieren sesión
  (por diseño, no usan storageState = contexto limpio sin cookies), y el
  cuarto ("permite registrar una nueva cuenta...") existe específicamente
  para probar el flujo de registro real — debe seguir haciendo su propio
  sign-up en vivo, no puede reusar una sesión pre-existente. Con esto, el
  total de sign-ups reales de la suite entera queda en 3 (2 del
  `globalSetup` + 1 de `auth.spec.ts`), justo en el límite de "3 por 10s"
  pero nunca excediéndolo en una corrida normal.
- **NO agrego reintentos ni sleeps en los tests** para esquivar el rate
  limit — `CONTRACT.md` los prohíbe explícitamente y además no atacarían
  la causa real.
- **`tests/e2e/.auth/` se agrega a `.gitignore`**: son sesiones de cuentas
  descartables regeneradas en cada corrida, no artefactos a versionar.
- **Sin ciclo `/implementar`**: esta tarea no toca `src/` en absoluto —
  no hay nada que delegarle a Antigravity. La implementé y verifiqué yo
  mismo directamente, ya que `tests/` (y la config de Playwright que la
  gobierna) es mi dominio exclusivo según `CONTRACT.md`.

## Archivos (lista cerrada)

- `tests/e2e/global-setup.ts` (nuevo): registra los 2 usuarios reutilizables
  y exporta `EMPTY_USER_STATE`/`MAIN_USER_STATE`.
- `playwright.config.ts`: agrega `globalSetup`.
- `.gitignore`: agrega `/tests/e2e/.auth`.
- `tests/e2e/calculator.spec.ts`: split en 2 `describe` (vacío/con datos),
  usa `storageState` en vez de `registerAndLogin`.
- `tests/e2e/stats.spec.ts`: ídem.
- `tests/e2e/courses.spec.ts`, `export.spec.ts`, `settings-import.spec.ts`,
  `theme.spec.ts`, `ai-import.spec.ts`: `test.use({ storageState:
  MAIN_USER_STATE })` a nivel de archivo, quitan su llamada a
  `registerAndLogin`.
- `tests/e2e/auth.spec.ts`: sin cambios (documentado arriba por qué).
- `PLAN.md`: este archivo.

## Checklist

- [x] Leer `node_modules/better-auth` para confirmar la causa raíz real
      (no asumida)
- [x] Escribir `tests/e2e/global-setup.ts`
- [x] Actualizar `playwright.config.ts` y `.gitignore`
- [x] Migrar los 7 specs afectados a `storageState` compartido
- [x] Verificar `pnpm run build && npx playwright test` (chromium,
      paralelismo por defecto): 18/18 verde, sin flakiness
- [x] Verificar que `auth.spec.ts` sigue haciendo un sign-up real y sigue
      pasando
- [x] `pnpm run verify`: sin cambios de comportamiento en unit tests

## Rojo esperado

No aplica un "rojo" formal en `pnpm run verify` — la evidencia del bug ya
estaba documentada en las auditorías de `feature/project-polish` (el mismo
`registerAndLogin` timeout apareciendo en specs viejos y nuevos por igual).
La validación real es comportamental: antes del fix, `npx playwright test`
completo (chromium, paralelismo default) fallaba de forma intermitente en
2-4 tests distintos cada corrida con `TimeoutError: page.waitForURL` en
`registerAndLogin`; después del fix, 3 corridas seguidas (secuencial,
paralelo default, y paralelo con ambos proyectos) dieron 18/18 en chromium
sin ningún fallo. Los 18 fallos de `mobile` son por falta del binario de
WebKit en esta máquina (`npx playwright install` pendiente, ajeno a esta
tarea).

## BASE_TESTS

No aplica — no hay commit de "tests en rojo" separado del commit final,
dado que no hay ciclo de Antigravity en esta tarea.
