import type { MeetingInfo, MeetingRule, ProcessInfo, WindowSource, DetectorEvent } from 'meetcap-core'
import { presets, toMatcher } from './rules'

export interface DetectorConfig {
  /** Rules to match against. Defaults to the built-in `presets`. */
  rules?: MeetingRule[]
  /**
   * Precision policy:
   * - `'window'` (default): a window-title match is enough; the process name is
   *   attached as a confidence cue when available.
   * - `'window+process'`: require BOTH a window title and a process of the SAME
   *   rule to match — fewer false positives, needs the client actually running.
   */
  require?: 'window' | 'window+process'
}

/** First rule whose window matcher hits one of the given sources. */
export function matchWindow(sources: WindowSource[], rules: MeetingRule[]): MeetingInfo | null {
  for (const rule of rules) {
    const test = toMatcher(rule.window)
    const hit = sources.find((s) => test(s.name))
    if (hit) return { id: rule.id, app: rule.app, windowName: hit.name, sourceId: hit.id }
  }
  return null
}

/** First rule whose process matcher hits one of the given processes. */
export function matchProcess(
  procs: ProcessInfo[],
  rules: MeetingRule[],
): { rule: MeetingRule; process: string } | null {
  for (const rule of rules) {
    const test = toMatcher(rule.process)
    const hit = procs.find((p) => test(p.name))
    if (hit) return { rule, process: hit.name }
  }
  return null
}

/**
 * Pure detection: given the current window sources and processes, return the
 * matched meeting (or null). This is what the main-process poller calls each tick.
 */
export function resolveMeeting(
  sources: WindowSource[],
  procs: ProcessInfo[],
  config: DetectorConfig = {},
): MeetingInfo | null {
  const rules = config.rules ?? presets
  const policy = config.require ?? 'window'

  const win = matchWindow(sources, rules)
  if (!win) return null

  if (policy === 'window+process') {
    const rule = rules.find((r) => r.id === win.id)
    const test = toMatcher(rule?.process)
    const hit = procs.find((p) => test(p.name))
    if (!hit) return null
    return { ...win, process: hit.name }
  }

  // 'window' policy — attach the process of the same rule as a cue if present.
  const rule = rules.find((r) => r.id === win.id)
  const test = toMatcher(rule?.process)
  const proc = procs.find((p) => test(p.name))
  return { ...win, process: proc?.name ?? null }
}

/**
 * Edge detector: turns a stream of per-tick results into detected/ended events.
 * Mirrors the lab's `lastHadMeeting` logic but as a pure, testable unit.
 */
export function createDetectionState() {
  let current: MeetingInfo | null = null
  return {
    /** Feed one detection result; returns an edge event, or null if unchanged. */
    update(result: MeetingInfo | null): DetectorEvent | null {
      const had = current !== null
      const has = result !== null
      if (has && !had) {
        current = result
        return { type: 'meeting-detected', meeting: result }
      }
      if (!has && had) {
        current = null
        return { type: 'meeting-ended', meeting: null }
      }
      current = result
      return null
    },
    get current(): MeetingInfo | null {
      return current
    },
  }
}
