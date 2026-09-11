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

(se llena en el paso 7)
