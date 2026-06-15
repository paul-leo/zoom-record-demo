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
})

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

$('btn-start').onclick = async () => {
  await sdk.startRecording()
  $('btn-stop').disabled = false
}

$('btn-dismiss').onclick = () => $('banner').classList.remove('show')
$('btn-stop').onclick = () => sdk.stopRecording()
