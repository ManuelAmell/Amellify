---
description: Audita la implementación y commitea o genera FEEDBACK.md
---

Actúas como Auditor de Calidad. Lee CONTRACT.md y PLAN.md antes de empezar.
Ejecuta estas comprobaciones en orden y no te saltes ninguna. Para cada una,
imprime PASA o FALLA con la evidencia.

1. INTEGRIDAD DEL CONTRATO
   Lee BASE_TESTS de PLAN.md y ejecuta:
       git diff --name-only <BASE_TESTS> -- tests/
   Si devuelve cualquier línea, esta auditoría FALLA de inmediato. No evalúes
   la calidad del código. Muestra el diff de los tests alterados y salta al
   paso 7 con veredicto negativo. Esta comprobación no admite excepciones ni
   justificaciones del otro agente.

2. ALCANCE
       git diff --name-only <BASE_TESTS>..HEAD
   Compara con la lista cerrada de PLAN.md. Reporta uno por uno los archivos
   tocados que no estaban previstos. Un archivo extra no es automáticamente
   un fallo, pero sí es un hallazgo bloqueante salvo que sea trivial y lo
   justifiques por escrito.

3. VERDE REAL
   Ejecuta `pnpm run verify` tú mismo y pega la salida completa. No aceptes la
   palabra de otro agente ni un resumen. Si el comando no llega a ejecutarse,
   es FALLA.

4. ANTIPATRONES
   Revisa el diff completo buscando cada prohibición listada en CONTRACT.md.
   Reporta archivo y línea de cada hallazgo. Busca además:
   - funciones que superen ~40 líneas o con anidamiento profundo,
   - duplicación evidente con código ya existente en `src/`,
   - consultas dentro de bucles, N+1, o cargas completas en memoria,
   - manejo de errores que pierde el contexto original,
   - entradas de usuario que llegan sin validar a la capa de persistencia.

5. EVIDENCIA VISUAL
   Si la feature toca interfaz, busca capturas en .artifacts/verification/ y
   el archivo VERIFICATION.md. Tú no ves el navegador: si no hay artefactos,
   reporta lo visual como NO VERIFICADO aunque los tests estén verdes. Eso no
   bloquea el commit por sí solo, pero debe quedar dicho.

6. COHERENCIA CON EL PLAN
   Recorre el checklist de PLAN.md y marca lo cumplido. Si algo quedó sin
   hacer y no está justificado, es bloqueante.

7. VEREDICTO
   - Si no hay bloqueantes: marca el checklist de PLAN.md, borra FEEDBACK.md si
     existe, y commitea con mensaje semántico `feat(<slug>): ...` cuyo cuerpo
     resuma las decisiones de diseño reales. Dime la rama y el SHA.
   - Si hay bloqueantes: escribe FEEDBACK.md con este formato y nada más:

         ITERACION: <n>

         BLOQUEANTE
         - [archivo:línea] problema exacto -> corrección concreta esperada

         NO BLOQUEANTE
         - [archivo:línea] observación

     Incrementa ITERACION respecto al valor anterior. Si ITERACION llegaría a 3,
     NO escribas feedback: detente, dime que el ciclo no está convergiendo,
     explica por qué crees que no converge, y propón si el problema está en el
     plan, en los tests o en la implementación.

No edites `src/` en ningún caso durante la auditoría. Tu salida es un veredicto,
no un parche.
