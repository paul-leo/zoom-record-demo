/**
 * React hook over the recorder.
 *
 *   import { useRecorder } from 'meetcap-recorder/react'
 *   const { start, stop, state, lastResult } = useRecorder()
 *
 * `react` is an optional peer dependency.
 */
import { useEffect, useRef, useState } from 'react'
import type { MeetingInfo, RecordingResult } from 'meetcap-core'
import { createRecorder, type CreateRecorderOptions, type Recorder, type RecorderState } from './renderer'

export interface UseRecorder {
  state: RecorderState
  lastResult: RecordingResult | null
  start: (meeting?: MeetingInfo | null) => Promise<void>
  stop: () => void
  save: (result: RecordingResult) => Promise<string>
}

export function useRecorder(options?: CreateRecorderOptions): UseRecorder {
  const ref = useRef<Recorder | null>(null)
  const [state, setState] = useState<RecorderState>('idle')
  const [lastResult, setLastResult] = useState<RecordingResult | null>(null)

  useEffect(() => {
    const recorder = createRecorder(options)
    ref.current = recorder
    recorder.on('statechange', setState)
    recorder.on('complete', setLastResult)
    return () => recorder.destroy()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return {
    state,
    lastResult,
    start: (meeting) => ref.current?.start(meeting) ?? Promise.resolve(),
    stop: () => ref.current?.stop(),
    save: (result) => ref.current!.save(result),
  }
}
