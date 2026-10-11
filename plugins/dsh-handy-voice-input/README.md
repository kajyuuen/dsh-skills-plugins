# dsh-handy-voice-input

Use [Handy](https://handy.computer/)'s installed local speech-recognition models as a provider for the standard DeepSeek Harness Voice input microphone.

DSH records a 16 kHz mono PCM WAV, the plugin passes it to Handy's `--transcribe-file --json` command, and the transcript returns to the editable draft.
The plugin does not send audio over the network. It attempts to remove the temporary WAV after each request; inspect the DSH data directory if an unexpected cleanup error occurs.

## Requirements

- DeepSeek Harness `0.2.0-rc.1` or later on the `0.2.x` line
- The official **Voice input** bundle enabled in the target profile
- [Handy](https://handy.computer/) with a model already downloaded
- A Handy release that supports `--transcribe-file` and `--json`

Handy owns the actual model and language selection because its file-transcription CLI does not expose a language flag.
Set the intended language in Handy as well as in DSH.

## Install

The plugin is available from this repository checkout, not npm or Plugin Market:

```sh
git clone git@github.com:kajyuuen/dsh-skills-plugins.git
cd dsh-skills-plugins
dsh plugin --profile web add @deepseek-ai/dsh-experimental-voice-input-bundle ./plugins/dsh-handy-voice-input
```

For a Desktop profile, replace `web` with `desktop`. Restart the profile, open **Voice input**, and select **Handy Local**.
The repository includes built `lib/` files so local-path installation does not require a build step.

## Configuration

The bundle uses the selected Handy model by default.
Plugin settings can override these fields:

| Field | Default | Purpose |
| --- | --- | --- |
| `executable` | macOS app path, otherwise `Handy.exe` or `handy` | Handy executable path or command |
| `model` | omitted | Handy model id from `--list-models --json` |
| `deviceIndex` | omitted | transcribe.cpp device index for Whisper-family models |
| `languages` | `auto`, `zh`, `en`, `yue`, `ja`, `ko` | Language choices DSH may select |
| `maxDurationSeconds` | `120` | Longest accepted recording |
| `inferenceTimeoutMs` | `300000` | Handy process deadline |

On Windows and Linux, set `executable` to an absolute path when Handy is not available on `PATH`.

## Behavior and privacy

- Audio and transcripts are not sent by this plugin to any network service.
- One temporary request directory is created under the configured DSH data directory. The plugin attempts cleanup after success, failure, or cancellation; a filesystem error may leave it behind.
- Handy must have downloaded the selected model before transcription starts.
- Each request starts Handy's headless file-transcription command, so cold model loading can be slower than a resident recognizer.
- Post-processing configured in Handy is not applied unless Handy applies it to `--transcribe-file` in the installed version.

## Development

```sh
pnpm install
pnpm run check
pnpm pack
```

## Project status

The integration is tested on macOS with Handy's application bundle path.
Windows and Linux use the same documented Handy CLI but require platform-specific executable discovery to be configured when the command is not on `PATH`.

## Independence notice

This is an independent community integration and is not affiliated with or endorsed by the Handy project or DeepSeek.
“Handy” is used only to identify the compatible application.
No Handy logo or other brand asset is distributed.

## License

[MIT](LICENSE)
