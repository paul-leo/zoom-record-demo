// CallRecorder SDK — contextIsolation-compatible rewrite of the prototype.
//
// Detection runs in main (via window.recorderBridge over IPC).
// Capture + recording run here in the renderer (getUserMedia / AudioContext /
// MediaRecorder are renderer-only Web APIs).
//
// Events:
//   'meeting-detected'    -> { app, windowName, sourceId }
//   'meeting-ended'       -> void
//   'recording-complete'  -> { blob, durationMs, meeting }
//   'error'               -> Error
//   'log'                 -> string   (lab-only: surface internal steps to the UI)

class CallRecorderSDK {
  constructor() {
    this.listeners = new Map()
    this.detectTimer = null
    this.mediaRecorder = null
    this.cleanup = null
    this.chunks = []
    this.startedAt = 0
    this.activeMeeting = null
    this.lastHadMeeting = false
  }

  on(event, fn) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set())
    this.listeners.get(event).add(fn)
    return this
  }

  emit(event, payload) {
    this.listeners.get(event)?.forEach((fn) => fn(payload))
  }

  init(intervalMs = 3000) {
    const tick = async () => {
      try {
        // Dual signal: window title (says "in a meeting") + process name (robust,
        // no i18n). Title is the trigger; process is logged as a confidence cue.
        const meeting = await window.recorderBridge.detectMeeting()
        const hasMeeting = meeting !== null

        if (hasMeeting && !this.lastHadMeeting) {
          const proc = await window.recorderBridge.detectProcess()
          this.activeMeeting = { ...meeting, process: proc?.name || null }
          this.lastHadMeeting = true
          this.emit('meeting-detected', this.activeMeeting)
        }
        if (!hasMeeting && this.lastHadMeeting) {
          this.lastHadMeeting = false
          this.emit('meeting-ended')
          if (this.mediaRecorder?.state === 'recording') this._stop()
          this.activeMeeting = null
        }
      } catch (err) {
        this.emit('error', err)
      }
    }
    this.detectTimer = setInterval(tick, intervalMs)
    tick()
  }

  // Build a single stream mixing microphone + system/loopback audio.
  // This is the make-or-break step on macOS.
  async _buildMixedStream() {
    this.emit('log', 'getUserMedia(mic)…')
    const mic = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
    this.emit('log', `mic tracks: ${mic.getAudioTracks().length}`)

    // Electron 38: legacy getUserMedia({mandatory:{chromeMediaSource:'desktop'}})
    // crashes the renderer ("bad IPC message, reason 263"). The supported path is
    // getDisplayMedia, routed through main's setDisplayMediaRequestHandler which
    // injects { audio: 'loopback' }. We ask for video too (required to trigger the
    // handler) then immediately drop the video track — we only want the audio.
    this.emit('log', 'getDisplayMedia(loopback audio)…')
    // electron-audio-loopback: enable the loopback display-media handler (which
    // also injected the macOS feature flags at startup), capture, then disable.
    await window.recorderBridge.enableLoopbackAudio()
    let system
    try {
      system = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true })
    } finally {
      await window.recorderBridge.disableLoopbackAudio()
    }
    system.getVideoTracks().forEach((t) => t.stop())
    const sysTracks = system.getAudioTracks().length
    this.emit('log', `system audio tracks: ${sysTracks}${sysTracks === 0 ? '  ⚠️ EMPTY — no loopback' : ''}`)

    const ctx = new AudioContext()
    const dest = ctx.createMediaStreamDestination()
    ctx.createMediaStreamSource(mic).connect(dest)
    if (sysTracks > 0) ctx.createMediaStreamSource(system).connect(dest)

    return {
      mixed: dest.stream,
      hasSystemAudio: sysTracks > 0,
      cleanup: () => {
        mic.getTracks().forEach((t) => t.stop())
        system.getTracks().forEach((t) => t.stop())
        ctx.close()
      },
    }
  }

  async startRecording() {
    if (this.mediaRecorder?.state === 'recording') return
    try {
      const { mixed, cleanup, hasSystemAudio } = await this._buildMixedStream()
      this.cleanup = cleanup
      this.chunks = []
      this.startedAt = Date.now()

      const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm'

      this.mediaRecorder = new MediaRecorder(mixed, { mimeType: mime })
      this.mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) this.chunks.push(e.data)
      }
      this.mediaRecorder.start(1000)
      this.emit('log', `recording started (systemAudio=${hasSystemAudio})`)
    } catch (err) {
      this.emit('error', err)
    }
  }

  stopRecording() {
    this._stop()
  }

  _stop() {
    if (!this.mediaRecorder || this.mediaRecorder.state === 'inactive') return
    this.mediaRecorder.onstop = () => {
      const blob = new Blob(this.chunks, { type: this.mediaRecorder.mimeType })
      this.emit('recording-complete', {
        blob,
        durationMs: Date.now() - this.startedAt,
        meeting: this.activeMeeting,
      })
      this.chunks = []
      this.cleanup?.()
      this.cleanup = null
    }
    this.mediaRecorder.stop()
  }

  destroy() {
    if (this.detectTimer) clearInterval(this.detectTimer)
    this._stop()
    this.listeners.clear()
  }
}

window.createCallRecorderSDK = () => new CallRecorderSDK()
