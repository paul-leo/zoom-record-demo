/**
 * Renderer-side recorder. Captures microphone + system (loopback) audio, mixes
 * them with the Web Audio API, records to a webm/opus Blob, and saves to disk
 * via `window.meetcap`.
 *
 *   import { createRecorder } from 'meetcap-recorder/renderer'
 *   const rec = createRecorder()
 *   rec.on('complete', async (r) => { await rec.save(r) })
 *   await rec.start(meeting)
 *   // …later: rec.stop()
 *
 * Requires `window.meetcap` (see meetcap-core/preload) and the main process to
 * have called `initRecorderMain()`.
 */
import type { MeetingInfo, RecordingResult } from 'meetcap-core'
import { buildFilename, pickMimeType } from './util'

export type RecorderState = 'idle' | 'recording'

export interface CreateRecorderOptions {
  /** Filename prefix for saved recordings. Default `meetcap`. */
  filenamePrefix?: string
}

type StateHandler = (state: RecorderState) => void
type CompleteHandler = (result: RecordingResult) => void
type ErrorHandler = (err: unknown) => void

export interface Recorder {
  on(event: 'statechange', fn: StateHandler): Recorder
  on(event: 'complete', fn: CompleteHandler): Recorder
  on(event: 'error', fn: ErrorHandler): Recorder
  /** Start capturing. `meeting` is attached to the result for naming/metadata. */
  start(meeting?: MeetingInfo | null): Promise<void>
  /** Stop capturing; fires `complete` with the recorded blob. */
  stop(): void
  /** Persist a finished recording to disk; returns the absolute path. */
  save(result: RecordingResult): Promise<string>
  readonly state: RecorderState
  destroy(): void
}

interface MixedStream {
  mixed: MediaStream
  hasSystemAudio: boolean
  cleanup: () => void
}

async function buildMixedStream(): Promise<MixedStream> {
  const mic = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })

  // electron-audio-loopback: enable the loopback display-media handler, capture,
  // then disable. We ask for video (required to trigger the handler) and drop it.
  await window.meetcap.enableLoopbackAudio()
  let system: MediaStream
  try {
    system = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true })
  } finally {
    await window.meetcap.disableLoopbackAudio()
  }
  system.getVideoTracks().forEach((t) => t.stop())
  const hasSystemAudio = system.getAudioTracks().length > 0

  const ctx = new AudioContext()
  const dest = ctx.createMediaStreamDestination()
  ctx.createMediaStreamSource(mic).connect(dest)
  if (hasSystemAudio) ctx.createMediaStreamSource(system).connect(dest)

  return {
    mixed: dest.stream,
    hasSystemAudio,
    cleanup: () => {
      mic.getTracks().forEach((t) => t.stop())
      system.getTracks().forEach((t) => t.stop())
      void ctx.close()
    },
  }
}

export function createRecorder(options: CreateRecorderOptions = {}): Recorder {
  const prefix = options.filenamePrefix ?? 'meetcap'
  const stateHandlers = new Set<StateHandler>()
  const completeHandlers = new Set<CompleteHandler>()
  const errorHandlers = new Set<ErrorHandler>()

  let state: RecorderState = 'idle'
  let mediaRecorder: MediaRecorder | null = null
  let cleanup: (() => void) | null = null
  let chunks: Blob[] = []
  let startedAt = 0
  let meeting: MeetingInfo | null = null
  let hasSystemAudio = false

  const setState = (s: RecorderState) => {
    state = s
    stateHandlers.forEach((fn) => fn(s))
  }
  const emitError = (err: unknown) => errorHandlers.forEach((fn) => fn(err))

  const recorder: Recorder = {
    on(event, fn) {
      if (event === 'statechange') stateHandlers.add(fn as StateHandler)
      else if (event === 'complete') completeHandlers.add(fn as CompleteHandler)
      else errorHandlers.add(fn as ErrorHandler)
      return recorder
    },

    async start(m = null) {
      if (mediaRecorder?.state === 'recording') return
      meeting = m
      try {
        const built = await buildMixedStream()
        cleanup = built.cleanup
        hasSystemAudio = built.hasSystemAudio
        chunks = []
        startedAt = Date.now()

        const mimeType = pickMimeType()
        mediaRecorder = new MediaRecorder(built.mixed, { mimeType })
        mediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunks.push(e.data)
        }
        mediaRecorder.start(1000)
        setState('recording')
      } catch (err) {
        emitError(err)
        cleanup?.()
        cleanup = null
      }
    },

    stop() {
      if (!mediaRecorder || mediaRecorder.state === 'inactive') return
      const mr = mediaRecorder
      mr.onstop = () => {
        const result: RecordingResult = {
          blob: new Blob(chunks, { type: mr.mimeType }),
          durationMs: Date.now() - startedAt,
          mimeType: mr.mimeType,
          hasSystemAudio,
          meeting,
        }
        chunks = []
        cleanup?.()
        cleanup = null
        mediaRecorder = null
        setState('idle')
        completeHandlers.forEach((fn) => fn(result))
      }
      mr.stop()
    },

    async save(result) {
      const buffer = await result.blob.arrayBuffer()
      const filename = buildFilename(result.meeting, new Date(), prefix)
      return window.meetcap.saveRecording(buffer, filename)
    },

    get state() {
      return state
    },

    destroy() {
      this.stop()
      stateHandlers.clear()
      completeHandlers.clear()
      errorHandlers.clear()
    },
  }
  return recorder
}
