import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { TimeMarker } from '@/components/schedule/time-marker'

describe('TimeMarker', () => {
  it('no renderiza cuando no hay marcador activo o días vacíos', () => {
    const { container } = render(<TimeMarker startHour={6} endHour={22} slotHeightPx={58} activeDays={[]} />)
    expect(container.innerHTML).toBe('')
  })
})
