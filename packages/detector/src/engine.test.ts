import { describe, it, expect } from 'vitest'
import { matchWindow, matchProcess, resolveMeeting, createDetectionState } from './engine'
import { presets } from './rules'
import type { MeetingRule } from 'meetcap-core'

const win = (name: string, id = 'window:1') => ({ id, name })
const proc = (name: string, pid = 1) => ({ name, pid })

describe('matchWindow', () => {
  it('matches the localized Zoom title "Zoom会议"', () => {
    const m = matchWindow([win('Zoom会议')], presets)
    expect(m?.id).toBe('zoom')
    expect(m?.app).toBe('Zoom')
    expect(m?.windowName).toBe('Zoom会议')
  })

  it('matches English "Zoom Meeting"', () => {
    expect(matchWindow([win('Zoom Meeting')], presets)?.id).toBe('zoom')
  })

  it('does not match a plain browser tab title', () => {
    expect(matchWindow([win('Inbox (3) - Google Chrome')], presets)).toBeNull()
    expect(matchWindow([win('zoom pricing - notes')], presets)).toBeNull()
  })

  it('returns null when nothing matches', () => {
    expect(matchWindow([win('Finder'), win('微信')], presets)).toBeNull()
  })
})

describe('matchProcess', () => {
  it('finds the zoom process', () => {
    expect(matchProcess([proc('zoom.us'), proc('Finder')], presets)?.rule.id).toBe('zoom')
    expect(matchProcess([proc('CptHost')], presets)?.rule.id).toBe('zoom')
  })

  it('returns null when no meeting process is running', () => {
    expect(matchProcess([proc('Finder'), proc('node')], presets)).toBeNull()
  })
})

describe('resolveMeeting', () => {
  it('window policy: title alone is enough, process attached as cue', () => {
    const m = resolveMeeting([win('Zoom会议')], [proc('zoom.us')], { require: 'window' })
    expect(m?.id).toBe('zoom')
    expect(m?.process).toBe('zoom.us')
  })

  it('window policy: title without process still matches (process=null)', () => {
    const m = resolveMeeting([win('Zoom会议')], [proc('Finder')], { require: 'window' })
    expect(m?.id).toBe('zoom')
    expect(m?.process).toBeNull()
  })

  it('window+process policy: requires both of the same rule', () => {
    expect(resolveMeeting([win('Zoom会议')], [proc('Finder')], { require: 'window+process' })).toBeNull()
    expect(resolveMeeting([win('Zoom会议')], [proc('zoom.us')], { require: 'window+process' })?.id).toBe('zoom')
  })

  it('supports a fully custom rule', () => {
    const rules: MeetingRule[] = [{ id: 'mymeet', app: 'MyMeet', window: [/MyMeet 通话/], process: [/mymeet/i] }]
    const m = resolveMeeting([win('MyMeet 通话中')], [proc('mymeet-helper')], { rules })
    expect(m?.id).toBe('mymeet')
    expect(m?.app).toBe('MyMeet')
  })

  it('supports a function window matcher', () => {
    const rules: MeetingRule[] = [{ id: 'fn', app: 'Fn', window: (t) => t.includes('SECRET') }]
    expect(resolveMeeting([win('a SECRET call')], [], { rules })?.id).toBe('fn')
    expect(resolveMeeting([win('nothing')], [], { rules })).toBeNull()
  })
})

describe('createDetectionState', () => {
  it('emits detected on entry and ended on exit, nothing in between', () => {
    const s = createDetectionState()
    const zoom = { id: 'zoom', app: 'Zoom', windowName: 'Zoom会议' }
    expect(s.update(null)).toBeNull()
    expect(s.update(zoom)).toEqual({ type: 'meeting-detected', meeting: zoom })
    expect(s.update(zoom)).toBeNull() // still in meeting → no repeat
    expect(s.current).toBe(zoom)
    expect(s.update(null)).toEqual({ type: 'meeting-ended', meeting: null })
    expect(s.update(null)).toBeNull()
    expect(s.current).toBeNull()
  })
})
