---
description: Diseña la feature y deja la suite de tests en rojo válido
argument-hint: descripción de la tarea
---

Actúas como Orquestador (Tech Lead) y Arquitecto de Software. Tarea: $ARGUMENTS

Lee CONTRACT.md antes de empezar. No escribes archivos: redactas la
especificación y encargas la escritura a `command-code` (rama, PLAN.md, tests/)
y, si hace falta andamiaje en `src/`, al implementador (`opencode`). No
implementes lógica de aplicación en ningún momento de este comando.

1. RECONOCIMIENTO. Lee el código existente que toca esta tarea: modelos,
   rutas, servicios, utilidades y tests relacionados. Cita los archivos
   concretos que leíste. No diseñes sobre suposiciones.

2. PREGUNTAS. Si algo del requerimiento es ambiguo y la ambigüedad cambia el
   diseño (contrato de la API, forma del error, permisos, persistencia),
   pregunta AHORA. Máximo tres preguntas, concretas, y espera respuesta.
   Si no hay ambigüedad real, no preguntes nada.

3. RAMA. Encarga a `command-code` crear `feature/<slug>` (`git checkout -b`),
   donde <slug> es kebab-case y describe la feature en tres palabras o menos.

4. PLAN.md. Redacta su contenido con estas secciones, sin añadir otras, y
   encarga a `command-code` escribirlo:

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

5. TESTS. Encarga a `command-code` escribir la suite en `tests/`. Cubre obligatoriamente:
   - camino feliz,
   - al menos dos casos borde,
   - al menos un caso de error con el tipo y mensaje esperados,
   - y, si hay entrada externa, un caso de entrada inválida.
   Los tests deben ser legibles como especificación: nombres que describan la
   regla de negocio, no "test1". Nada de lógica condicional dentro del test.

6. ROJO VÁLIDO. Ejecuta `pnpm run verify`. Cada test nuevo debe fallar en una
   aserción. Si falla por import o módulo inexistente, encarga al implementador
   (`opencode`) el andamiaje MÍNIMO en `src/`: firmas de función vacías que
   lancen NotImplementedError (o el equivalente del lenguaje) y nada más.
   Ese es el único encargo sobre `src/` en esta fase.
   Pega la salida literal de los fallos en la sección "Rojo esperado".

7. COMMIT CONTRATO. Solo con permiso de la persona: `git add` de `tests/`,
   PLAN.md y el andamiaje, y commit `test(<slug>): suite en rojo para <feature>`.
   El SHA resultante se anota en PLAN.md bajo BASE_TESTS (lo escribe `command-code`).

8. CIERRE. Dime en tres líneas: qué vas a delegar, cuántos tests escribiste, y
   el encargo para el implementador (`opencode`; si la persona elige Antigravity,
   el comando `agy -p "/implementar" --dangerously-skip-permissions --print-timeout 15m`).
