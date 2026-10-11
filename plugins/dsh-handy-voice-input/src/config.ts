/** Configuration for the Handy command-line speech provider. */
import z from '@deepseek-ai/schemastery'

/** Handy executable, model selection, and bounded subprocess settings. */
export interface Config {
  /** Unique speech provider id shown in DeepSeek Harness. */
  providerId: string
  /** Display name shown in the Voice input settings. */
  providerName: string
  /** Absolute Handy executable path or a bare command resolved through PATH. */
  executable: string
  /** Handy model id; omission uses Handy's currently selected model. */
  model?: string | undefined
  /** DSH language choices accepted before Handy applies its persisted language setting. */
  languages: string[]
  /** Optional transcribe.cpp compute-device index. */
  deviceIndex?: number | undefined
  /** Absolute directory used only for per-request temporary WAV files. */
  dataRoot: string
  /** Longest accepted browser recording. */
  maxDurationSeconds: number
  /** Deadline for one cold Handy load and transcription. */
  inferenceTimeoutMs: number
  /** Managed subprocess termination grace period. */
  graceMs: number
  /** Maximum retained Handy JSON output. */
  maxOutputBytes: number
  /** Maximum retained Handy diagnostic output. */
  maxErrorBytes: number
}

const defaultExecutable = process.platform === 'darwin'
  ? '/Applications/Handy.app/Contents/MacOS/Handy'
  : process.platform === 'win32' ? 'Handy.exe' : 'handy'

/** Validate deployment-specific Handy settings when the plugin loads. */
export const Config: z<Partial<Config>, Config> = z.object({
  providerId: z.string().min(1).default('handy-local'),
  providerName: z.string().min(1).default('Handy Local'),
  executable: z.string().min(1).default(defaultExecutable),
  model: z.union([z.string().min(1), z.const(undefined)]),
  languages: z.array(z.string().min(1)).min(1).default(['auto', 'zh', 'en', 'yue', 'ja', 'ko']),
  deviceIndex: z.union([z.natural(), z.const(undefined)]),
  dataRoot: z.string().min(1).required(),
  maxDurationSeconds: z.number().min(1).max(600).default(120),
  inferenceTimeoutMs: z.natural().min(1).default(300_000),
  graceMs: z.natural().min(1).default(2_000),
  maxOutputBytes: z.natural().min(256).default(256 * 1024),
  maxErrorBytes: z.natural().min(256).default(128 * 1024),
})
