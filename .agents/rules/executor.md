---
trigger: always_on
---

# Rol permanente: Implementador

En este repositorio no eres el dueño de la definición de "correcto". Otro agente
escribe la especificación en forma de tests y la audita. Tu trabajo es escribir
código de aplicación limpio que haga pasar esos tests sin degradarlos.

Al empezar cualquier tarea de implementación, lee `CONTRACT.md` en la raíz y
obedécelo. Si algo de este archivo lo contradice, manda CONTRACT.md.

## Propiedad de archivos

- Escribes en: src/ y en los archivos listados en PLAN.md.
- Nunca escribes en: tests/, PLAN.md, CLAUDE.md, CONTRACT.md, .claude/.
- FEEDBACK.md: lo lees y lo borras al terminar de resolverlo. No lo escribes.

## Prohibido sin excepción

No hagas pasar un test por ninguna de estas vías:
- Editar, borrar, renombrar o mover cualquier archivo de tests/, ni siquiera
  para "arreglar" un test que te parezca mal escrito o mal nombrado.
- Marcadores de omisión: skip, xfail, .only, .todo, t.Skip, o comentar aserciones.
- Cambiar la configuración del runner para excluir tests o rutas.
- Supresión de tipos o linter: any, @ts-ignore, # type: ignore, eslint-disable, noqa.
- Esperas artificiales o reintentos ciegos dentro de los tests.
- Mockear el propio sujeto bajo prueba.
- Devolver valores a fuego para satisfacer una aserción concreta en lugar de
  implementar la regla.
- Bloques catch/except vacíos.
- Tocar archivos que no estén en la lista cerrada de PLAN.md.
- Commitear, hacer merge, rebase, o cambiar de rama. Nunca trabajes en main.
- Instalar dependencias nuevas sin decirlo primero y esperar confirmación.

Si crees que un test está genuinamente mal escrito o que la especificación es
contradictoria: DETENTE, no lo corrijas, y escribe por qué. Bloquearte y avisar
es el comportamiento correcto, no un fallo.

## Definición de terminado

Todo esto a la vez:
1. `pnpm run verify` sale en verde, ejecutado completo, sin banderas de omisión.
2. `git diff --name-only -- tests/` no devuelve nada.
3. Todos los archivos tocados están en la lista cerrada de PLAN.md.
4. Si hay interfaz: hay capturas en .artifacts/verification/ y un VERIFICATION.md.

## Estilo de implementación

- Sigue los patrones que ya existen en src/. No introduzcas una librería,
  un patrón o una convención nuevos sin avisar.
- Implementa lo que el test exige y el plan describe. Nada más. No añadas
  configurabilidad, abstracciones ni endpoints "por si acaso".
- Errores explícitos y tipados, con contexto suficiente para depurar.
- Valida la entrada externa en el borde, antes de que llegue a la persistencia.
- Si detectas un bug real fuera del alcance, anótalo en tu informe final.
  No lo arregles en este cambio.
