import assert from 'node:assert/strict'
import { access, mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { apply, Config } from '../lib/index.js'

const root = await mkdtemp(join(tmpdir(), 'dsh-handy-plugin-test-'))
let provider
let spawnSpec
const ctx = {
  logger: { warn() {} },
  effect(factory) { factory() },
  speechToText: {
    register(value) { provider = value; return async () => {} },
  },
  subprocess: {
    async resolveExecutable(value) { return value },
    spawn(spec) {
      spawnSpec = spec
      const outputs = {
        stdout: { readFrom: () => ({ text: '{"text":" テスト結果 ","best_ms":125}', lossy: false }) },
        stderr: { readFrom: () => ({ text: '', lossy: false }) },
      }
      return { done: Promise.resolve({ exitCode: 0, signal: null }), collected: outputs }
    },
  },
}
apply(ctx, Config({ dataRoot: root, executable: '/mock/handy', model: 'whisper-large' }))
assert.ok(provider)
assert.deepEqual(provider.info.languages, ['auto', 'zh', 'en', 'yue', 'ja', 'ko'])

const audio = new Uint8Array(44 + 32000)
const view = new DataView(audio.buffer)
for (const [offset, text] of [[0, 'RIFF'], [8, 'WAVE'], [12, 'fmt '], [36, 'data']]) {
  for (let index = 0; index < text.length; index++) audio[offset + index] = text.charCodeAt(index)
}
view.setUint32(4, audio.length - 8, true)
view.setUint32(16, 16, true)
view.setUint16(20, 1, true)
view.setUint16(22, 1, true)
view.setUint32(24, 16000, true)
view.setUint32(28, 32000, true)
view.setUint16(32, 2, true)
view.setUint16(34, 16, true)
view.setUint32(40, audio.length - 44, true)

const result = await provider.transcribe({ audio, language: 'auto' }, new AbortController().signal)
assert.deepEqual(result, { text: 'テスト結果', audioSeconds: 1, inferenceSeconds: 0.125 })
assert.equal(spawnSpec.argv[0], '/mock/handy')
assert.deepEqual(spawnSpec.argv.slice(1, 3), ['--transcribe-file', spawnSpec.argv[2]])
assert.ok(spawnSpec.argv[2].endsWith('/input.wav'))
assert.deepEqual(spawnSpec.argv.slice(3), ['--json', '--model', 'whisper-large'])
await assert.rejects(access(spawnSpec.cwd))

await rm(root, { recursive: true, force: true })
console.log('handy-local smoke test passed')
