# Sistema de diseño: Liquid Glass

Cómo está construida la interfaz hoy. Fuentes: `src/app/globals.css`, `src/components/ui/`, `src/components/ambient/`, `src/components/theme-provider.tsx` y `src/config/subject-colors.ts`.

## Temas

- Hay dos temas reales: **claro** y **oscuro**. La clase `.dark` en `<html>` activa los tokens oscuros (`globals.css`, bloque `.dark`). `color-scheme` cambia con el tema.
- `ThemeProvider` (`next-themes`) usa `attribute="class"`, `defaultTheme="system"` y `enableSystem`. Sin `disableTransitionOnChange`, para que el cambio de tema anime las superficies de cristal.
- Ajustes > Apariencia ofrece **Claro**, **Oscuro** y **Sistema** (`src/components/settings/settings-view.tsx`, `useTheme`). El tipo de preferencia en `src/db/schema.ts` es `'light' | 'dark' | 'system'`.
- **Tokyo Night no existe en el código.** El README lo menciona, pero no hay tokens, clase ni opción de tema con ese nombre (búsqueda sin resultados en el repo). No documentar ni asumir ese tema hasta que se implemente.

## Tokens

Todos los colores son `oklch` y se definen como variables CSS en `:root` (claro) y `.dark` (oscuro). Tailwind los expone en `@theme` con alias `--color-*`.

- **Superficies neutras** (frías, ligeramente azules): `--surface-0` (fondo de página) a `--surface-3` (divisores y bordes).
- **Texto:** `--ink-1` (texto principal) y `--ink-2` (texto secundario). Los comentarios en el CSS indican contrastes de 7:1 o más sobre el fondo (por ejemplo, 17.3:1 para `--ink-1`).
- **Marca:** `--brand-primary` (teal) y `--brand-accent` (coral). Dark las aclara.
- **Semántica:** `--success`, `--warning`, `--danger`, `--info`, cada una con su `-foreground`.
- **Alias shadcn:** `--background`, `--foreground`, `--card`, `--primary`, `--muted`, `--border`, `--ring` y similares, para que los componentes de `ui/` funcionen con las utilidades de Tailwind (`bg-primary`, `text-muted-foreground`).
- **Materias:** `--subject-blue`, `--subject-red`, `--subject-green`, `--subject-orange`, `--subject-purple`, `--subject-teal`. Hay versión clara y oscura.
- **Cristal:** `--glass-bg`, `--glass-bg-strong`, `--glass-bg-fallback`, `--glass-blur` (24px), `--glass-blur-lg` (28px), `--glass-saturate` (180%), bordes y sombras (`--glass-highlight`, `--glass-shadow-ambient`, `--glass-shadow-key`, `--glass-shadow-tint`).
- **Radios:** `--radius-xs` (8px) a `--radius-2xl` (28px), más `--radius-pill`.
- **Movimiento:** `--ease-fluid`, `--ease-spring`, `--duration-fast` (150ms), `--duration-base` (250ms), `--duration-slow` (400ms).

Regla: usar siempre los tokens o las utilidades que los mapean. No escribir hex ni `rgb()` en componentes (hay 78 coincidencias de colores literales o arbitrarios en `src/components` y `src/app`; revisar antes de añadir más).

## Superficies de cristal

Cuatro utilidades de Tailwind definidas con `@utility` en `globals.css`:

| Clase | Uso previsto | Fondo | Blur |
| --- | --- | --- | --- |
| `glass-chrome` | Barras y paneles de navegación (sidebar, header, bottom nav) | `--glass-bg-strong` | 24px |
| `glass-card` | Tarjetas por defecto (`Card` usa este tier) | `--glass-bg` | 24px |
| `glass-float` | Contenido elevado: héroes, paneles flotantes | `--glass-bg-strong` | 28px |
| `glass-inset` | Campos o zonas hundidas | `--surface-2` al 70 % | 12px |

- `glass-tint-primary` tiñe el cristal con el color de marca para acciones destacadas sobre cristal.
- Cada cristal lleva un borde degradado de 1px (`::before` con máscara) y un brillo interior (`--glass-highlight`).
- **Sin soporte de `backdrop-filter`** (`@supports not`): el cristal pasa a fondo opaco (`--glass-bg-fallback`), para que el texto no quede ilegible.
- El cristal tiene sentido solo sobre el fondo animado. `AmbientBackground` (`src/components/ambient/ambient-background.tsx`) renderiza manchas de color difuminadas detrás de `<main>`, fijas y con `-z-10`. Sin ese fondo, el blur no tiene nada que refractar.

## Componentes (`src/components/ui/`)

22 primitivas, la mayoría sobre Radix UI con `class-variance-authority` (cva) y `cn()` de `src/lib/utils.ts`:

`alert-dialog`, `avatar`, `badge`, `button`, `card`, `command`, `dialog`, `dropdown-menu`, `error-state`, `input`, `label`, `progress`, `scroll-area`, `select`, `separator`, `sheet`, `skeleton`, `sonner`, `switch`, `tabs`, `textarea`, `tooltip`.

Convenciones observadas:

- **Variantes con cva.** `button.tsx` define `variant` (`default`, `destructive`, `outline`, `secondary`, `ghost`, `link`, `accent`, `glass`, `glass-primary`) y `size` (`default`, `sm`, `lg`, `icon`). Añadir variantes ahí, no en cada uso.
- **`asChild`** con `@radix-ui/react-slot` cuando un botón debe ser un enlace.
- **`Card` = `GlassCard`.** Recibe `tier` (`chrome`, `card`, `float`). El valor por defecto es `card`.
- **`ref` con `forwardRef`** y `displayName` en la mayoría de primitivas (`badge`, `skeleton`, `error-state` y `sonner` son funciones simples sin `forwardRef`).
- **Animación de entrada** con `motion-safe:animate-glass-in`, nunca sin el prefijo `motion-safe:`.
- **Foco visible** con `focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2`.
- **Estados vacío, carga y error** con `error-state.tsx` y `skeleton.tsx`. Existen `loading.tsx` y `error.tsx` por ruta.
- **Materias:** no construir clases dinámicas (`bg-subject-${color}`), porque Tailwind no las genera. Usar `SUBJECT_COLOR_CLASSES` de `src/config/subject-colors.ts` con las utilidades `subject-chip`, `subject-dot` y `subject-text`. Cada una lee `--subject`, que definen las clases `.subject-<color>`.

## Movimiento

- Las animaciones decorativas o en bucle (`float-slow`, `float-slower`, `shimmer`, `glass-in`) van detrás de `prefers-reduced-motion: no-preference` o del prefijo `motion-safe:`.
- `motion-safe:active:scale-[0.97]` en los botones: retroalimentación al pulsar, solo con movimiento permitido.
- Scrollbars finas con tokens de superficie (`globals.css`, `@layer base`).

## Accesibilidad

Estado observado, no una auditoría completa:

- Textos y controles en español con `aria-label` en controles sin texto visible (hay 15 `aria-label` en `src/components`; por ejemplo, navegación de días en `schedule-grid.tsx` y el área de subida en `ai-import-dialog.tsx`).
- `aria-hidden` y `pointer-events-none` en elementos decorativos (`AmbientBackground`).
- Foco visible en botones y campos.
- Los contrastes de tokens se documentan en comentarios del CSS, pero no hay comprobación automática en `verify`.
- `lang="es"` y el export `viewport` (con `viewportFit: 'cover'`) están en `src/app/layout.tsx`.
- Sin `eslint-disable` en `src/` (verificado con grep).

## Qué no hacer

- No hardcodear colores ni sombras nuevas en componentes: añadir token en `globals.css`.
- No introducir clases dinámicas de Tailwind.
- No usar `backdrop-filter` fuera de las cuatro utilidades de cristal. Así se mantienen el fallback y el coste de render.
- No quitar el prefijo `motion-safe:` de animaciones de bucle.
- No añadir un tema nuevo (por ejemplo Tokyo Night) sin tokens completos para claro y oscuro y sin actualizar el tipo de preferencias en `src/db/schema.ts`.
