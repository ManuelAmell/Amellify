import type { DayOfWeek } from '@/types/domain'
import { timeToMinutes } from '@/lib/utils/time'

export interface PackedBlock<T> {
  item: T
  /** 0-indexed column within this block's overlap cluster. */
  lane: number
  /** Total number of columns in this block's overlap cluster. Use for `width: 100%/laneCount`. */
  laneCount: number
}

/**
 * Column-packs a set of intervals so overlapping ones sit side-by-side
 * instead of stacking on top of each other (plan findings H2/H12: two
 * classes at the same day/time used to render on top of one another,
 * hiding all but the last one drawn).
 *
 * Algorithm (classic calendar "column packing" / interval scheduling):
 * 1. Sort by start (then end) time.
 * 2. Group into clusters of *transitive* overlap — if A overlaps B and B
 *    overlaps C, all three share a cluster even if A and C don't directly
 *    overlap — because they still need to be laid out relative to B.
 * 3. Within each cluster, greedily assign each item to the first lane whose
 *    previous occupant has already ended; open a new lane otherwise.
 *
 * Half-open interval semantics: `[start, end)`. Two blocks that share an
 * exact boundary (one ends exactly when the other starts) do NOT count as
 * overlapping — back-to-back classes don't need separate lanes.
 */
export function packOverlappingIntervals<T>(
  items: T[],
  getStart: (item: T) => number,
  getEnd: (item: T) => number
): PackedBlock<T>[] {
  if (items.length === 0) return []

  const indexed = items.map((item, index) => ({
    item,
    index,
    start: getStart(item),
    end: getEnd(item),
  }))
  indexed.sort((a, b) => a.start - b.start || a.end - b.end || a.index - b.index)

  type Entry = (typeof indexed)[number]
  const clusters: Entry[][] = []
  let current: Entry[] = []
  let clusterEnd = -Infinity

  for (const entry of indexed) {
    if (current.length === 0 || entry.start < clusterEnd) {
      current.push(entry)
      clusterEnd = Math.max(clusterEnd, entry.end)
    } else {
      clusters.push(current)
      current = [entry]
      clusterEnd = entry.end
    }
  }
  if (current.length > 0) clusters.push(current)

  const result: PackedBlock<T>[] = new Array(items.length)

  for (const cluster of clusters) {
    // End time currently occupying each lane; a lane is free once its
    // occupant's end <= the candidate's start.
    const laneEnds: number[] = []

    for (const entry of cluster) {
      let lane = laneEnds.findIndex((end) => end <= entry.start)
      if (lane === -1) {
        lane = laneEnds.length
        laneEnds.push(entry.end)
      } else {
        laneEnds[lane] = entry.end
      }
      result[entry.index] = { item: entry.item, lane, laneCount: 0 } // laneCount filled below
    }

    const laneCount = laneEnds.length
    for (const entry of cluster) {
      const block = result[entry.index]
      if (block) block.laneCount = laneCount
    }
  }

  return result
}

export interface Interval {
  start: number
  end: number
}

/**
 * Simple half-open interval overlap check, in the same units as
 * `packOverlappingIntervals` (typically minutes-from-midnight via
 * `timeToMinutes`). Exposed for form-level validation (plan H12).
 */
export function hasOverlap(a: Interval, b: Interval): boolean {
  return a.start < b.end && b.start < a.end
}

export interface DayTimeRange {
  day: DayOfWeek
  startTime: string
  endTime: string
}

/**
 * Convenience wrapper around `hasOverlap` for schedule-shaped inputs
 * ("HH:MM" strings + day of week) — lets `CourseDialog` (Fase 2 · Agent D)
 * detect overlapping blocks (same course or across courses) without
 * reimplementing day-matching/time-parsing (plan H12: the dialog only
 * validated `start < end`, never checked for overlaps).
 */
export function schedulesOverlap(a: DayTimeRange, b: DayTimeRange): boolean {
  if (a.day !== b.day) return false
  return hasOverlap(
    { start: timeToMinutes(a.startTime), end: timeToMinutes(a.endTime) },
    { start: timeToMinutes(b.startTime), end: timeToMinutes(b.endTime) }
  )
}
