import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// Build from the official, compiled voice-input client so its UI, CSS, and strings stay byte-for-byte identical.
// Refuse a changed upstream artifact until the small adapter below is reviewed against it.
const SOURCE_SHA256 = 'dacf861b1584477ca399e2777446207d88d24782b15ea33476dd9e4dca5487be'
const sourcePath = process.env.DSH_VOICE_BUNDLE
if (!sourcePath) throw new Error('Set DSH_VOICE_BUNDLE to the built official client-ui-voice-input/lib/client.js')
const source = readFileSync(resolve(sourcePath), 'utf8')
const hash = createHash('sha256').update(source).digest('hex')
if (hash !== SOURCE_SHA256) throw new Error(`Official voice bundle changed (${hash}). Review the fork before rebuilding.`)
let code = source
function replaceOnce(needle, replacement, label) {
  const matches = [...code.matchAll(needle instanceof RegExp ? new RegExp(needle.source, needle.flags.replaceAll('g', '') + 'g') : new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'))]
  if (matches.length !== 1) throw new Error(`Expected one ${label}, found ${matches.length}`)
  code = code.replace(needle, replacement)
}
replaceOnce(/\/\/#region \\0dsh-css:[^\n]*\/VoiceInput\.module\.css\.mjs/,
  '//#region VoiceInput.module.css', 'local build path in CSS region')
replaceOnce('id: "@deepseek-ai/dsh-experimental-client-ui-voice-input",',
  'id: "@kajyuuen/dsh-background-voice-input",', 'module id')
// The installed official plugin may have different hashed CSS classes. A distinct tag id
// ensures the copied class map always receives its own, otherwise identical stylesheet.
replaceOnce('const tagId = "@deepseek-ai/dsh-experimental-client-ui-voice-input/VoiceInput.module.css";',
  'const tagId = "@kajyuuen/dsh-background-voice-input/VoiceInput.module.css";', 'stylesheet identity')
replaceOnce('tag.dataset.plugin = "@deepseek-ai/dsh-experimental-client-ui-voice-input";',
  'tag.dataset.plugin = "@kajyuuen/dsh-background-voice-input";', 'stylesheet owner')
replaceOnce(/\n\s*const blur = \(\) => \{\n\s*if \(current\.current\?\.phase === "recording"\) cancel\(\);\n\s*\};\n\s*const visibility = \(\) => \{\n\s*if \(document\.hidden && current\.current && current\.current\.phase !== "transcribing"\) cancel\(\);\n\s*\};/, '', 'focus-cancellation callbacks')
replaceOnce(/\n\s*window\.addEventListener\("blur", blur\);\n\s*document\.addEventListener\("visibilitychange", visibility\);/, '', 'focus-cancellation subscriptions')
replaceOnce(/\n\s*window\.removeEventListener\("blur", blur\);\n\s*document\.removeEventListener\("visibilitychange", visibility\);/, '', 'focus-cancellation cleanup')
replaceOnce(/\n\s*ctx\.effect\(\(\) => ctx\.locale\.register\(NS, \{\n\s*zh,\n\s*en\n\s*\}\)\);/, '', 'duplicate locale registration')
replaceOnce('name: "conversation.input.activity",\n\t\t\t\tlocale: NS,',
  'name: "conversation.input.activity",\n\t\t\t\tpriority: -1,\n\t\t\t\tlocale: NS,', 'activity shadow rank')
replaceOnce(/\n\s*ctx\.slots\.inject\("plugins\.bundle\.config", \(\) => ctx\.slots\.register\(\{[\s\S]*?\}, VoicePreparation\)\);\n\s*ctx\.slots\.inject\("plugins\.bundle\.activation", \(\) => ctx\.slots\.register\(\{[\s\S]*?\}, VoiceSetupPrompt\)\);/, '', 'duplicate bundle details and setup prompt')
replaceOnce(/async function mountVoiceInput\(ctx, contribution\) \{[\s\S]*?\n\t\t\}\n\t\t\/\/#endregion/, `async function mountVoiceInput(ctx, contribution) {
            // The official voice bundle already mounted the Remote; this plugin owns only its alternate activity.
            const ui = ctx.inject([
                "remote.speech", "slots", "locale", "pluginNavigation"
            ], registerUi);
            try {
                await ui;
            } catch (error) {
                await ui.dispose();
                throw error;
            }
            return async () => { await ui.dispose(); };
        }
        //#endregion`, 'remote ownership')
replaceOnce(/\n\/\/# sourceMappingURL=client\.js\.map\s*$/, '\n', 'stale source map reference')
const banner = `/** Fork of @deepseek-ai/dsh-experimental-client-ui-voice-input@0.2.0-rc.2 (MIT).
 * Generated from the exact official bundle SHA-256 ${SOURCE_SHA256}.
 * Changes: keep recording on blur/page hide; shadow only the microphone activity;
 * give identical CSS its own tag; reuse the official Remote, settings, and locale. */\n`
const output = fileURLToPath(new URL('../client.js', import.meta.url))
// Whitespace-only lines in upstream-generated code templates do not affect their JavaScript.
writeFileSync(output, (banner + code).replace(/^[\t ]+$/gm, '').trimEnd() + '\n')
console.log(`Generated ${output} from ${sourcePath}`)
