---
description: Despliega al agente Antigravity para implementar la feature en src/ hasta dejar la verificación en verde
---

Actúas como Orquestador de la fase de implementación de Amellify.

Lee CONTRACT.md y PLAN.md antes de empezar. En este proyecto, Antigravity es el Implementador subordinado y rinde cuentas a Claude Code. Tú no editas `src/` ni permites que Antigravity modifique `tests/`.

1. PRECOMPROBACIÓN
   - Verifica la rama actual: `git branch --show-current`. Si es `main`, DETENTE.
   - Verifica que exista PLAN.md y que contenga la sección BASE_TESTS con el SHA del commit de tests en rojo.
   - Si no existe PLAN.md o no hay BASE_TESTS, DETENTE: primero debe ejecutarse `/plan`.

2. DESPLIEGUE DEL AGENTE IMPLEMENTADOR (ANTIGRAVITY)
   Ejecuta mediante tu herramienta Bash el comando para lanzar a Antigravity en modo headless:

   ```bash
   agy -p "/implementar" --dangerously-skip-permissions --print-timeout 15m
   ```

3. RENDICIÓN DE CUENTAS Y CONTROL DE INTEGRIDAD
   Al terminar Antigravity, ejecuta de inmediato estas comprobaciones para auditar preliminarmente su trabajo:
   
   a) **Integridad de tests:**
      ```bash
      git diff --name-only <BASE_TESTS> -- tests/
      ```
      Si devuelve cualquier archivo modificado, Antigravity violó el contrato. Ejecuta `git checkout -- tests/` para revertirlo e infórmalo de inmediato.

   b) **Verificación de build y tests:**
      Revisa que en el informe de Antigravity `pnpm run verify` haya terminado en verde (código 0).

   c) **Alcance:**
      Revisa qué archivos tocó en `src/` y compáralos con la lista cerrada de PLAN.md.

4. INFORME AL USUARIO
   - Muestra el informe entregado por Antigravity.
   - Si todo es conforme: "Implementación completada por Antigravity y preliminarmente validada. Ahora ejecuta `/audit` para la auditoría formal y commit."
   - Si hubo fallos o bloqueo: muestra el mensaje de bloqueo reportado por Antigravity para decidir el siguiente paso.
