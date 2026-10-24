import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ClassBlock } from '@/components/schedule/class-block'
import { makeCourse, makeSchedule } from './helpers/fixtures'

describe('ClassBlock', () => {
  it('renders code, name and an accessible label with day and times', () => {
    render(
      <ClassBlock course={makeCourse()} schedule={makeSchedule()} topPx={60} heightPx={100} />
    )

    expect(screen.getByText('CALC1')).toBeTruthy()
    expect(screen.getByText('Cálculo I')).toBeTruthy()
    expect(
      screen.getByRole('button', { name: 'Cálculo I, Lunes 08:00 a 10:00, Salón A-101' })
    ).toBeTruthy()
  })

  it('invokes onClick when the block is clicked', () => {
    const onClick = vi.fn()
    render(
      <ClassBlock
        course={makeCourse()}
        schedule={makeSchedule()}
        topPx={60}
        heightPx={100}
        onClick={onClick}
      />
    )

    fireEvent.click(screen.getByRole('button'))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('formats times as 12h when timeFormat24h is off', () => {
    render(
      <ClassBlock
        course={makeCourse()}
        schedule={makeSchedule()}
        topPx={0}
        heightPx={100}
        timeFormat24h={false}
      />
    )

    expect(
      screen.getByRole('button', { name: 'Cálculo I, Lunes 8:00 AM a 10:00 AM, Salón A-101' })
    ).toBeTruthy()
  })

  it('hides the title for very compact blocks and the footer for short ones', () => {
    // heightPx < 38 → no title; heightPx < 68 → no room/professor footer.
    const { rerender } = render(
      <ClassBlock course={makeCourse()} schedule={makeSchedule()} topPx={0} heightPx={30} />
    )
    expect(screen.queryByText('Cálculo I')).toBeNull()
    expect(screen.queryByText('A-101')).toBeNull()

    // Taller block keeps the title but still skips the footer below 68px.
    rerender(
      <ClassBlock course={makeCourse()} schedule={makeSchedule()} topPx={0} heightPx={55} />
    )
    expect(screen.getByText('Cálculo I')).toBeTruthy()
    expect(screen.queryByText('A-101')).toBeNull()

    // Full-height block shows room + professor first name.
    rerender(
      <ClassBlock course={makeCourse()} schedule={makeSchedule()} topPx={0} heightPx={90} />
    )
    expect(screen.getByText('A-101')).toBeTruthy()
    expect(screen.getByText('Gabriel')).toBeTruthy()
  })

  it('omits the footer when the block shares a narrow lane', () => {
    render(
      <ClassBlock
        course={makeCourse()}
        schedule={makeSchedule()}
        topPx={0}
        heightPx={90}
        lane={1}
        laneCount={2}
      />
    )

    expect(screen.getByText('Cálculo I')).toBeTruthy()
    // Footer (room + professor) is dropped entirely in shared lanes.
    expect(screen.queryByText('A-101')).toBeNull()
    expect(screen.queryByText('Gabriel')).toBeNull()
  })
})
