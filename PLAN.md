## Objetivo

Permitir subir un PDF (además de fotos/capturas) al escáner de horarios, enviándolo exclusivamente a Google (único proveedor con soporte real de documentos) sin pasar por el resto de la cascada.

## Decisiones de diseño

- **Solo Google procesa PDF** (decisión del usuario): Groq/OpenRouter/Mistral usan modelos de solo-visión, no de documentos. Se añade `supportsPdf: boolean` a `AiProviderEntry` (`true` únicamente en la entrada de Google) y `cascade.ts` filtra la lista de proveedores ANTES de iterar cuando el input trae un PDF — los que no soportan PDF ni siquiera se intentan (no aparecen en `attempts`).
- Si tras filtrar no queda ningún proveedor con soporte de PDF (Google no configurado), `extractSchedule` devuelve `{ ok:false, attempts: [] }` de inmediato — `route.ts` distingue este caso (`attempts.length === 0`) para dar un mensaje específico ("no hay un proveedor de IA con soporte de PDF configurado") en vez del genérico de "todos los proveedores fallaron".
- **Límite de tamaño de 15 MB solo cuando el payload trae un PDF** (decisión del usuario); si es solo imágenes se mantiene el límite actual de 6 MB. Para no rechazar un PDF legítimo antes de poder inspeccionarlo, el primer chequeo de `Content-Length`/body crudo usa el techo alto (15 MB); tras parsear y detectar que NO hay PDF, se re-valida contra el límite de 6 MB.
- **Extraigo la validación (allowlist de MIME + selección de límite por tipo) a un módulo nuevo y puro** `src/lib/ai/validation.ts`, importado tanto por `route.ts` como por `cascade.ts` — evita duplicar el regex de data-URL una tercera vez (ya hay uno parecido en `route.ts` y otro en `cascade.ts` desde la tarea anterior; con esta se consolida en un solo lugar) y permite testear la lógica sin invocar el Route Handler completo.
- **NO renombro el campo `images` del contrato de la API** a algo como `files` — seguiría aceptando PDFs dentro del mismo array de data URLs; renombrar tocaría cliente, tests y schema sin beneficio real más allá de lo cosmético.
- **NO agrego pdf.js ni convierto el PDF a imagen en el cliente** (rechazado explícitamente por el usuario) — el PDF viaja tal cual, como data URL, igual que una imagen.
- **NO escribo un test de componente para `AIImportDialog`** — el cambio ahí es de UI (aceptar `application/pdf` en el dropzone, saltar el resize por `<canvas>` que no puede leer PDFs, leer el archivo directo con `FileReader`). La lógica de negocio real (qué proveedores se intentan, qué límite aplica) está cubierta en `validation.ts`/`cascade.ts`; lo visual lo verifica Antigravity con capturas en `.artifacts/verification/` porque esta tarea sí toca interfaz.

## Archivos (lista cerrada)

- `src/lib/ai/validation.ts` (nuevo): `ALLOWED_IMAGE_MIME_TYPES`, `ALLOWED_DOCUMENT_MIME_TYPES`, `isAllowedFileDataUrl(dataUrl)`, `isPdfDataUrl(dataUrl)`, `maxBodyBytesFor(images)`.
- `src/app/api/ai/extract-schedule/route.ts`: usa `validation.ts` en vez de su allowlist/regex local; two-tier de tamaño (15 MB inicial, re-chequeo a 6 MB si no hay PDF); mensaje de error distinto cuando `attempts.length === 0` y había un PDF.
- `src/lib/ai/providers.ts`: añade `supportsPdf: boolean` a `AiProviderEntry`; `true` solo en la entrada de Google.
- `src/lib/ai/cascade.ts`: filtra `providers` por `supportsPdf` cuando `input.images` contiene un PDF (usa `isPdfDataUrl` de `validation.ts`, reemplazando el `DATA_URL_PATTERN` propio que quedó de la tarea anterior).
- `src/components/ai/ai-import-dialog.tsx`: acepta `application/pdf` en el `<input type="file">` y el dropzone; `processImageFile` (o su reemplazo) detecta PDF y usa `FileReader.readAsDataURL` en vez de `resizeImageToJpeg`; guarda de tamaño en cliente para PDF (~8 MB crudo, deja margen bajo el límite de 15 MB codificado en base64); copys actualizados ("PNG, JPG, WebP, PDF").
- `tests/unit/ai-validation.test.ts` (nuevo): 4 tests.
- `tests/unit/ai-cascade.test.ts`: +3 tests de filtrado por `supportsPdf`.

## Checklist

- [x] Escribir los tests de `tests/unit/ai-validation.test.ts` (6, no 4 — cobertura más completa de lo mínimo)
- [x] Escribir los 3 tests nuevos en `tests/unit/ai-cascade.test.ts`
- [ ] (Antigravity, primer paso) Crear el andamiaje exacto de "Rojo esperado" en `src/lib/ai/validation.ts` y el campo `supportsPdf` en `providers.ts`
- [x] Commit del contrato con el SHA en BASE_TESTS (rojo documentado como excepción — ver "Rojo esperado")
- [x] Delegar a Antigravity vía `/implementar`

## Rojo esperado

**Excepción documentada al protocolo**: mi propia regla `deny` en `.claude/settings.json`
(`Edit(src/**)`, `Write(src/**)`) me impide crear incluso el andamiaje mínimo que el
paso 6 de `/plan` me autoriza a escribir en `src/`. El usuario decidió resolverlo así:
Antigravity crea PRIMERO, textual, el andamiaje de abajo (sin ninguna lógica real
todavía) como el primerísimo paso de `/implementar`, antes de tocar nada más. Recién
en ese punto `pnpm run verify` produce rojo válido por aserción; hasta entonces falla
en `tsc` (import inexistente / propiedad desconocida), que por sí solo NO cuenta como
rojo válido según CONTRACT.md.

**Andamiaje exacto a crear primero (`src/lib/ai/validation.ts`, archivo nuevo):**
```ts
export const ALLOWED_IMAGE_MIME_TYPES = new Set<string>()
export const ALLOWED_DOCUMENT_MIME_TYPES = new Set<string>()

export function isAllowedFileDataUrl(_dataUrl: string): boolean {
  throw new Error('NotImplemented')
}

export function isPdfDataUrl(_dataUrl: string): boolean {
  throw new Error('NotImplemented')
}

export function maxBodyBytesFor(_images: string[]): number {
  throw new Error('NotImplemented')
}
```

**Andamiaje exacto a añadir en `src/lib/ai/providers.ts`** (un campo nuevo en la
interfaz existente, sin tocar nada más de ese archivo en este primer paso):
```ts
export interface AiProviderEntry {
  id: string
  label: string
  model: LanguageModel
  modelId: string
  supportsPdf: boolean // <- añadir esta línea
}
```
(y en cada `providers.push({...})` existente, añadir `supportsPdf: false`, salvo en
la entrada de Google donde va `supportsPdf: true` — esto último ya es parte de la
implementación real del checklist, no del andamiaje, pero como toca la misma
interfaz puede hacerse en el mismo paso).

Salida real de `pnpm run verify` ANTES de este andamiaje (falla en typecheck, no en
tests — documentado a propósito, no es el rojo válido final):
```
> tsc --noEmit
tests/unit/ai-cascade.test.ts(26,5): error TS2353: Object literal may only specify known properties, and 'supportsPdf' does not exist in type 'AiProviderEntry'.
tests/unit/ai-validation.test.ts(2,69): error TS2307: Cannot find module '@/lib/ai/validation' or its corresponding type declarations.
 ELIFECYCLE  Command failed with exit code 2.
```

Una vez creado el andamiaje de arriba, `pnpm run verify` debe fallar en los 10 tests
nuevos (6 en `ai-validation.test.ts`, 3 en `ai-cascade.test.ts`, más 1 ajuste al
helper `fakeProvider`) por aserción (`toBe`/`toEqual` con el valor real vs. el
esperado, o el `throw new Error('NotImplemented')` del stub) — eso sí es rojo válido,
y es lo que Antigravity debe poner en verde con la implementación real.

## BASE_TESTS

e3d071e325b1f8b013781c24ee52adbf19208c43

---

# Tarea 2: Compatibilidad de esquema en la cascada de IA (misma rama)

## Objetivo

Corregir tres bugs reales de incompatibilidad de esquema/proveedor —encontrados
probando en vivo la cascada de IA con el PDF y la imagen reales de
`.artifacts/verification/`— que hacen que Google, Groq y OpenRouter fallen
sistemáticamente al generar el horario estructurado.

## Decisiones de diseño

- **`email` pasa de `.or(z.literal(''))` a `.nullable()`**: el patrón actual
  (`z.string().email().or(z.literal(''))`) se traduce, en el JSON Schema que
  `generateObject` manda a Google, en `enum: [""]`. La API de Gemini
  responde 400 (`response_schema...email.any_of[1].enum[0]: cannot be
  empty`) — verificado en vivo contra `generativelanguage.googleapis.com`.
  Cambiar a `.nullable()` (+ `.optional()` + `.transform(v => v ?? '')` para
  no tocar el contrato externo `ExtractedCourse.email: string`) elimina el
  enum vacío. Verificado en vivo: con este único cambio, Google/Gemini
  extrae correctamente las 8 materias del PDF real de la Universidad de
  Cartagena (código, profesor, horario y salón correctos).
- **NO toco los demás campos con `.default(...)`** (`room`, `professor`,
  `faculty`, `semester`, `credits`, `color`, `schedules`): Gemini no exige
  que absolutamente todos los campos estén en `required` (ese defecto es
  únicamente de los proveedores en modo `strict` estilo OpenAI), así que
  tocarlos aquí no resuelve nada.
- **`cascade.ts` pasa `providerOptions` con `strictJsonSchema: false`** para
  los proveedores OpenAI-compatibles (`groq`, `openrouter`, `mistral`,
  `ai-gateway`) en la llamada a `generateObject`. Groq (y por diseño
  cualquier proveedor vía `@ai-sdk/openai-compatible`) exige en modo
  `strict` que TODAS las propiedades estén en `required` del JSON Schema;
  nuestro schema tiene campos con `.default(...)` que quedan fuera de
  `required`, y eso produce el 400 real que vi contra Groq (`invalid JSON
  schema for response_format: ... must be listed in required: room`).
  Verificado en vivo: pasar `strictJsonSchema: false` elimina ese 400.
  Se pasa el mismo `providerOptions` estático en cada llamada,
  independientemente del proveedor activo — cada SDK sólo lee su propio
  namespace, así que es inofensivo para Google.
- **NO intento arreglar el límite de cuota de Groq** (el modelo por defecto
  `qwen/qwen3.6-27b` tiene un tope de 1000 tokens de salida por minuto en el
  tier gratis, y nuestro schema puede pedir más para un horario con varias
  materias — confirmado en vivo, error `rate_limit_exceeded` con detalle
  "Requested 1098 > Limit 1000"). Es una limitación real de cuota del
  proveedor, no un bug de código: la cascada YA la maneja como fallo
  reintentable con cooldown (`classifyError`/`registerFailure` existentes).
  Cambiar de modelo por defecto o ajustar `max_tokens` es una decisión de
  producto que no se pidió.
- **`providers.ts`: reemplazo de los 3 slugs `:free` muertos de
  `OPENROUTER_FREE_MODELS`** (`google/gemma-3-27b-it:free`,
  `meta-llama/llama-3.2-11b-vision-instruct:free`,
  `qwen/qwen2.5-vl-32b-instruct:free` — los 3 responden 404 "unavailable for
  free", confirmado contra la API real de OpenRouter) por 2 slugs
  confirmados vivos por consulta directa a `openrouter.ai/api/v1/models` en
  esta sesión: `google/gemma-4-31b-it:free` y `google/gemma-4-26b-a4b-it:free`
  (ambos responden 429 "temporarily rate-limited upstream" al probarlos con
  el schema real — es decir SÍ existen y son de verdad modelos de visión
  gratis, sólo saturados en ese momento; 429 ya es tratado como reintentable
  por la cascada). Se deja la lista en 2 en vez de inventar un tercero sin
  verificar — el catálogo gratis de OpenRouter es conocidamente volátil (ya
  documentado en el comentario existente de `providers.ts`).
- **El contrato externo no cambia**: `ExtractedCourse.email` sigue siendo
  `string` (nunca `string | null`) de cara a quien consuma `extractSchedule`
  — hoy `ai-import-dialog.tsx` ni siquiera lee `email`, así que esto no
  toca UI, pero preserva el tipo por si algún consumidor futuro lo usa.

## Archivos (lista cerrada)

- `src/lib/ai/schema.ts`: campo `email` de `extractedCourseSchema` cambia a
  `z.string().email().nullable().optional().transform((v) => v ?? '')`.
- `src/lib/ai/cascade.ts`: `callProvider` agrega `providerOptions: { groq:
  { strictJsonSchema: false }, openrouter: { strictJsonSchema: false },
  mistral: { strictJsonSchema: false }, 'ai-gateway': { strictJsonSchema:
  false } }` a la llamada de `generateObject`.
- `src/lib/ai/providers.ts`: el fallback por defecto de
  `OPENROUTER_FREE_MODELS` pasa de 3 a los 2 slugs vivos verificados.
- `tests/unit/ai-schema.test.ts` (nuevo): cubre la normalización de `email`
  y una regresión concreta que verifica que el JSON Schema generado por
  `extractedScheduleResponseSchema` (vía `zod/v4/core`'s `toJSONSchema`,
  el mismo mecanismo que usa `@ai-sdk/provider-utils` internamente) nunca
  contiene un enum con un string vacío.
- `tests/unit/ai-cascade.test.ts`: +1 test que verifica que `generateObject`
  se llama con `providerOptions.{groq,openrouter,mistral,'ai-gateway'}.strictJsonSchema
  === false`.
- `tests/unit/ai-providers.test.ts` (nuevo): verifica que
  `getActiveProviders()` usa los 2 slugs vivos como default de
  `OPENROUTER_FREE_MODELS` cuando la env var no está definida.
- `PLAN.md`: esta sección.

## Checklist

- [ ] `src/lib/ai/schema.ts`: cambiar el campo `email` según arriba
- [ ] `src/lib/ai/cascade.ts`: agregar `providerOptions` a la llamada de
      `generateObject` en `callProvider`
- [ ] `src/lib/ai/providers.ts`: actualizar el default de
      `OPENROUTER_FREE_MODELS`
- [x] Escribir `tests/unit/ai-schema.test.ts` (nuevo)
- [x] Escribir `tests/unit/ai-providers.test.ts` (nuevo)
- [x] Sumar el test de `providerOptions` a `tests/unit/ai-cascade.test.ts`
- [x] Confirmar rojo válido (falla por aserción, no por import/módulo
      inexistente — no hace falta andamiaje en `src/` para esta tarea)
- [x] Commit del contrato con el SHA en BASE_TESTS_2
- [ ] Delegar a Antigravity vía `/implementar`

## Rojo esperado

`pnpm run verify` (lint 0 errores/59 warnings preexistentes → typecheck OK →
vitest): 4 tests nuevos fallan, los 90 preexistentes pasan. Los 4 fallan por
ASERCIÓN (comparación esperado vs. recibido), no por import/módulo
inexistente — no hace falta andamiaje en `src/` para esta tarea.

```
FAIL  tests/unit/ai-cascade.test.ts > extractSchedule > strict JSON schema
validation is disabled for OpenAI-compatible providers > calls
generateObject with strictJsonSchema:false for groq, openrouter, mistral
and ai-gateway
AssertionError: expected undefined to match object { …(4) }
- Expected: { "ai-gateway": {...}, "groq": {...}, "mistral": {...},
  "openrouter": {...} }
+ Received: undefined

FAIL  tests/unit/ai-providers.test.ts > getActiveProviders OpenRouter
default free models > falls back to live free vision model slugs when
OPENROUTER_FREE_MODELS is not set
AssertionError: expected [ 'google/gemma-3-27b-it:free', …(2) ] to deeply
equal [ 'google/gemma-4-31b-it:free', …(1) ]

FAIL  tests/unit/ai-providers.test.ts > getActiveProviders OpenRouter
default free models > none of the default slugs are the dead ones
previously confirmed 404 on OpenRouter
AssertionError: expected [ 'google/gemma-3-27b-it:free', …(2) ] to not
include 'google/gemma-3-27b-it:free'

FAIL  tests/unit/ai-schema.test.ts > extractedCourseSchema email field >
normalizes a null email (what Gemini actually returns for an absent email)
into an empty string
AssertionError: expected false to be true // Object.is equality

Test Files  3 failed | 9 passed (12)
     Tests  4 failed | 90 passed (94)
```

## BASE_TESTS_2

9ce3311
