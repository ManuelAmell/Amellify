## Objetivo

Corregir `buildUserContent` en `src/lib/ai/cascade.ts` para que las imágenes viajen al modelo como content part `file` (vigente) en vez de `image` (deprecado), que Google rechaza con HTTP 400 "Unable to process input image" en cuanto se combina con salida estructurada.

## Decisiones de diseño

- Extraer `mediaType` y el payload base64 desde la data URL (`data:<mime>;base64,<payload>`) en vez de pasar la data URL completa como si fuera un `image` — es lo que el shape `file` del AI SDK espera (`data` = bytes/base64 puro, `mediaType` aparte).
- Reutilizar el mismo patrón de regex que ya usa `route.ts` (`isAllowedImageDataUrl`) para partir la data URL, en vez de inventar un parser nuevo — consistencia con el resto del módulo de IA.
- Data URLs malformadas (sin `data:`/`;base64,` reconocibles) se **ignoran silenciosamente** en `buildUserContent`, no lanzan error. Por qué: `route.ts` ya valida el MIME antes de llegar aquí (defensa ya existe en el borde de la API); esta función es una capa interna que debe ser robusta por sí sola sin duplicar esa validación con un throw que rompería toda la extracción por una sola imagen mala.
- NO toco el soporte de PDF que pidió el usuario en esta tarea — es una feature nueva (cambia el allowlist de MIME en `route.ts`, el dropzone del cliente, límites de tamaño); se planifica aparte para no mezclar un fix de bug con una feature.
- NO exporto `buildUserContent` para testear — sigo el patrón ya establecido en `tests/unit/ai-cascade.test.ts` de inspeccionar `messages` a través del mock de `generateObject`, evitando ampliar la superficie pública del módulo solo para tests.

## Archivos (lista cerrada)

- `tests/unit/ai-cascade.test.ts`: añade 4 tests nuevos que verifican la forma exacta del content part enviado a `generateObject` cuando hay imágenes (ver sección TESTS).

## Checklist

- [ ] Añadir los 4 tests en `tests/unit/ai-cascade.test.ts`
- [ ] Confirmar rojo válido (fallo de aserción, no de import/sintaxis)
- [ ] Commit del contrato con el SHA en BASE_TESTS
- [ ] Delegar a Antigravity vía `/implementar`

## Rojo esperado

`pnpm run verify` — lint y typecheck en verde, `vitest run` falla con 4 tests
nuevos en rojo válido (fallo de aserción `toEqual`, no de import/sintaxis).
Los 73 tests preexistentes siguen en verde. Salida real:

```
 FAIL  tests/unit/ai-cascade.test.ts > extractSchedule > image content parts sent to the model > sends a single image as a file part with mediaType and bare base64 data, not a deprecated image part
AssertionError: expected [ { type: 'image', …(1) } ] to deeply equal [ { type: 'file', …(2) } ]

- Expected
+ Received

  [
    {
-     "data": "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
-     "mediaType": "image/png",
-     "type": "file",
+     "image": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
+     "type": "image",
    },
  ]

 FAIL  tests/unit/ai-cascade.test.ts > extractSchedule > image content parts sent to the model > sends each image in a multi-image upload as its own file part with its own mediaType
AssertionError: expected [ { type: 'image', …(1) }, …(1) ] to deeply equal [ { type: 'file', …(2) }, …(1) ]

- Expected
+ Received

  [
    {
-     "data": "AAAA",
-     "mediaType": "image/png",
-     "type": "file",
+     "image": "data:image/png;base64,AAAA",
+     "type": "image",
    },
    {
-     "data": "BBBB",
-     "mediaType": "image/jpeg",
-     "type": "file",
+     "image": "data:image/jpeg;base64,BBBB",
+     "type": "image",
    },
  ]

 FAIL  tests/unit/ai-cascade.test.ts > extractSchedule > image content parts sent to the model > keeps a text part alongside the file part when both text and an image are provided
AssertionError: expected [ { type: 'text', …(1) }, …(1) ] to deeply equal [ { type: 'text', …(1) }, …(1) ]

- Expected
+ Received

@@ -2,10 +2,9 @@
    {
      "text": "Horario del segundo semestre",
      "type": "text",
    },
    {
-     "data": "CCCC",
-     "mediaType": "image/webp",
-     "type": "file",
+     "image": "data:image/webp;base64,CCCC",
+     "type": "image",
    },
  ]

 FAIL  tests/unit/ai-cascade.test.ts > extractSchedule > image content parts sent to the model > ignores a malformed data URL instead of sending a corrupt content part
AssertionError: expected [ { type: 'image', …(1) }, …(1) ] to deeply equal [ { type: 'file', …(2) } ]

- Expected
+ Received

  [
    {
-     "data": "VALID",
-     "mediaType": "image/png",
-     "type": "file",
+     "image": "not-a-data-url",
+     "type": "image",
+   },
+   {
+     "image": "data:image/png;base64,VALID",
+     "type": "image",
    },
  ]

 Test Files  1 failed | 8 passed (9)
      Tests  4 failed | 73 passed (77)
```

No hizo falta andamiaje en `src/`: `buildUserContent`/`extractSchedule` ya existen y compilan, solo producen la forma incorrecta de content part — el fallo ya es de aserción por sí solo.

## BASE_TESTS

(se llena con el SHA del commit del contrato)
