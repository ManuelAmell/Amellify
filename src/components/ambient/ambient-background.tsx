/**
 * Fixed backdrop rendered behind <main> so the Liquid Glass `backdrop-filter`
 * layers (sidebar, header, bottom nav, dialogs...) have something organic to
 * refract instead of a flat solid color. Plan section 2.1 / 2.2.
 *
 * - Pure CSS: a mesh of radial gradients ("blobs") in brand + accent hues at
 *   low alpha, blurred, slow-drifting.
 * - A subtle SVG feTurbulence noise layer breaks up gradient banding on large
 *   displays without shipping an external texture asset.
 * - `prefers-reduced-motion: reduce` freezes the blobs (handled purely in
 *   CSS via the `motion-safe:animate-float-*` utilities below — no JS
 *   media-query listener needed, so this can stay a server component).
 * - `aria-hidden` + `pointer-events-none`: decorative only.
 */
export function AmbientBackground() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-background"
    >
      {/* Blob 1 — primary teal, upper-left */}
      <div
        className="motion-safe:animate-[float-slow_22s_ease-in-out_infinite] absolute -left-[10%] -top-[15%] h-[55vmax] w-[55vmax] rounded-full opacity-60 blur-[90px] will-change-transform"
        style={{
          background:
            'radial-gradient(circle at 30% 30%, color-mix(in oklch, var(--primary) 55%, transparent), transparent 70%)',
        }}
      />
      {/* Blob 2 — accent coral, right side */}
      <div
        className="motion-safe:animate-[float-slower_28s_ease-in-out_infinite] absolute -right-[15%] top-[10%] h-[50vmax] w-[50vmax] rounded-full opacity-40 blur-[100px] will-change-transform"
        style={{
          background:
            'radial-gradient(circle at 60% 40%, color-mix(in oklch, var(--accent) 50%, transparent), transparent 70%)',
        }}
      />
      {/* Blob 3 — cool surface wash, lower center, anchors dark mode */}
      <div
        className="motion-safe:animate-[float-slow_26s_ease-in-out_infinite] absolute bottom-[-20%] left-[20%] h-[60vmax] w-[60vmax] rounded-full opacity-50 blur-[110px] will-change-transform"
        style={{
          background:
            'radial-gradient(circle at 50% 50%, color-mix(in oklch, var(--info) 30%, transparent), transparent 70%)',
        }}
      />

      {/* Fine noise overlay to break up gradient banding — generated inline, no asset. */}
      <svg className="absolute inset-0 h-full w-full opacity-[0.035] mix-blend-overlay dark:opacity-[0.05]">
        <filter id="amellify-noise">
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#amellify-noise)" />
      </svg>

      {/* Soft vignette so content near the viewport edges stays legible. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse at center, transparent 40%, color-mix(in oklch, var(--background) 55%, transparent) 100%)',
        }}
      />
    </div>
  )
}
