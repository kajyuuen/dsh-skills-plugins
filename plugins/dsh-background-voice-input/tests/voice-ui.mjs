import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { runInThisContext } from 'node:vm'

const checkout = process.env.DSH_TEST_REPO
if (!checkout) throw new Error('Set DSH_TEST_REPO to a DSH source checkout with installed dependencies')
const requireCheckout = createRequire(resolve(checkout, 'package.json'))
const requireConversation = createRequire(resolve(checkout, 'packages/client/ui-conversation/package.json'))
const { JSDOM } = requireCheckout('jsdom')
const React = requireConversation('react')
const jsx = requireConversation('react/jsx-runtime')
const { createRoot } = requireConversation('react-dom/client')
const { act } = React
const dom = new JSDOM('<!doctype html><html><head></head><body><div id="root"></div></body></html>', { url: 'http://localhost' })
globalThis.window = dom.window
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator })
globalThis.document = dom.window.document
globalThis.IS_REACT_ACT_ENVIRONMENT = true
let frame, component, injected, disposeStream, stopped = 0, transcribed = 0, conflict = false
const inserted = [], effects = []
globalThis.requestAnimationFrame = callback => { frame = callback; return 1 }
globalThis.cancelAnimationFrame = () => { frame = undefined }
const icon = name => () => React.createElement('svg', { 'data-icon': name })
const primitives = {
  Button: ({ children, size: _size, variant: _variant, ...props }) => React.createElement('button', props, children),
  Tooltip: ({ children }) => children,
  StateDot: () => React.createElement('i'),
  Modal: ({ children }) => React.createElement('div', {}, children),
  IconCloseOutlineRegular: icon('close'),
  IconStopFillRegular: icon('stop'),
  IconMicrophoneOutlineRegular: icon('mic'),
}
const catalog = { providers: [{ id: 'local', preparation: { phase: 'ready' } }],
  selection: { providerId: 'local', language: 'ja' }, maxDurationSeconds: 4, maxAudioBytes: 100000 }
const ctx = {
  effect: install => { effects.push(install()) },
  inject: (names, install) => {
    assert.deepEqual(names, ['remote.speech', 'slots', 'locale', 'pluginNavigation'])
    install(ctx)
    const ready = Promise.resolve()
    ready.dispose = async () => {}
    return ready
  },
  pluginNavigation: { openBundle() {} },
  slots: {
    inject: (key, install) => {
      assert.equal(key, 'conversation.input.activity', 'original settings and setup prompt must not be overridden')
      install()
    },
    register: (options, view) => {
      assert.equal(options.priority, -1)
      assert.equal(options.locale, 'voice-input')
      injected = options.inject()
      component = view
      return () => {}
    },
  },
  locale: { register() { throw new Error('the original locale must be reused') } },
  remote: {
    $stream: () => ({
      async *[Symbol.asyncIterator]() {
        yield { value: catalog, accept() {} }
        await new Promise(resolve => { disposeStream = resolve })
      },
      async dispose() { disposeStream?.() },
    }),
    speech: {
      transcribe: async request => {
        assert.ok(request.audioBase64); assert.equal(request.providerId, 'local')
        transcribed++
        return { ok: true, value: { text: 'Recognized text' } }
      },
    },
  },
}
window.__ModuleLoader__ = { load: row => {
  assert.equal(row.id, '@kajyuuen/dsh-background-voice-input')
  const plugin = row.factory(id => {
    if (id === 'react') return React
    if (id === 'react/jsx-runtime') return jsx
    if (id === '@deepseek-ai/dsh-client-ui-primitives') return primitives
    if (id === '@deepseek-ai/dsh-client-store') return { createSnapshotStore: initial => {
      let state = initial
      return { getSnapshot: () => state, set: value => { state = value } }
    } }
    if (id === '@deepseek-ai/dsh-api-gateway/client') return { RemoteStreamCarrierError: Error }
    throw new Error(`Unexpected external ${id}`)
  })
  assert.deepEqual(plugin.inject, ['remote', 'slots', 'locale', 'pluginNavigation'])
  globalThis.pluginStart = plugin.apply(ctx)
} }
class Recorder {
  constructor() { this.state = 'inactive'; this.mimeType = 'audio/webm' }
  start() { this.state = 'recording' }
  stop() {
    this.state = 'inactive'
    this.ondataavailable?.({ data: new Blob(['audio']) })
    this.onstop?.()
    stopped++
  }
}
class Context {
  createAnalyser() { return { getFloatTimeDomainData: samples => samples.fill(0.2) } }
  createMediaStreamSource() { return { connect() {} } }
  decodeAudioData() { return Promise.resolve({ duration: 0.5 }) }
  close() { return Promise.resolve() }
}
class Offline {
  createBufferSource() { return { connect() {}, start() {} } }
  startRendering() { return Promise.resolve({ getChannelData: () => new Float32Array([0.2]) }) }
}
globalThis.MediaRecorder = Recorder
globalThis.AudioContext = Context
globalThis.OfflineAudioContext = Offline
Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia: async () => ({ getTracks: () => [{ stop() {} }] }) } })
// The active app already has the official CSS tag, but its compiled class hash can differ.
const originalStyle = document.createElement('style')
originalStyle.dataset.pluginCss = '@deepseek-ai/dsh-experimental-client-ui-voice-input/VoiceInput.module.css'
originalStyle.textContent = '.old_voice_waveform { height: 300px; }'
document.head.append(originalStyle)
runInThisContext(readFileSync(new URL('../client.js', import.meta.url), 'utf8'))
const disposePlugin = await globalThis.pluginStart
const root = createRoot(document.getElementById('root'))
let sessionId = 'A'
const inputActions = {
  captureInsertion: () => ({ revision: 1 }),
  insertText: text => { inserted.push(text); return !conflict },
}
const dictionary = { dictate: 'Dictate', start: 'Start recording', stop: 'Stop and transcribe',
  cancel: 'Cancel', recording: 'Recording…', requesting: 'Allow microphone access…',
  transcribingShort: 'Transcribing…', conflict: 'Your draft changed.',
  insert: 'Insert text', discard: 'Discard transcript', empty: 'No speech recognized' }
const t = (key, vars) => dictionary[key] || (key === 'failed' ? `Speech failed: ${vars.message}` : key)
const render = () => act(async () => root.render(React.createElement(component,
  { sessionId, inputActions, locked: false, onActiveChange() {}, ...injected,
    useSpeechReadiness: selector => selector(injected.hooks.speechReadiness.getSnapshot()), t })))
const click = label => act(async () => document.querySelector(`[aria-label="${label}"]`).click())
const flush = () => act(async () => { await new Promise(resolve => setTimeout(resolve, 0)) })
try {
  await render()
  assert.ok(document.querySelector('[aria-label="Start recording"] [data-icon="mic"]'))
  const forkStyle = document.querySelector('style[data-plugin-css="@kajyuuen/dsh-background-voice-input/VoiceInput.module.css"]')
  assert.ok(forkStyle, 'fork CSS must load even when an official tag is already present')
  assert.ok(document.head.contains(originalStyle), 'official CSS must remain untouched')
  await click('Start recording'); await flush()
  assert.equal(window.getComputedStyle(document.querySelector('[data-voice-activity="recording"]')).display, 'flex')
  const svg = document.querySelector('svg[role="img"]')
  assert.equal(window.getComputedStyle(svg).height, '24px', 'waveform must not expand the composer')
  assert.equal(svg.querySelectorAll('line').length, 80)
  const newest = svg.querySelector('line:last-child')
  assert.equal(newest.getAttribute('y1'), '19')
  frame(100)
  assert.notEqual(newest.getAttribute('y1'), '19', 'official microphone animation is retained')
  window.dispatchEvent(new window.Event('blur'))
  document.dispatchEvent(new window.Event('visibilitychange'))
  assert.equal(stopped, 0, 'losing focus must not stop capture')
  await click('Stop and transcribe'); await flush()
  assert.deepEqual(inserted, ['Recognized text'])
  assert.equal(transcribed, 1)
  conflict = true
  await click('Start recording'); await flush(); await click('Stop and transcribe'); await flush()
  assert.ok(document.body.textContent.includes('Your draft changed.'))
  conflict = false
  await act(async () => { [...document.querySelectorAll('button')].find(button => button.textContent === 'Insert text').click() })
  assert.equal(inserted.length, 3)
  await click('Start recording'); await flush()
  const before = stopped
  sessionId = 'B'; await render()
  assert.equal(stopped, before + 1, 'session switch stops microphone')
  assert.equal(transcribed, 2, 'session switch does not transcribe old audio')
  await click('Start recording'); await flush(); await click('Cancel')
  assert.equal(transcribed, 2, 'explicit cancellation does not transcribe')
  console.log('PASS: exact bundled official UI, live waveform, background recording, conflict, session switch, cancellation')
} finally {
  await act(async () => root.unmount())
  await disposePlugin()
  for (const effect of effects.reverse()) await effect?.()
  dom.window.close()
}
