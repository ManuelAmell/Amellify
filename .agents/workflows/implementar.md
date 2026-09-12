---
description: Implementa la feature planificada hasta dejar la verificación en verde
---

1. ORIENTACIÓN
   - Si existe FEEDBACK.md, léelo: tiene prioridad absoluta sobre todo lo demás.
     Resuelve primero cada punto BLOQUEANTE, luego los NO BLOQUEANTES que sean
     razonables. Bórralo cuando lo hayas resuelto entero.
   - Si no existe FEEDBACK.md, lee PLAN.md.
   - Lee CONTRACT.md.
   - Confirma la rama actual con `git branch --show-current`. Debe ser una rama
     `feature/...`. Si estás en main, DETENTE y avisa.

2. LECTURA DE LA ESPECIFICACIÓN
   Lee todos los tests de tests/ que afecten a esta feature y enumérame, en
   lenguaje natural, qué comportamiento exige cada uno. Esa lista es tu
   definición de terminado. No empieces a escribir hasta haberla producido.

3. RECONOCIMIENTO DEL CÓDIGO
   Lee los archivos de src/ listados en PLAN.md y sus vecinos directos.
   Identifica los patrones existentes que vas a seguir (manejo de errores,
   validación, acceso a datos, inyección de dependencias).

4. IMPLEMENTACIÓN
   Trabaja archivo por archivo, siguiendo el orden del checklist de PLAN.md.
   Escribe solo en los archivos de la lista cerrada. Tras cada archivo
   completado, ejecuta pnpm run verify para ver el progreso, aunque siga en rojo.

5. BUCLE HASTA VERDE
   Repite: ejecutar pnpm run verify, leer el primer fallo real, corregir la causa.
   No cambies de estrategia por frustración: si llevas 5 intentos sobre el mismo
   test sin progreso, detente y explícame qué crees que está pasando, con el
   error exacto y tu hipótesis.
   Antes de declarar verde, ejecuta también:
       git diff --name-only -- tests/
   Debe salir vacío. Si no lo está, has incumplido el contrato: revierte esos
   archivos con `git checkout -- tests/` y avísame de inmediato.

6. VERIFICACIÓN VISUAL (solo si la feature toca interfaz)
   Levanta la aplicación, ábrela en el navegador integrado y comprueba el flujo
   real que describe PLAN.md, incluyendo al menos un estado de error y un estado
   vacío o de carga. Guarda las capturas en .artifacts/verification/ con nombres
   descriptivos. Escribe VERIFICATION.md con: qué probaste, qué viste, qué no
   pudiste probar y por qué. El auditor no ve tu navegador; sin ese archivo,
   para él lo visual no está verificado.

7. INFORME FINAL
   Responde exactamente con este bloque y nada más:

       Implementación completada.
       Rama: <rama>
       pnpm run verify: verde  (pega las últimas 10 líneas de la salida)
       Tests intactos: sí  (git diff --name-only -- tests/ vacío)
       Archivos tocados: <lista completa>
       Fuera de PLAN.md: <lista, o "ninguno">
       Verificación visual: <sí con artefactos / no aplica>
       Hallazgos fuera de alcance: <lista, o "ninguno">
       Listo para /audit en Claude Code.
