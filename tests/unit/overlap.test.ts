import { describe, expect, it } from 'vitest'
import { hasOverlap, packOverlappingIntervals, schedulesOverlap } from '@/lib/utils/overlap'

interface Block {
  id: string
  start: number
  end: number
}

function pack(blocks: Block[]) {
  return packOverlappingIntervals(blocks, (b) => b.start, (b) => b.end)
}

describe('packOverlappingIntervals', () => {
  it('returns an empty array for no items', () => {
    expect(pack([])).toEqual([])
  })

  it('gives every block its own lane when nothing overlaps', () => {
    const blocks: Block[] = [
      { id: 'a', start: 0, end: 60 },
      { id: 'b', start: 60, end: 120 }, // touches but doesn't overlap
      { id: 'c', start: 200, end: 260 },
    ]
    const result = pack(blocks)
    for (const r of result) {
      expect(r.lane).toBe(0)
      expect(r.laneCount).toBe(1)
    }
  })

  it('packs two overlapping blocks into two lanes', () => {
    const blocks: Block[] = [
      { id: 'a', start: 0, end: 100 },
      { id: 'b', start: 50, end: 150 },
    ]
    const result = pack(blocks)
    const byId = Object.fromEntries(result.map((r) => [(r.item as Block).id, r]))
    expect(byId.a!.laneCount).toBe(2)
    expect(byId.b!.laneCount).toBe(2)
    expect(byId.a!.lane).not.toBe(byId.b!.lane)
  })

  it('packs three-in-a-row overlaps (chain) into a single cluster', () => {
    // a overlaps b, b overlaps c, but a and c don't directly overlap.
    // They still form one transitive cluster and need >= 2 lanes.
    const blocks: Block[] = [
      { id: 'a', start: 0, end: 60 },
      { id: 'b', start: 30, end: 90 },
      { id: 'c', start: 60, end: 120 },
    ]
    const result = pack(blocks)
    const byId = Object.fromEntries(result.map((r) => [(r.item as Block).id, r]))
    // All three share the same laneCount (one cluster).
    expect(byId.a!.laneCount).toBe(byId.b!.laneCount)
    expect(byId.b!.laneCount).toBe(byId.c!.laneCount)
    // a and c can reuse a's lane (a ends at 60, c starts at 60) but b needs its own.
    expect(byId.a!.lane).not.toBe(byId.b!.lane)
    expect(byId.c!.lane).not.toBe(byId.b!.lane)
  })

  it('handles three-way simultaneous overlap with three lanes', () => {
    const blocks: Block[] = [
      { id: 'a', start: 0, end: 100 },
      { id: 'b', start: 0, end: 100 },
      { id: 'c', start: 0, end: 100 },
    ]
    const result = pack(blocks)
    const lanes = new Set(result.map((r) => r.lane))
    expect(lanes.size).toBe(3)
    for (const r of result) expect(r.laneCount).toBe(3)
  })

  it('keeps separate clusters independent (partial overlaps that split into two groups)', () => {
    const blocks: Block[] = [
      { id: 'a', start: 0, end: 60 },
      { id: 'b', start: 30, end: 90 }, // overlaps a -> cluster 1
      { id: 'c', start: 200, end: 260 },
      { id: 'd', start: 230, end: 290 }, // overlaps c -> cluster 2
    ]
    const result = pack(blocks)
    const byId = Object.fromEntries(result.map((r) => [(r.item as Block).id, r]))
    expect(byId.a!.laneCount).toBe(2)
    expect(byId.c!.laneCount).toBe(2)
  })

  it('treats identical start/end blocks as fully overlapping', () => {
    const blocks: Block[] = [
      { id: 'a', start: 100, end: 200 },
      { id: 'b', start: 100, end: 200 },
    ]
    const result = pack(blocks)
    const byId = Object.fromEntries(result.map((r) => [(r.item as Block).id, r]))
    expect(byId.a!.laneCount).toBe(2)
    expect(byId.a!.lane).not.toBe(byId.b!.lane)
  })

  it('does not treat back-to-back (touching) intervals as overlapping', () => {
    const blocks: Block[] = [
      { id: 'a', start: 0, end: 60 },
      { id: 'b', start: 60, end: 120 },
    ]
    const result = pack(blocks)
    for (const r of result) expect(r.laneCount).toBe(1)
  })
})

describe('hasOverlap', () => {
  it('detects a simple overlap', () => {
    expect(hasOverlap({ start: 0, end: 100 }, { start: 50, end: 150 })).toBe(true)
  })

  it('does not flag touching intervals as overlapping', () => {
    expect(hasOverlap({ start: 0, end: 60 }, { start: 60, end: 120 })).toBe(false)
  })

  it('does not flag disjoint intervals', () => {
    expect(hasOverlap({ start: 0, end: 60 }, { start: 100, end: 160 })).toBe(false)
  })
})

describe('schedulesOverlap', () => {
  it('ignores different days entirely', () => {
    expect(
      schedulesOverlap(
        { day: 'Lunes', startTime: '08:00', endTime: '10:00' },
        { day: 'Martes', startTime: '08:00', endTime: '10:00' }
      )
    ).toBe(false)
  })

  it('detects an overlap on the same day', () => {
    expect(
      schedulesOverlap(
        { day: 'Lunes', startTime: '08:00', endTime: '10:00' },
        { day: 'Lunes', startTime: '09:00', endTime: '11:00' }
      )
    ).toBe(true)
  })

  it('allows back-to-back classes on the same day', () => {
    expect(
      schedulesOverlap(
        { day: 'Lunes', startTime: '08:00', endTime: '10:00' },
        { day: 'Lunes', startTime: '10:00', endTime: '12:00' }
      )
    ).toBe(false)
  })
})
