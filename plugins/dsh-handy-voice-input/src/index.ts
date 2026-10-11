/** DeepSeek Harness speech provider backed by Handy's headless WAV transcription CLI. */
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { isAbsolute, join } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-experimental-speech-to-text'
import type {} from '@deepseek-ai/dsh-subprocess'
import type { SpeechProviderId, Transcript } from '@deepseek-ai/dsh-experimental-speech-to-text/types'
import { validateWave } from '@deepseek-ai/dsh-experimental-speech-to-text/wave'
import { Config } from './config.ts'

export { Config } from './config.ts'
export const name = 'speech-to-text-handy-cli'
export const inject = ['speechToText', 'subprocess']

interface HandyResult {
  readonly text: string
  readonly bestMs: number
}

function parseHandyResult(text: string): HandyResult {
  let value: unknown
  try { value = JSON.parse(text) } catch (error) {
    throw new Error('Handy returned invalid JSON', { cause: error })
  }
  if (typeof value !== 'object' || value === null || !('text' in value) || typeof value.text !== 'string'
    || !('best_ms' in value) || typeof value.best_ms !== 'number' || !Number.isFinite(value.best_ms) || value.best_ms < 0) {
    throw new Error('Handy returned an unsupported transcription result')
  }
  return { text: value.text, bestMs: value.best_ms }
}

function diagnostic(stderr: string, lossy: boolean): string {
  const clean = stderr.trim()
  if (!clean) return ''
  return `: ${lossy ? '[truncated] ' : ''}${clean}`
}

/** Register a host-local provider that passes each DSH microphone recording to Handy. */
export function apply(ctx: Context, config: Config): void {
  if (!isAbsolute(config.dataRoot)) throw new Error(`Handy dataRoot must be absolute: ${config.dataRoot}`)

  ctx.effect(() => {
    const unregister = ctx.speechToText.register({
      info: {
        id: config.providerId as SpeechProviderId,
        name: config.providerName,
        location: 'host-local',
        // Handy's persisted language setting owns inference; these hints keep DSH selection compatible.
        languages: config.languages,
      },
      transcribe: async (input, signal): Promise<Transcript> => {
        const audioSeconds = validateWave(input.audio, config.maxDurationSeconds)
        signal.throwIfAborted()
        await mkdir(config.dataRoot, { recursive: true })
        const requestDirectory = await mkdtemp(join(config.dataRoot, 'request-'))
        const wavePath = join(requestDirectory, 'input.wav')
        try {
          await writeFile(wavePath, input.audio, { flag: 'wx' })
          const executable = await ctx.subprocess.resolveExecutable(config.executable, undefined, signal)
          const timeout = AbortSignal.timeout(config.inferenceTimeoutMs)
          const combined = AbortSignal.any([signal, timeout])
          const argv = [executable, '--transcribe-file', wavePath, '--json']
          if (config.model !== undefined) argv.push('--model', config.model)
          if (config.deviceIndex !== undefined) argv.push('--device-index', String(config.deviceIndex))
          const handle = ctx.subprocess.spawn({
            argv,
            cwd: requestDirectory,
            stdio: {
              stdin: 'ignore',
              stdout: { maxBytes: config.maxOutputBytes },
              stderr: { maxBytes: config.maxErrorBytes },
            },
            graceMs: config.graceMs,
            signal: combined,
          })
          const outcome = await handle.done
          combined.throwIfAborted()
          const stdout = handle.collected.stdout?.readFrom(0)
          const stderr = handle.collected.stderr?.readFrom(0)
          if (stdout === undefined || stderr === undefined) throw new Error('Handy output was not collected')
          if (stdout.lossy) throw new Error('Handy JSON output exceeded the configured limit')
          if (outcome.signal !== null || outcome.exitCode === null) {
            throw new Error(`Handy was terminated by ${outcome.signal ?? 'an unknown signal'}${diagnostic(stderr.text, stderr.lossy)}`)
          }
          if (outcome.exitCode !== 0) {
            throw new Error(`Handy transcription failed with exit code ${outcome.exitCode}${diagnostic(stderr.text, stderr.lossy)}`)
          }
          const result = parseHandyResult(stdout.text)
          return { text: result.text.trim(), audioSeconds, inferenceSeconds: result.bestMs / 1000 }
        } finally {
          await rm(requestDirectory, { recursive: true, force: true }).catch((error: unknown) => {
            ctx.logger.warn('Unable to remove temporary Handy recording', error)
          })
        }
      },
    })
    return unregister
  })
}
