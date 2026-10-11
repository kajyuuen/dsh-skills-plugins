# dsh-background-voice-input

This plugin replaces the standard DSH **Voice Input** microphone control with one that keeps recording when you switch to another app or browser tab. It uses the existing speech-recognition provider, selected language, and recording limit.

## Install

Clone the catalog and add both the standard Voice Input bundle and this plugin to the same DSH profile. For example:

```sh
git clone https://github.com/kajyuuen/dsh-skills-plugins.git
cd dsh-skills-plugins
dsh plugin --profile desktop add @deepseek-ai/dsh-experimental-voice-input-bundle ./plugins/dsh-background-voice-input
```

For a Web profile, replace `desktop` with `web`. Configure the recognition model and microphone permissions through the standard Voice Input bundle. This plugin is available from the repository checkout, not npm.

## Use

1. Enable the standard Voice Input bundle and set up a recognition model.
2. Enable this plugin in the same profile, restart DSH, and reload the page.
3. Press the microphone in the input field, then switch to another app, such as Chrome. When you return to DSH, press **Stop** to transcribe; transcription also starts when the standard Voice Input recording limit is reached.

Audio is passed to the speech-recognition provider selected in standard Voice Input. The transcript is inserted only into the draft of the original Session; it is not sent to the chat. If the draft has changed and the transcript cannot be inserted safely, the recognized text remains available so you can select **Insert recognized text**. Pressing Escape or **×** discards the recording, as does switching Sessions. Recordings cannot be restored after a browser reload or after the app exits. The microphone stays in use while another app is displayed during recording. Recording duration and audio size follow the standard Voice Input limits.

The microphone control is generated from the built client code of standard Voice Input 0.2.0-rc.2 (MIT) and replaces the standard control with slot priority `-1`. The buttons, theme colors, recording volume waveform, preparation dialog, and translations come directly from the standard code. The only differences are removal of the behavior that discards recordings when leaving the page, registration adjustments to share the Remote service, settings UI, and translations with the standard plugin, and a separate style identifier to prevent CSS class-name collisions between builds. This plugin does not change the recognition provider or independently upload or persist audio.

When updating the standard bundle version, the generation script verifies the SHA-256 hash of the official bundle. If it has changed, review the differences before updating the generation script. For generation and regression testing, specify a DSH source checkout with dependencies installed:

```sh
DSH_VOICE_BUNDLE=/path/to/dsh/packages/experimental/client-ui-voice-input/lib/client.js node scripts/build-client.mjs
DSH_TEST_REPO=/path/to/dsh node tests/voice-ui.mjs
```

This plugin is licensed under MIT. The original Voice Input bundle is also licensed under MIT.
