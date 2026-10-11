# kajyuuen/dsh-skills-plugins

A collection of independently installable DeepSeek Harness (DSH) plugins.
Plugin directory names, catalog IDs, and npm package basenames (after any scope) must match and begin with `dsh-`.
Command names and internal Cordis IDs do not need this prefix.
Each plugin has its own package, installation instructions, and license.
[`components.json`](components.json) lists the components included in this repository.

## Plugins

<!-- public-plugins:start -->
| Plugin | Version | What it does | Distribution |
| --- | --- | --- | --- |
| [`dsh-background-voice-input`](plugins/dsh-background-voice-input/README.md) | `0.1.0` | Continue DSH microphone recording while another app is focused | Repository checkout; not published to npm |
| [`dsh-handy-voice-input`](plugins/dsh-handy-voice-input/README.md) | `0.1.0` | Use Handy's local speech-recognition models with DeepSeek Harness Voice input | Repository checkout; not published to npm |
| [`dsh-question-voice-input`](plugins/dsh-question-voice-input/README.md) | `0.3.0` | Adds voice dictation to free-text fields in question cards | Repository checkout; not published to npm |
<!-- public-plugins:end -->

For requirements, installation, configuration, and limitations, see each plugin's linked README.

## Scope

This catalog contains only components intentionally selected for inclusion.
Runtime profiles, credentials, session logs, and work-specific configuration remain in a separate private repository.

## License

[MIT](LICENSE). Each plugin also includes its own license file.
