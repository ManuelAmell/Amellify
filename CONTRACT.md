# Contrato de trabajo entre agentes

Este archivo es la fuente única de verdad. Claude Code y Antigravity lo leen
al empezar cualquier tarea. Si algo aquí contradice a otro archivo, manda este.

## Comando canónico de verificación

    pnpm run verify

Encadena, en orden y parando en el primer fallo: `eslint .` → `tsc --noEmit` →
`vitest run`. No incluye la suite e2e de Playwright (`pnpm test:e2e`): esa
suite necesita la app y Postgres corriendo de verdad y ya la ejecuta
`.github/workflows/ci.yml` por separado; meterla en el loop rápido de TDD lo
haría demasiado lento e inestable para iterar función por función.

"Verde" significa: este comando, ejecutado completo, sale con código 0.
Ninguna otra definición de verde es válida. Nadie declara algo verde sin pegar
la salida real del comando en la conversación.

## Reglas de oro (ningún agente las incumple por ningún motivo)

1. `tests/` pertenece a Claude Code. Antigravity no lo edita, ni lo borra,
   ni lo renombra, ni "arregla" un test que le parezca mal escrito.
2. `src/` pertenece a Antigravity. Claude Code lo lee y lo critica, no lo edita.
3. PLAN.md y FEEDBACK.md pertenecen a Claude Code, salvo que FEEDBACK.md se
   borra por parte de Antigravity cuando termina de resolverlo.
4. Las ramas y los commits pertenecen a Claude Code. Antigravity nunca commitea.
5. Nunca se trabaja ni se commitea directamente en `main`. Toda tarea vive en
   una rama `feature/<slug>`.

## Prohibiciones de implementación

Está prohibido hacer pasar un test por cualquiera de estas vías:
- Marcadores de omisión: skip, xfail, .only, .todo, t.Skip, o comentar aserciones.
- Supresión de tipos o de linter: any, @ts-ignore, @ts-expect-error sin
  justificación escrita, # type: ignore, eslint-disable, noqa.
- Esperas artificiales: sleep, setTimeout, reintentos ciegos dentro de tests.
- Mockear el propio sujeto bajo prueba.
- Bloques catch/except vacíos o que se traguen el error.
- Valores devueltos a fuego para satisfacer una aserción concreta.
- Credenciales, tokens o rutas absolutas de tu máquina en el código.

Si un test parece genuinamente mal escrito: DETENTE y dilo. No lo corrijas.

## Definición de "rojo válido"

Un test en rojo es válido solo si se ejecuta completo y falla en una ASERCIÓN,
con un mensaje comparando lo esperado contra lo recibido.
Un fallo por import, módulo inexistente o sintaxis NO es un test en rojo:
es un test roto, y no sirve como contrato.

## Ciclo de una tarea

1. Claude Code: `/plan <tarea>` → rama, PLAN.md, tests en rojo válido,
   COMMIT CONTRATO (los tests se commitean rojos; su SHA queda en PLAN.md).
2. Antigravity: `/implementar` → escribe solo en `src/` hasta que
   `pnpm run verify` esté verde. Deja evidencia visual en
   `.artifacts/verification/` si hay UI.
3. Claude Code: `/audit` → comprueba que los tests no se tocaron, que el alcance
   coincide con PLAN.md, ejecuta `pnpm run verify` él mismo, y commitea o
   escribe FEEDBACK.md.

Máximo 2 rondas de FEEDBACK.md por tarea. En la tercera, el ciclo se detiene
y se escala a la persona.
