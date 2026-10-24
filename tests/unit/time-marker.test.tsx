import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TimeMarker } from '@/components/schedule/time-marker'

// TimeMarker reads the live wall clock via getZonedParts; overriding that
// single function (without touching src/) makes the marker position
// deterministic. The rest of the time helpers stay real.
const overrides = vi.hoisted(() => ({
  zonedParts: null as { dayIndex: number; secondsOfDay: number } | null,
}))

vi.mock('@/lib/utils/time', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/utils/time')>()
  return {
    ...actual,
    getZonedParts: (date: Date, timeZone?: string) =>
      overrides.zonedParts ?? actual.getZonedParts(date, timeZone ?? actual.DEFAULT_TIMEZONE),
  }
})

const WEEKDAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'] as const

beforeEach(() => {
  overrides.zonedParts = null
})

describe('TimeMarker', () => {
  it('renders nothing when the current day is not among the active columns', () => {
    overrides.zonedParts = { dayIndex: 6, secondsOfDay: 36000 } // Sábado
    const { container } = render(
      <TimeMarker
        startHour={6}
        endHour={16}
        slotHeightPx={56}
        activeDays={[...WEEKDAYS]}
      />
    )

    expect(container.firstElementChild).toBeNull()
    expect(screen.queryByRole('img')).toBeNull()
  })

  it('renders nothing when the current time is outside the grid hours', () => {
    overrides.zonedParts = { dayIndex: 3, secondsOfDay: 4 * 3600 } // 04:00 < startHour 6
    const { container } = render(
      <TimeMarker
        startHour={6}
        endHour={16}
        slotHeightPx={56}
        activeDays={[...WEEKDAYS]}
      />
    )

    expect(container.firstElementChild).toBeNull()
  })

  it('positions the marker inside the current day column at the current time', () => {
    // Miércoles (weekday index 2 of 5) at 10:30 → top spans 4.5 slots × 56px.
    overrides.zonedParts = { dayIndex: 3, secondsOfDay: 10 * 3600 + 30 * 60 }
    const { container } = render(
      <TimeMarker
        startHour={6}
        endHour={16}
        slotHeightPx={56}
        activeDays={[...WEEKDAYS]}
      />
    )

    const marker = container.firstElementChild as HTMLElement | null
    expect(marker).toBeTruthy()
    expect(marker!.style.top).toBe('252px') // (10.5h - 6h) / 1h * 56px
    expect(marker!.style.left).toBe('40%') // column 3 of 5
    expect(marker!.style.width).toBe('20%')
    expect(marker!.className).toContain('pointer-events-none')
  })

  it('keeps rendering at the exact closing hour of the grid range', () => {
    // secondsOfDay === endHour*3600 is still inside the marker window.
    overrides.zonedParts = { dayIndex: 3, secondsOfDay: 16 * 3600 }
    const { container } = render(
      <TimeMarker
        startHour={6}
        endHour={16}
        slotHeightPx={56}
        activeDays={[...WEEKDAYS]}
      />
    )

    const marker = container.firstElementChild as HTMLElement | null
    expect(marker).toBeTruthy()
    expect(marker!.style.top).toBe('560px') // 10 slots × 56px
  })
})
