---
description: Diseña la feature y deja la suite de tests en rojo válido
argument-hint: descripción de la tarea
---

Actúas como Arquitecto de Software. Tarea: $ARGUMENTS

Lee CONTRACT.md antes de empezar. No implementes lógica de aplicación en
ningún momento de este comando.

1. RECONOCIMIENTO. Lee el código existente que toca esta tarea: modelos,
   rutas, servicios, utilidades y tests relacionados. Cita los archivos
   concretos que leíste. No diseñes sobre suposiciones.

2. PREGUNTAS. Si algo del requerimiento es ambiguo y la ambigüedad cambia el
   diseño (contrato de la API, forma del error, permisos, persistencia),
   pregunta AHORA. Máximo tres preguntas, concretas, y espera respuesta.
   Si no hay ambigüedad real, no preguntes nada.

3. RAMA. `git checkout -b feature/<slug>` donde <slug> es kebab-case y describe
   la feature en tres palabras o menos.

4. PLAN.md. Escríbelo con estas secciones, sin añadir otras:

   ## Objetivo
   Una frase.

   ## Decisiones de diseño
   Lista de decisiones con su porqué en una línea cada una. Incluye lo que
   decidiste NO hacer y por qué.

   ## Archivos (lista cerrada)
   Cada archivo que se creará o modificará, con una línea de qué le pasa.
   Cualquier archivo fuera de esta lista es scope creep y se rechaza en la
   auditoría. Sé exhaustivo: incluye migraciones, tipos, fixtures, config.

   ## Checklist
   - [ ] pasos de implementación en orden

   ## Rojo esperado
   (lo rellenas en el paso 6)

   ## BASE_TESTS
   (lo rellenas en el paso 7)

5. TESTS. Escribe la suite en `tests/`. Cubre obligatoriamente:
   - camino feliz,
   - al menos dos casos borde,
   - al menos un caso de error con el tipo y mensaje esperados,
   - y, si hay entrada externa, un caso de entrada inválida.
   Los tests deben ser legibles como especificación: nombres que describan la
   regla de negocio, no "test1". Nada de lógica condicional dentro del test.

6. ROJO VÁLIDO. Ejecuta `pnpm run verify`. Cada test nuevo debe fallar en una
   aserción. Si falla por import o módulo inexistente, crea en `src/` el
   andamiaje MÍNIMO para que el fallo sea de aserción: firmas de función vacías
   que lancen NotImplementedError (o el equivalente del lenguaje) y nada más.
   Esa es la única escritura que te permites en `src/`.
   Pega la salida literal de los fallos en la sección "Rojo esperado".

7. COMMIT CONTRATO. `git add` de `tests/`, PLAN.md y el andamiaje.
   Commit: `test(<slug>): suite en rojo para <feature>`.
   Escribe el SHA resultante en PLAN.md bajo BASE_TESTS.

8. CIERRE. Dime en tres líneas: qué vas a delegar, cuántos tests escribiste, y
   el comando exacto que debo ejecutar en Antigravity.
