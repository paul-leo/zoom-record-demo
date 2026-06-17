import { describe, it, expect } from 'vitest'
import { pickMimeType, buildFilename } from './util'

describe('pickMimeType', () => {
  it('prefers opus when supported', () => {
    expect(pickMimeType((t) => t === 'audio/webm;codecs=opus')).toBe('audio/webm;codecs=opus')
  })
  it('falls back to audio/webm when opus is not supported', () => {
    expect(pickMimeType(() => false)).toBe('audio/webm')
  })
})

describe('buildFilename', () => {
  const date = new Date('2026-06-17T14:30:45.123Z')

  it('uses the app name and a filesystem-safe timestamp', () => {
    expect(buildFilename({ id: 'zoom', app: 'Zoom' }, date)).toBe('meetcap-Zoom-2026-06-17T14-30-45.webm')
  })
  it('normalizes spaces in the app name', () => {
    expect(buildFilename({ id: 'teams', app: 'Microsoft Teams' }, date)).toBe(
      'meetcap-Microsoft-Teams-2026-06-17T14-30-45.webm',
    )
  })
  it('falls back to "meeting" with no meeting and honors a custom prefix', () => {
    expect(buildFilename(null, date, 'rec')).toBe('rec-meeting-2026-06-17T14-30-45.webm')
  })
})
