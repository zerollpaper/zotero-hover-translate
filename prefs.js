window.HTPrefs = {
  init() {
    const root = document.getElementById('ht-preferences');
    if (!root || root.getAttribute('data-initialized') === 'true') return;
    const api = Zotero.HoverTranslate;
    const get = name => document.getElementById('ht-' + name);
    const feedbackTimers = new Map();
    let disposed = false;
    const updateUI = action => {
      if (disposed) return;
      try {
        if (!root.isConnected || window.closed) return;
        action();
      } catch (_) { /* Preferences can close or reload while a request completes. */ }
    };
    // Confirmations disappear after 2 seconds. Failures stay until the same
    // place shows its next message, so the reason can be read.
    const notify = (name, message, { keep = false } = {}) => {
      updateUI(() => {
        window.clearTimeout(feedbackTimers.get(name));
        feedbackTimers.delete(name);
        const node = get(name);
        node.textContent = message;
        if (keep) return;
        feedbackTimers.set(name, window.setTimeout(() => {
          updateUI(() => { node.textContent = ''; }); feedbackTimers.delete(name);
        }, 2000));
      });
    };
    const fail = (name, message) => notify(name, message, { keep: true });
    window.addEventListener('unload', () => {
      disposed = true;
      for (const timer of feedbackTimers.values()) window.clearTimeout(timer);
      feedbackTimers.clear();
    }, { once: true });
    const appearanceKeys = ['fontSize','popupWidth','transparency'];
    const booleanKeys = new Set(['enabled','highlightSentence','alignWords']);
    const keys = ['provider','sourceLanguage','targetLanguage','alignWords','enabled','highlightSentence','baseURL','model','apiKey','claudeModel','claudeApiKey','geminiModel','geminiApiKey','deeplApiKey','delay','fullConcurrency',...appearanceKeys];
    const c = api.config();
    for (const key of keys) { if (booleanKeys.has(key)) get(key).checked = c[key]; else get(key).value = c[key] ?? (key === 'provider' ? 'openai' : key === 'sourceLanguage' ? 'en' : ''); }
    // The same sentence in every selectable language. The connection test sends
    // it in the source language and the preview shows it in the target language.
    // The middle part is the word "sleep" (source token 4 in English).
    const samples = {
      en: ['The researchers found that ', 'sleep', ' improves memory.'],
      ja: ['研究者たちは、', '睡眠', 'が記憶力を高めることを発見した。'],
      'zh-CN': ['研究人员发现，', '睡眠', '能够改善记忆。'],
      ko: ['연구자들은 ', '수면', '이 기억력을 향상시킨다는 것을 발견했다.'],
      de: ['Die Forscher fanden heraus, dass ', 'Schlaf', ' das Gedächtnis verbessert.'],
      fr: ['Les chercheurs ont constaté que le ', 'sommeil', ' améliore la mémoire.'],
      es: ['Los investigadores descubrieron que el ', 'sueño', ' mejora la memoria.']
    };
    const sample = language => samples[language] || samples.en;
    // Mirrors config(): word alignment needs an LLM service and English source text.
    const alignmentAvailable = () => !['google','deepl'].includes(get('provider').value) && get('sourceLanguage').value === 'en'
      && !(get('provider').value === 'openai' && /plamo[^/]*translate/i.test(get('model').value));
    const aligned = () => alignmentAvailable() && get('alignWords').checked;
    let preview = () => {};
    const help = {
      google: 'Google翻訳はAPIキー不要です。翻訳する原文がGoogleへ送信されます。訳文の単語連動ハイライトには対応しません。',
      deepl: 'DeepLは翻訳専用のサービスです。翻訳する原文がDeepLへ送信されます。DeepLのアカウントで作ったAPIキー（Free・Proのどちらも可）を設定してください。訳文の単語連動ハイライトには対応しません。',
      gemini: 'GeminiはGoogleのAI APIで翻訳します。翻訳する原文がGoogleへ送信されます。Google AI Studioで作ったAPIキーと、モデル名（例：gemini-3.5-flash-lite）を設定してください。訳文の単語連動ハイライトは、翻訳元が英語のときだけ使えます。',
      openai: 'LLM APIには、OpenAI互換のChat Completions形式で受け付けるサービスなら、OpenAI以外でも登録できます。「接続先」で主要なサービスやローカルLLM（LM Studio・Ollama）を選ぶとAPI URLが入ります。一覧にないサービスは「その他」を選んでAPI URLを入力してください。あとはモデル名と、必要ならAPIキーを設定します。訳文の単語連動ハイライトは、翻訳元が英語のときだけ使えます。',
      anthropic: 'ClaudeはAnthropicのAPIで翻訳します。翻訳する原文がAnthropicへ送信されます。Claude Console（platform.claude.com）で作ったAPIキーと、モデル名（例：claude-haiku-5-5）を設定してください。利用料はClaude Consoleのクレジットから引かれます。訳文の単語連動ハイライトは、翻訳元が英語のときだけ使えます。'
    };
    // Show only the fields the selected service uses.
    const fieldsFor = { google: [], deepl: ['deeplApiKey'], openai: ['endpointPreset','baseURL','model','apiKey'], anthropic: ['claudeModel','claudeApiKey'], gemini: ['geminiModel','geminiApiKey'] };
    const providerUI = () => {
      const provider = fieldsFor[get('provider').value] ? get('provider').value : 'openai';
      for (const key of Object.values(fieldsFor).flat()) {
        const shown = fieldsFor[provider].includes(key);
        get(key).disabled = !shown;
        for (const node of [get(key), document.querySelector('label[for="ht-' + key + '"]')]) if (node) node.style.display = shown ? '' : 'none';
      }
      get('api-help').textContent = help[provider];
      showModelChoice();
      get('alignWords').disabled = !alignmentAvailable();
      preview();
    };
    for (const key of ['provider','sourceLanguage','targetLanguage','alignWords']) get(key).addEventListener('change', providerUI);
    get('model').addEventListener('input', () => { get('alignWords').disabled = !alignmentAvailable(); preview(); });
    // "接続先" fills in the API URL of a known service. Editing the URL by hand
    // switches it back to "その他". Another service gets its own model and key:
    // the old ones are cleared so a key is never sent to a different service.
    const trimURL = value => String(value || '').trim().replace(/\/+$/, '').replace(/\/chat\/completions$/, '');
    const matchPreset = () => {
      const url = trimURL(get('baseURL').value);
      get('endpointPreset').value = [...get('endpointPreset').options].some(o => o.value && o.value === url) ? url : '';
    };
    get('endpointPreset').addEventListener('change', () => {
      const url = get('endpointPreset').value;
      if (!url || url === trimURL(get('baseURL').value)) return;
      const hadCredentials = get('model').value || get('apiKey').value;
      get('baseURL').value = url; get('model').value = ''; get('apiKey').value = '';
      if (hadCredentials) notify('test-status', '接続先を変えたので、モデル名とAPIキーを空にしました。この接続先のものを入力してください。');
      clearModelChoice();
      // A server on this Mac needs no key, so its models can be listed right away.
      if (isLocal()) loadModels();
    });
    get('baseURL').addEventListener('input', () => { matchPreset(); clearModelChoice(); });
    matchPreset();
    // "モデル一覧を取得" asks the selected service for its models and offers them
    // in "モデルの候補"; choosing one fills in the model name.
    const modelKeyFor = { openai: 'model', anthropic: 'claudeModel', gemini: 'geminiModel' };
    const option = (value, text) => {
      const node = document.createElementNS('http://www.w3.org/1999/xhtml', 'option');
      node.value = value; node.textContent = text; return node;
    };
    const isLocal = () => /^http:\/\/127\.0\.0\.1[:/]/.test(trimURL(get('baseURL').value) + '/');
    const modelsStatus = message => updateUI(() => { get('models-status').textContent = message; });
    let modelRequest = 0;
    function showModelChoice() {
      const provider = get('provider').value, select = get('modelChoice');
      const shown = !!modelKeyFor[provider] && select.options.length > 1 && select.getAttribute('data-provider') === provider;
      for (const node of [select, document.querySelector('label[for="ht-modelChoice"]')]) node.style.display = shown ? '' : 'none';
      get('loadModels').style.display = modelKeyFor[provider] ? '' : 'none';
    }
    function clearModelChoice() {
      modelRequest++;
      get('modelChoice').replaceChildren(); get('modelChoice').removeAttribute('data-provider');
      get('models-status').textContent = ''; showModelChoice();
    }
    async function loadModels() {
      const provider = get('provider').value, key = modelKeyFor[provider];
      if (!key || typeof api.listModels !== 'function') return;
      const ticket = ++modelRequest;
      const values = Object.fromEntries(keys.map(k => [k, booleanKeys.has(k) ? get(k).checked : get(k).value]));
      get('loadModels').disabled = true; modelsStatus('モデル一覧を取得中…');
      try {
        const ids = await api.listModels(values);
        if (ticket !== modelRequest) return;
        updateUI(() => {
          const select = get('modelChoice'), input = get(key);
          select.replaceChildren(option('', ids.length ? '（一覧から選ぶ）' : '（モデルが見つかりません）'), ...ids.map(id => option(id, id)));
          select.setAttribute('data-provider', provider);
          // With a single model and an empty name, there is nothing to choose.
          if (!input.value.trim() && ids.length === 1) { input.value = ids[0]; input.dispatchEvent(new window.Event('input')); }
          select.value = ids.includes(input.value) ? input.value : '';
          showModelChoice();
        });
        modelsStatus(ids.length ? ids.length + '件のモデルが見つかりました。「モデルの候補」から選べます。' : 'モデルが見つかりませんでした。モデル名を直接入力してください。');
      } catch (e) {
        if (ticket === modelRequest) modelsStatus(e.message || 'モデル一覧を取得できませんでした。');
      } finally {
        updateUI(() => { get('loadModels').disabled = false; });
      }
    }
    get('loadModels').onclick = () => loadModels();
    get('modelChoice').addEventListener('change', () => {
      const key = modelKeyFor[get('provider').value], value = get('modelChoice').value;
      if (!key || !value) return;
      get(key).value = value; get(key).dispatchEvent(new window.Event('input'));
    });
    const concurrencyLabel=()=>{get('fullConcurrencyValue').textContent=get('fullConcurrency').value+' 件';};
    get('fullConcurrency').addEventListener('input',concurrencyLabel);
    get('fullConcurrency').addEventListener('change',concurrencyLabel);
    concurrencyLabel();
    get('highlightSentence').onchange = () => {
      api.setSourceHighlight(get('highlightSentence').checked);
      notify('save-status', get('highlightSentence').checked ? '原文の文全体のハイライトを有効にしました。' : '原文の文全体のハイライトを無効にしました。');
    };
    const appearanceValues = () => Object.fromEntries(appearanceKeys.map(key => [key, get(key).value]));
    const previewText = () => {
      // Same content as the reader popup: the translated sentence, with the
      // part for the hovered word marked only when word alignment is in effect.
      const [before, word, after] = sample(get('targetLanguage').value || 'ja');
      const html = name => document.createElementNS('http://www.w3.org/1999/xhtml', name);
      const mark = html('span'); mark.className = 'ht-preview-highlight'; mark.textContent = word;
      const text = get('preview-text');
      text.replaceChildren(before, aligned() ? mark : word, after);
      get('preview-note').textContent = aligned()
        ? '原文「' + samples.en.join('') + '」の sleep にカーソルを合わせたときの表示例です。対応する訳語が黄色で示されます。'
        : '原文「' + samples.en.join('') + '」を翻訳したときの表示例です。';
    };
    preview = () => {
      const a = api.normalizeAppearance(appearanceValues());
      previewText();
      get('preview').style.fontSize = a.fontSize + 'px';
      get('preview').style.maxWidth = 'min(' + a.popupWidth + 'px, 100%)';
      get('preview').style.backgroundColor = 'rgba(255, 255, 255, ' + (1-a.transparency/100) + ')';
      get('fontSizeValue').textContent = a.fontSize + ' px';
      get('popupWidthValue').textContent = a.popupWidth + ' px';
      get('transparencyValue').textContent = a.transparency + '%';
    };
    for (const key of appearanceKeys) {
      get(key).addEventListener('input', preview);
      get(key).addEventListener('change', preview);
    }
    const applyAppearance = (values, target = 'appearance-status') => {
      try {
        const a = api.saveAppearance(values);
        for (const key of appearanceKeys) get(key).value = a[key];
        preview(); notify(target, target === 'default-status' ? '外観を初期値に戻しました。' : '外観を保存しました。');
      } catch(e) { fail(target, e.message || '保存できませんでした。もう一度お試しください。'); }
    };
    get('saveAppearance').onclick = () => applyAppearance(appearanceValues());
    get('defaultAppearance').onclick = () => applyAppearance({ fontSize:17, popupWidth:640, transparency:0 }, 'default-status');
    providerUI();
    // Opening the settings with a server on this Mac lists its models at once.
    if (get('provider').value === 'openai' && isLocal()) loadModels();
    const save = () => {
      const values = Object.fromEntries(keys.map(key => [key, booleanKeys.has(key) ? get(key).checked : get(key).value]));
      api.save(values);
    };
    get('save').onclick = () => { try { save(); notify('save-status', '設定を保存しました。'); } catch(e) { fail('save-status', e.message || '保存できませんでした。もう一度お試しください。'); } };
    get('test').onclick = async () => {
      if (get('test').disabled) return;
      const button = get('test'), feedback = get('test-status');
      const label = button.textContent;
      window.clearTimeout(feedbackTimers.get('test-status'));
      feedbackTimers.delete('test-status');
      get('test').disabled = true;
      button.textContent = 'テスト中…';
      feedback.textContent = '設定を保存して翻訳サービスに接続しています。しばらくお待ちください。';
      feedback.setAttribute('aria-busy', 'true');
      try {
        save();
        const withAlignment = aligned();
        const result = await api.translate(sample(get('sourceLanguage').value).join(''), { force: true });
        const mapped = result.segments.filter(s => s.source.includes(4)).map(s => s.text).join(' / ');
        // The sample uses memory only. Reader diagnostics and other articles'
        // cache writes are not part of testing the translation service.
        let details = '';
        try {
          const d = api.diagnostic();
          details = '\n接続済みのPDFビュー：' + d.connectedPDFViews + (d.cache.error ? '\n' + d.cache.error : '');
        } catch (_) { /* Optional diagnostics must not turn success into failure. */ }
        const alignment = withAlignment ? '\nsleepに対応する訳：' + (mapped || 'モデルから単語の対応情報が返されませんでした') : '';
        notify('test-status', '接続成功：' + result.text + alignment + details);
      } catch (e) {
        fail('test-status', '接続テスト失敗：' + (e.message || 'リクエストが完了しませんでした。接続設定を確認してください。'));
      } finally {
        updateUI(() => { button.disabled = false; button.textContent = label; feedback.removeAttribute('aria-busy'); });
      }
    };
    get('clear').onclick = async () => {
      if (get('clear').disabled) return;
      window.clearTimeout(feedbackTimers.get('clear-status'));
      get('clear-status').textContent = '削除中…';
      get('clear').disabled = true;
      try { await api.reset(); notify('clear-status', '読み込み済み文献のキャッシュを削除しました。'); }
      catch(e) { fail('clear-status', e.message || '削除できませんでした。もう一度お試しください。'); }
      finally { updateUI(() => { get('clear').disabled = false; }); }
    };
    try {
      const cacheStatus = api.diagnostic().cache;
      if (cacheStatus.error) fail('clear-status', cacheStatus.error);
    } catch (_) { /* Opening preferences must not depend on reader diagnostics. */ }
    root.setAttribute('data-initialized', 'true');
  }
};
// Zotero dispatches load on the inserted pane fragment. Bind through capture
// as well as the inline handler, with an idempotent init for repeated loads.
document.addEventListener('load', event => {
  if (event.target?.id === 'ht-preferences') window.HTPrefs.init();
}, true);
