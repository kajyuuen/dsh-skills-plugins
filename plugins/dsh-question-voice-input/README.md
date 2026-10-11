# Question Voice Input

Adds a voice dictation button to the free-text fields in DeepSeek Harness `ask_user_question` cards.
It is an independently installable DSH bundle; the package is currently available from this repository checkout, not npm.

## Requirements

- DeepSeek Harness with the standard Voice Input bundle enabled.
- A speech-recognition provider configured for Voice Input.
- Browser microphone access.

## Install

Clone this repository and install the plugin into your DSH profile:

```sh
git clone git@github.com:kajyuuen/dsh-skills-plugins.git
cd dsh-skills-plugins
dsh plugin --profile desktop add ./plugins/dsh-question-voice-input
```

Replace `desktop` with `web` for a Web profile. Enable the standard Voice Input bundle and configure your speech-recognition provider separately.

## Use

1. Press the microphone button in a question card's free-text field.
2. Press stop when you finish speaking.
3. Review the recognized text and submit your answer normally.

## Behavior

- Works with both free-text-only questions and the “Other” field in questions with choices.
- Uses the provider and language configured for standard Voice Input.
- Converts audio to 16 kHz mono PCM WAV and sends it through the standard `remote.speech` route.
- Inserts the transcript into the answer field without submitting it.
- Stops recording if the user types, closes the question, hides the tab, or disables the plugin.
- Stops automatically at the recording duration limit supplied by Voice Input.
- Displays a transient error notice if microphone access, transcription, or provider setup fails.
- Disables the microphone button when its text field is disabled.

## Privacy and limitations

The plugin sends recorded audio through DSH's `remote.speech` interface to the selected speech-recognition provider. Whether that provider runs locally or contacts a network service depends on your Voice Input configuration.
The plugin does not submit your answer automatically. Its button and status labels are currently in Japanese.

## License

[MIT](LICENSE).
