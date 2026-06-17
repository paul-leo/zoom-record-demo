// Lab UI wiring. Drives the SDK and surfaces every step so we can judge,
// concretely, whether the approach is viable on this machine/platform.

const $ = (id) => document.getElementById(id)
const logEl = $('log')
function log(msg) {
  const t = new Date().toISOString().slice(11, 19)
  logEl.textContent += `[${t}] ${msg}\n`
  logEl.scrollTop = logEl.scrollHeight
}

function setPill(el, text, cls) {
  el.textContent = text
  el.className = 'pill' + (cls ? ' ' + cls : '')
}

const sdk = window.createCallRecorderSDK()

sdk.on('log', (m) => log(m))
sdk.on('error', (e) => log('ERROR: ' + (e?.message || e)))

sdk.on('meeting-detected', (m) => {
  log(`meeting-detected: ${m.app} — "${m.windowName}"`)
  $('banner-app').textContent = m.app
  $('banner').classList.add('show')
  setPill($('det-state'), 'meeting', 'ok')
})

sdk.on('meeting-ended', () => {
  log('meeting-ended')
  $('banner').classList.remove('show')
  setPill($('det-state'), 'no meeting', '')
})

sdk.on('recording-complete', ({ blob, durationMs, meeting }) => {
  log(`recording-complete: ${(blob.size / 1024).toFixed(1)} KB, ${(durationMs / 1000).toFixed(1)}s`)
  const url = URL.createObjectURL(blob)
  $('result').innerHTML =
    `<div class="k" style="margin-top:12px">recorded ${(durationMs / 1000).toFixed(1)}s · ${(blob.size / 1024).toFixed(1)} KB · ${meeting?.app || '?'}</div>`
  const audio = document.createElement('audio')
  audio.controls = true
  audio.src = url
  $('result').appendChild(audio)
  $('btn-stop').disabled = true

  // Persist to disk: blob bytes → main → ~/Downloads/meeting-capture/*.webm
  saveToDisk(blob, meeting)
})

async function saveToDisk(blob, meeting) {
  try {
    const buffer = await blob.arrayBuffer()
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    const appName = (meeting?.app || 'meeting').replace(/\s+/g, '-')
    const filename = `tanka-call-${appName}-${stamp}.webm`
    const filePath = await window.recorderBridge.saveRecording(buffer, filename)
    log(`saved → ${filePath}`)
    const note = document.createElement('div')
    note.className = 'k'
    note.style.marginTop = '6px'
    note.textContent = `saved → ${filePath}`
    $('result').appendChild(note)
  } catch (err) {
    log('ERROR saving file: ' + (err?.message || err))
  }
}

// ── permission status ────────────────────────────────────────────────────────
async function refreshPerms() {
  const p = await window.recorderBridge.mediaAccess()
  const map = { granted: 'ok', denied: 'bad', restricted: 'bad', 'not-determined': 'warn', 'n/a': '', unknown: 'warn' }
  setPill($('perm-screen'), `screen: ${p.screen}`, map[p.screen] ?? 'warn')
  setPill($('perm-mic'), `mic: ${p.microphone}`, map[p.microphone] ?? 'warn')
  log(`platform=${p.platform} screen=${p.screen} mic=${p.microphone}`)
}
refreshPerms()

// ── buttons ──────────────────────────────────────────────────────────────────
$('btn-init').onclick = () => {
  log('detection started (poll 3s)')
  setPill($('det-state'), 'scanning', 'warn')
  sdk.init(3000)
  $('btn-init').disabled = true
}

$('btn-list').onclick = async () => {
  const wins = await window.recorderBridge.listWindows()
  log(`--- ${wins.length} sources ---`)
  wins.forEach((w) => log(`  ${w.id}  ${w.name}`))
}

let recTimer = null
function enterRecordingUI() {
  $('banner-idle-text').style.display = 'none'
  $('banner-rec-text').style.display = ''
  $('btn-start').style.display = 'none'
  $('btn-dismiss').style.display = 'none'
  $('btn-stop-banner').style.display = ''
  $('btn-stop').disabled = false
  const start = Date.now()
  recTimer = setInterval(() => {
    const s = Math.floor((Date.now() - start) / 1000)
    $('rec-timer').textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
  }, 500)
}
function exitRecordingUI() {
  if (recTimer) { clearInterval(recTimer); recTimer = null }
  $('banner-idle-text').style.display = ''
  $('banner-rec-text').style.display = 'none'
  $('btn-start').style.display = ''
  $('btn-dismiss').style.display = ''
  $('btn-stop-banner').style.display = 'none'
  $('btn-stop').disabled = true
}

async function startRecording() {
  log('starting recording…')
  enterRecordingUI()
  await sdk.startRecording()
}
function stopRecording() {
  log('stopping recording…')
  sdk.stopRecording()
  exitRecordingUI()
}

$('btn-start').onclick = startRecording
$('btn-stop-banner').onclick = stopRecording
$('btn-stop').onclick = stopRecording
$('btn-dismiss').onclick = () => $('banner').classList.remove('show')
