# Estrategia de tests

Cómo se prueba Amellify: qué va en unit, qué en e2e, cómo se comparten sesiones en Playwright y por qué, y qué comandos usar.

## Dos niveles

| | Unit (Vitest) | E2E (Playwright) |
| --- | --- | --- |
| Ubicación | `tests/unit/` (y `src/**/*.test.{ts,tsx}`, según `vitest.config.ts`) | `tests/e2e/` |
| Entorno | jsdom, `globals: true`, alias `@` a `src/` | Navegador real (Chromium) contra la app |
| Necesita | Nada externo | App construida y Postgres |
| Comando | `pnpm test` | `pnpm test:e2e` |
| En `verify` | Sí | No |
| En CI | Job `check` | Job `e2e` (solo `chromium`) |

Unit cubre lógica pura y acciones con dependencias controladas. Archivos actuales:

- `actions-ownership.test.ts`: comprobaciones de propiedad en acciones.
- `ai-cascade.test.ts`, `ai-providers.test.ts`, `ai-schema.test.ts`, `ai-validation.test.ts`: cascada de IA, proveedores, esquema y validación de entrada.
- `calculator-view.test.tsx`: vista de la calculadora (única prueba de componente React).
- `grades.test.ts`, `overlap.test.ts`, `time.test.ts`: utilidades.
- `ics-export.test.ts`, `pwa-icons.test.ts`, `rate-limit.test.ts`, `redirect.test.ts`.

Cobertura (`pnpm test:coverage`, provider v8): `src/lib/**` y `src/db/queries/**`.

E2E cubre flujos de usuario en `tests/e2e/`: `auth`, `courses`, `calculator`, `stats`, `export`, `settings-import`, `ai-import` y `theme`. Helpers en `tests/e2e/helpers/auth.ts` (`generateTestUser`, `registerAndLogin`, `createTestCourse`). Fixtures en `tests/e2e/fixtures/` (`backup-sample.json`, `tiny-schedule.png`).

## E2E: sesiones compartidas

### El problema

Better Auth limita las rutas de autenticación. Según `node_modules/better-auth` (versión 1.7.4, leída en un worktree de Orca porque el repo principal no tiene `node_modules`):

- `getDefaultSpecialRules` aplica **3 peticiones cada 10 s** por IP a `/sign-in`, `/sign-up`, `/change-password` y `/change-email`.
- El límite está activo cuando `NODE_ENV=production` (`enabled: options.rateLimit?.enabled ?? isProduction`).
- El `webServer` local de Playwright corre el build de producción (`pnpm run start:standalone`), así que el límite aplica también en local.

Antes, cada spec registraba un usuario nuevo con `registerAndLogin`. Varios specs seguidos excedían el límite, el registro no redirigía a `/dashboard` y el test se colgaba hasta el timeout.

### La solución (`tests/e2e/global-setup.ts`)

1. `globalSetup` se ejecuta una vez antes de la suite. Registra dos usuarios con `registerAndLogin` y guarda cada sesión con `context.storageState()` en `tests/e2e/.auth/`:
   - `EMPTY_USER_STATE` (`empty-user.json`): cuenta sin materias, para los tests de estado vacío de calculadora y estadísticas.
   - `MAIN_USER_STATE` (`main-user.json`): cuenta con datos de prueba para el resto.
2. Los specs cargan la sesión con `test.use({ storageState: ... })` en vez de registrarse. Los que usan `storageState`: `calculator`, `courses`, `export`, `settings-import`, `ai-import`, `theme` y `stats`.
3. `auth.spec.ts` es la excepción: prueba el flujo de registro real, así que sigue haciendo un sign-up en vivo. Por eso el total de registros reales por corrida son 3 (2 del setup y 1 de `auth.spec.ts`).
4. `/tests/e2e/.auth` está en `.gitignore`. Las sesiones se regeneran en cada corrida.

Reglas al escribir e2e:

- **No** añadir `registerAndLogin` en specs nuevos. Usar `storageState` con el usuario que corresponda. Si el test necesita cuenta vacía, usar `EMPTY_USER_STATE`; si puede compartir datos, `MAIN_USER_STATE`.
- **No** poner `sleep`, `setTimeout` ni reintentos ciegos para esquivar el rate-limit (lo prohíbe `CONTRACT.md`). Si se acerca el límite, reducir registros reales, no añadir esperas.
- Un test que depende de que no haya materias (estado vacío) usa `EMPTY_USER_STATE`. Un test que crea materias no debe asumir una cuenta vacía, porque `MAIN_USER_STATE` se comparte entre specs.

### Configuración (`playwright.config.ts`)

- `testDir: ./tests/e2e`, `globalSetup` apuntando al archivo anterior.
- `fullyParallel: true`. En CI: `workers: 1`, `retries: 2`, `forbidOnly`.
- Proyectos: `chromium` (Desktop Chrome) y `mobile` (iPhone 14). CI corre solo `--project=chromium`.
- `reporter: 'html'` (salida en `playwright-report/`, ignorada por git).
- `trace` y `screenshot` solo al fallar.
- `webServer` solo si **no** hay `PLAYWRIGHT_BASE_URL`: arranca `pnpm run start:standalone` (requiere `pnpm build` previo, porque `next start` no sirve el build standalone). En CI el stack lo levanta Compose.

## Comandos

```bash
pnpm test              # unit (vitest run)
pnpm test:watch        # unit en modo watch
pnpm test:coverage     # unit con cobertura
pnpm run verify        # lint + typecheck + unit (el "verde" del proyecto)

pnpm build             # requisito para e2e en local
pnpm test:e2e          # e2e completo (chromium y mobile)
pnpm test:e2e --project=chromium
```

Para e2e en local hace falta Postgres y un `.env` válido (ver `.env.example`). Para usar un servidor ya levantado (por ejemplo, Compose), definir `PLAYWRIGHT_BASE_URL=http://localhost:3000`. Entonces Playwright no arranca su propio `webServer`.

## Qué no se hace

- No se mete e2e en `pnpm run verify`: necesita app y Postgres corriendo y es lento para el bucle de TDD (ver `CONTRACT.md`).
- No se usa `test.skip`, `test.only`, `xfail` ni comentar aserciones para pasar un test (`CONTRACT.md`).
- No se mockea el sujeto bajo prueba.
- No se usan `eslint-disable`, `any` ni `@ts-ignore` sin justificación escrita (`CONTRACT.md`).

## Evidencia visual

Si un cambio toca la interfaz, además de los tests se guardan capturas en `.artifacts/verification/` y un `VERIFICATION.md` con lo probado y lo no probado (`.agents/rules/executor.md`). Sin ese archivo, lo visual se reporta como no verificado.
