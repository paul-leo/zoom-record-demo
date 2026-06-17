/**
 * React hook over the detector client.
 *
 *   import { useMeetingDetector } from 'meetcap-detector/react'
 *   const { meeting, isInMeeting } = useMeetingDetector()
 *
 * `react` is an optional peer dependency.
 */
import { useEffect, useState } from 'react'
import type { MeetingInfo } from 'meetcap-core'
import { createDetectorClient } from './renderer'

export function useMeetingDetector(): { meeting: MeetingInfo | null; isInMeeting: boolean } {
  const [meeting, setMeeting] = useState<MeetingInfo | null>(null)

  useEffect(() => {
    const client = createDetectorClient()
    client.on('meeting-detected', (m) => setMeeting(m))
    client.on('meeting-ended', () => setMeeting(null))
    return () => client.destroy()
  }, [])

  return { meeting, isInMeeting: meeting !== null }
}
