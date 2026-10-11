/** Add the configured DSH speech provider to ask_user_question text fields. */
window.__ModuleLoader__.load({
  id: '@kajyuuen/dsh-question-voice-input',
  factory() {
    const BUTTON = 'data-question-voice-input'
    const labels = {
      idle: '質問欄へ音声入力', requesting: 'マイクを準備しています',
      recording: '録音を停止して文字に変換', transcribing: '音声を文字に変換しています',
      unavailable: '標準 Voice Input を有効にして音声認識プロバイダーを準備してください',
    }

    function svg(kind) {
      const node = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
      node.setAttribute('viewBox', '0 0 24 24'); node.dataset.icon = kind; node.setAttribute('aria-hidden', 'true')
      const values = kind === 'mic'
        ? ['M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z', 'M19 10v2a7 7 0 0 1-14 0v-2', 'M12 19v3', 'M8 22h8']
        : kind === 'stop' ? ['M7 7h10v10H7z'] : ['M12 3a9 9 0 1 1-6.36 2.64']
      for (const value of values) {
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
        path.setAttribute('d', value); node.append(path)
      }
      return node
    }

    function wave(samples) {
      const bytes = new Uint8Array(44 + samples.length * 2), view = new DataView(bytes.buffer)
      const text = (offset, value) => { for (let i = 0; i < value.length; i += 1) bytes[offset + i] = value.charCodeAt(i) }
      text(0, 'RIFF'); view.setUint32(4, bytes.length - 8, true); text(8, 'WAVE'); text(12, 'fmt ')
      view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true)
      view.setUint32(24, 16000, true); view.setUint32(28, 32000, true); view.setUint16(32, 2, true)
      view.setUint16(34, 16, true); text(36, 'data'); view.setUint32(40, samples.length * 2, true)
      for (let i = 0; i < samples.length; i += 1) {
        const sample = Math.max(-1, Math.min(1, samples[i]))
        view.setInt16(44 + i * 2, Math.round(sample * (sample < 0 ? 32768 : 32767)), true)
      }
      return bytes
    }

    function encode(bytes) {
      let result = ''
      for (let i = 0; i < bytes.length; i += 8192) result += String.fromCharCode(...bytes.subarray(i, i + 8192))
      return btoa(result)
    }

    class Capture {
      constructor() { this.stream = null; this.recorder = null; this.context = null; this.chunks = []; this.cancelled = false; this.disposal = null }
      async start() {
        if (!navigator.mediaDevices || typeof MediaRecorder === 'undefined') throw new Error('この環境ではマイク録音を利用できません')
        try { this.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true }, video: false }) }
        catch (error) {
          if (error instanceof DOMException && error.name === 'NotAllowedError') throw new Error('マイクの利用が許可されていません')
          throw error
        }
        if (this.cancelled) { this.stream.getTracks().forEach(track => track.stop()); throw new Error('録音がキャンセルされました') }
        this.context = new window.AudioContext()
        this.recorder = new MediaRecorder(this.stream)
        this.recorder.ondataavailable = event => { if (!this.cancelled && event.data.size > 0) this.chunks.push(event.data) }
        this.recorder.start()
      }
      async stop(maxSeconds) {
        const recorder = this.recorder, context = this.context
        if (!recorder || !context || recorder.state !== 'recording') throw new Error('録音データがありません')
        try {
          await new Promise((resolve, reject) => {
            recorder.onstop = resolve; recorder.onerror = () => reject(new Error('録音データを取得できません'))
            recorder.stop()
          })
          this.stream?.getTracks().forEach(track => track.stop())
          if (this.cancelled) throw new Error('録音がキャンセルされました')
          const blob = new Blob(this.chunks, { type: recorder.mimeType })
          if (blob.size === 0) throw new Error('録音データが空です')
          const decoded = await context.decodeAudioData(await blob.arrayBuffer())
          const frames = Math.max(1, Math.floor(Math.min(decoded.duration, maxSeconds) * 16000))
          const offline = new window.OfflineAudioContext(1, frames, 16000), source = offline.createBufferSource()
          source.buffer = decoded; source.connect(offline.destination); source.start()
          const rendered = await offline.startRendering()
          if (this.cancelled) throw new Error('録音がキャンセルされました')
          return wave(rendered.getChannelData(0))
        } finally { await this.dispose() }
      }
      dispose() {
        if (this.disposal) return this.disposal
        this.cancelled = true
        if (this.recorder?.state === 'recording') this.recorder.stop()
        this.stream?.getTracks().forEach(track => track.stop())
        const context = this.context; this.context = null
        this.disposal = context && context.state !== 'closed' ? context.close() : Promise.resolve()
        return this.disposal
      }
    }

    return {
      inject: ['remote', 'remote.speech'],
      apply(ctx) {
        ctx.effect(() => {
          const controls = new Map(), disposals = new Set()
          let active = null, generation = 0, notice = null, noticeTimer
          const style = document.createElement('style')
          style.textContent = `
            .dsh-question-voice-field{position:relative!important}.dsh-question-voice-field>textarea{padding-right:2.65rem!important}
            [${BUTTON}]{position:absolute;z-index:2;right:.38rem;top:50%;transform:translateY(-50%);width:2rem;height:2rem;padding:0;display:inline-flex;align-items:center;justify-content:center;border:0;border-radius:.55rem;color:currentColor;background:transparent;cursor:pointer;opacity:.82}
            [${BUTTON}] svg{width:1.125rem;height:1.125rem;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
            [${BUTTON}] svg[data-icon=stop]{fill:currentColor;stroke:none}[${BUTTON}]:hover{background:color-mix(in srgb,currentColor 9%,transparent)}
            [${BUTTON}][data-phase=recording],[${BUTTON}][data-phase=error]{color:#e5484d;background:color-mix(in srgb,#e5484d 10%,transparent);opacity:1}
            [${BUTTON}][data-phase=requesting] svg,[${BUTTON}][data-phase=transcribing] svg{animation:dsh-qvoice-spin .85s linear infinite}@keyframes dsh-qvoice-spin{to{transform:rotate(360deg)}}
            .dsh-question-voice-notice{position:fixed;z-index:2147483647;left:50%;bottom:1.25rem;transform:translateX(-50%);max-width:min(38rem,calc(100vw - 2rem));padding:.7rem 1rem;border-radius:.7rem;color:#fff;background:rgba(35,35,38,.94);box-shadow:0 8px 28px rgba(0,0,0,.28);font:13px/1.45 system-ui,sans-serif}
          `
          document.head.append(style)
          const nativeSetter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set
          const notify = message => {
            clearTimeout(noticeTimer); notice?.remove(); notice = document.createElement('div')
            notice.className = 'dsh-question-voice-notice'; notice.setAttribute('role', 'status'); notice.textContent = message
            document.body.append(notice); noticeTimer = setTimeout(() => { notice?.remove(); notice = null }, 8000)
          }
          const setPhase = (control, phase, message) => {
            control.phase = phase; control.button.dataset.phase = phase
            control.button.replaceChildren(svg(phase === 'recording' ? 'stop' : ['requesting', 'transcribing'].includes(phase) ? 'spinner' : 'mic'))
            control.button.setAttribute('aria-label', message); control.button.setAttribute('aria-pressed', String(phase === 'recording'))
            control.button.title = message
          }
          const track = promise => { disposals.add(promise); void promise.finally(() => disposals.delete(promise)) }
          const reset = control => { if (active === control) active = null; control.capture = null; control.abort = null; control.snapshot = null; setPhase(control, 'idle', labels.idle) }
          const cancel = control => { generation += 1; clearTimeout(control.timer); control.abort?.abort(); if (control.capture) track(control.capture.dispose()); reset(control) }
          const fail = (control, error) => {
            const detail = error instanceof Error ? error.message : String(error)
            if (active === control) active = null
            control.capture = null; control.abort = null; control.snapshot = null
            const message = `音声入力エラー: ${detail || '原因不明'}`
            setPhase(control, 'error', message); notify(message); console.error('[question-voice-input]', error)
          }
          const setText = (textarea, value, caret) => {
            if (nativeSetter) nativeSetter.call(textarea, value); else textarea.value = value
            textarea.dispatchEvent(new Event('input', { bubbles: true })); textarea.setSelectionRange(caret, caret)
          }
          const finish = async control => {
            if (control.phase !== 'recording' || !control.capture || !control.snapshot) return
            const run = generation, capture = control.capture, snapshot = control.snapshot
            clearTimeout(control.timer); setPhase(control, 'transcribing', labels.transcribing)
            try {
              const audio = await capture.stop(snapshot.catalog.maxDurationSeconds)
              if (run !== generation || active !== control) return
              if (audio.byteLength > snapshot.catalog.maxAudioBytes) throw new Error('録音が長すぎます')
              const result = await ctx.remote.speech.transcribe({ audioBase64: encode(audio), ...snapshot.catalog.selection }, control.abort.signal)
              if (run !== generation || active !== control) return
              if (!result.ok) throw result.error
              const transcript = result.value.text.trim()
              if (!transcript) throw new Error('音声を認識できませんでした')
              if (control.textarea.value !== snapshot.value) throw new Error('録音中に入力欄が変更されました')
              control.programmatic = true
              const value = snapshot.value.slice(0, snapshot.start) + transcript + snapshot.value.slice(snapshot.end)
              setText(control.textarea, value, snapshot.start + transcript.length); control.programmatic = false; reset(control)
            } catch (error) { if (run === generation) fail(control, error) }
          }
          const start = async control => {
            if (control.phase === 'recording') { await finish(control); return }
            if (['requesting', 'transcribing'].includes(control.phase) || control.textarea.disabled) return
            if (active && active !== control) cancel(active)
            const run = ++generation; active = control; setPhase(control, 'requesting', labels.requesting)
            try {
              const response = await ctx.remote.speech.catalog()
              if (run !== generation || active !== control) return
              if (!response.ok) throw response.error
              const catalog = response.value, provider = catalog.providers.find(item => item.id === catalog.selection.providerId)
              if (!provider || !['ready', 'standby', 'waking'].includes(provider.preparation.phase)) throw new Error(labels.unavailable)
              const capture = new Capture(), abort = new AbortController(), textarea = control.textarea
              control.capture = capture; control.abort = abort
              control.snapshot = { catalog, value: textarea.value, start: textarea.selectionStart ?? textarea.value.length, end: textarea.selectionEnd ?? textarea.value.length }
              await capture.start()
              if (run !== generation || active !== control) { track(capture.dispose()); return }
              setPhase(control, 'recording', labels.recording)
              control.timer = setTimeout(() => { void finish(control) }, catalog.maxDurationSeconds * 1000)
            } catch (error) { if (run === generation) fail(control, error) }
          }
          const attach = textarea => {
            if (controls.has(textarea) || !textarea.parentElement) return
            const parent = textarea.parentElement, button = document.createElement('button')
            parent.classList.add('dsh-question-voice-field'); button.type = 'button'; button.setAttribute(BUTTON, '')
            const control = { textarea, parent, button, phase: 'idle', capture: null, abort: null, snapshot: null, programmatic: false, timer: undefined }
            control.click = () => void start(control); control.input = () => { if (!control.programmatic && active === control) cancel(control) }
            button.addEventListener('mousedown', event => event.preventDefault()); button.addEventListener('click', control.click); textarea.addEventListener('input', control.input)
            setPhase(control, 'idle', labels.idle); button.disabled = textarea.disabled
            parent.append(button); controls.set(textarea, control)
          }
          const detach = control => {
            if (active === control) cancel(control); clearTimeout(control.timer); control.button.removeEventListener('click', control.click)
            control.textarea.removeEventListener('input', control.input); control.button.remove(); control.parent.classList.remove('dsh-question-voice-field'); controls.delete(control.textarea)
          }
          const reconcile = () => {
            document.querySelectorAll('[data-question-key] textarea').forEach(attach)
            for (const control of [...controls.values()]) {
              if (!control.textarea.isConnected || !control.textarea.closest('[data-question-key]')) detach(control)
              else {
                if (control.textarea.disabled && active === control) cancel(control)
                control.button.disabled = control.textarea.disabled
              }
            }
          }
          const observer = new MutationObserver(reconcile)
          observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['disabled'] })
          const visibility = () => { if (document.hidden && active) cancel(active) }; document.addEventListener('visibilitychange', visibility); reconcile()
          return async () => {
            generation += 1; observer.disconnect(); document.removeEventListener('visibilitychange', visibility)
            for (const control of [...controls.values()]) detach(control)
            clearTimeout(noticeTimer); notice?.remove(); style.remove(); await Promise.all([...disposals])
          }
        })
      },
    }
  },
})
