// Settings text follows Zotero's language: Japanese for ja-*, English otherwise.
// prefs.xhtml holds the Japanese text; elements marked data-ht get the English
// text below. Messages set from code come from HTPrefsText.
var HTPrefsText = (() => {
  const locale = typeof Zotero !== 'undefined' ? Zotero?.locale : undefined;
  const language = typeof locale === 'string' && locale && !/^ja(?:-|$)/i.test(locale) ? 'en' : 'ja';
  const pageEn = {
    'heading.service': 'Translation service', 'heading.reading': 'While reading', 'heading.appearance': 'Popup appearance', 'heading.cache': 'Translation cache',
    'label.provider': 'Translation service', 'label.source': 'Translate from', 'label.target': 'Translate to',
    'label.alignWords': 'Highlight matching words in the translation (heavy)', 'label.endpointPreset': 'Service',
    'label.model': 'Model name', 'label.apiKey': 'API key (optional)', 'label.claudeModel': 'Claude model name', 'label.claudeApiKey': 'Claude API key',
    'label.geminiModel': 'Gemini model name', 'label.geminiApiKey': 'Gemini API key', 'label.deeplApiKey': 'DeepL API key', 'label.modelChoice': 'Available models',
    'label.delay': 'Hover delay', 'label.fullConcurrency': 'Parallel requests for full-text translation',
    'label.fontSize': 'Translation font size', 'label.popupWidth': 'Maximum width', 'label.transparency': 'Background transparency',
    'provider.google': 'Google Translate', 'provider.openai': 'LLM API (OpenAI-compatible, local LLMs supported)',
    'provider.anthropic': 'Claude (Anthropic API)', 'provider.gemini': 'Gemini (Google AI API)',
    'lang.auto': 'Detect language', 'lang.en': 'English', 'lang.ja': 'Japanese', 'lang.zh-CN': 'Chinese (Simplified)', 'lang.ko': 'Korean',
    'lang.de': 'German', 'lang.fr': 'French', 'lang.es': 'Spanish',
    'preset.other': 'Other (enter the URL)', 'preset.lmstudio': 'LM Studio (this computer)', 'preset.ollama': 'Ollama (this computer)',
    'placeholder.model': 'Model ID of the service',
    'button.loadModels': 'Load model list', 'button.test': 'Save and test connection', 'button.save': 'Save settings',
    'button.saveAppearance': 'Save appearance', 'button.defaultAppearance': 'Reset appearance', 'button.clear': 'Delete cache of loaded items',
    'check.enabled': 'Enable hover translation', 'check.highlight': 'Highlight the whole source sentence', 'unit.ms': 'ms',
    'help.shortcut': 'Translate again: Ctrl+Alt+R (macOS: ⌘+Option+R), or click ↻ in the popup.',
    'preview.summary': 'Preview', 'preview.label': 'Popup preview',
    'cache.where': 'The cache is saved as `hover-translate-cache.json` in the folder of each PDF and is kept across restarts.',
    'cache.limits': 'Up to 1,000 sentences are saved per folder. Entries unused for 90 days expire. Each combination of service, model, source and target language, and word highlighting has its own cache.',
    'cache.full': '“Translate all” in “Translation settings” on the toolbar of the PDF reader translates the whole item in advance. The full-text cache is saved separately as `hover-translate-fulltext-*.json`. It stores each sentence\'s translation (and, with word highlighting, the matching source words) and is not subject to the 1,000-sentence limit.',
    'cache.scope': 'Only the caches of items loaded since Zotero started are deleted. Other items are not affected.'
  };
  const messages = {
    ja: {
      'help.google': 'Google翻訳はAPIキー不要です。翻訳する原文がGoogleへ送信されます。訳文の単語連動ハイライトには対応しません。',
      'help.deepl': 'DeepLは翻訳専用のサービスです。翻訳する原文がDeepLへ送信されます。DeepLのアカウントで作ったAPIキー（Free・Proのどちらも可）を設定してください。訳文の単語連動ハイライトには対応しません。',
      'help.gemini': 'GeminiはGoogleのAI APIで翻訳します。翻訳する原文がGoogleへ送信されます。Google AI Studioで作ったAPIキーと、モデル名（例：gemini-3.5-flash-lite）を設定してください。訳文の単語連動ハイライトは、翻訳元が英語のときだけ使えます。',
      'help.openai': 'LLM APIには、OpenAI互換のChat Completions形式で受け付けるサービスなら、OpenAI以外でも登録できます。「接続先」で主要なサービスやローカルLLM（LM Studio・Ollama）を選ぶとAPI URLが入ります。一覧にないサービスは「その他」を選んでAPI URLを入力してください。あとはモデル名と、必要ならAPIキーを設定します。訳文の単語連動ハイライトは、翻訳元が英語のときだけ使えます。',
      'help.anthropic': 'ClaudeはAnthropicのAPIで翻訳します。翻訳する原文がAnthropicへ送信されます。Claude Console（platform.claude.com）で作ったAPIキーと、モデル名（例：claude-haiku-5-5）を設定してください。利用料はClaude Consoleのクレジットから引かれます。訳文の単語連動ハイライトは、翻訳元が英語のときだけ使えます。',
      presetCleared: '接続先を変えたので、モデル名とAPIキーを空にしました。この接続先のものを入力してください。',
      loadingModels: 'モデル一覧を取得中…', pickModel: '（一覧から選ぶ）', noModelOption: '（モデルが見つかりません）',
      modelsFound: '{count}件のモデルが見つかりました。「モデルの候補」から選べます。',
      modelsNone: 'モデルが見つかりませんでした。モデル名を直接入力してください。', modelsFailed: 'モデル一覧を取得できませんでした。',
      concurrency: '{n} 件', highlightOn: '原文の文全体のハイライトを有効にしました。', highlightOff: '原文の文全体のハイライトを無効にしました。',
      previewAligned: '原文「{source}」の sleep にカーソルを合わせたときの表示例です。対応する訳語が黄色で示されます。',
      previewPlain: '原文「{source}」を翻訳したときの表示例です。',
      appearanceReset: '外観を初期値に戻しました。', appearanceSaved: '外観を保存しました。', saveFailed: '保存できませんでした。もう一度お試しください。',
      settingsSaved: '設定を保存しました。', testing: 'テスト中…', testConnecting: '設定を保存して翻訳サービスに接続しています。しばらくお待ちください。',
      connectedViews: '\n接続済みのPDFビュー：{n}', alignedWord: '\nsleepに対応する訳：{text}', noAlignment: 'モデルから単語の対応情報が返されませんでした',
      testOK: '接続成功：{text}', testFailed: '接続テスト失敗：{text}', requestIncomplete: 'リクエストが完了しませんでした。接続設定を確認してください。',
      deleting: '削除中…', cacheDeleted: '読み込み済み文献のキャッシュを削除しました。', deleteFailed: '削除できませんでした。もう一度お試しください。'
    },
    en: {
      'help.google': 'Google Translate needs no API key. The source text is sent to Google. Highlighting matching words is not supported.',
      'help.deepl': 'DeepL is a dedicated translation service. The source text is sent to DeepL. Enter an API key created in your DeepL account (Free or Pro). Highlighting matching words is not supported.',
      'help.gemini': 'Gemini translates with Google\'s AI API. The source text is sent to Google. Enter an API key created in Google AI Studio and a model name (for example, gemini-3.5-flash-lite). Highlighting matching words works only when translating from English.',
      'help.openai': 'LLM API accepts any service that takes requests in the OpenAI-compatible Chat Completions format, not only OpenAI. Choosing a major service or a local LLM (LM Studio, Ollama) under “Service” fills in the API URL. For other services, choose “Other” and enter the API URL. Then enter the model name and, if needed, an API key. Highlighting matching words works only when translating from English.',
      'help.anthropic': 'Claude translates with Anthropic\'s API. The source text is sent to Anthropic. Enter an API key created in the Claude Console (platform.claude.com) and a model name (for example, claude-haiku-5-5). Usage is charged to your Claude Console credits. Highlighting matching words works only when translating from English.',
      presetCleared: 'The service changed, so the model name and API key were cleared. Enter the ones for this service.',
      loadingModels: 'Loading the model list…', pickModel: '(Choose from the list)', noModelOption: '(No models found)',
      modelsFound: '{count} models found. Choose one under “Available models”.',
      modelsNone: 'No models were found. Enter the model name directly.', modelsFailed: 'The model list could not be loaded.',
      concurrency: '{n}', highlightOn: 'Highlighting of the whole source sentence is on.', highlightOff: 'Highlighting of the whole source sentence is off.',
      previewAligned: 'Hovering over “sleep” in “{source}” shows the popup like this, with the matching translation in yellow.',
      previewPlain: 'Translating “{source}” shows the popup like this.',
      appearanceReset: 'The appearance was reset.', appearanceSaved: 'The appearance was saved.', saveFailed: 'Could not save. Please try again.',
      settingsSaved: 'Settings saved.', testing: 'Testing…', testConnecting: 'Saving the settings and connecting to the translation service. Please wait.',
      connectedViews: '\nConnected PDF views: {n}', alignedWord: '\nTranslation of “sleep”: {text}', noAlignment: 'The model did not return word mappings',
      testOK: 'Connected: {text}', testFailed: 'Connection test failed: {text}', requestIncomplete: 'The request did not complete. Check the connection settings.',
      deleting: 'Deleting…', cacheDeleted: 'The cache of loaded items was deleted.', deleteFailed: 'Could not delete. Please try again.'
    }
  };
  function t(key, params = {}) {
    const text = messages[language][key] ?? messages.ja[key] ?? key;
    return text.replace(/\{(\w+)\}/g, (m, name) => Object.hasOwn(params, name) ? String(params[name]) : m);
  }
  // Text in `backticks` becomes a code element.
  function setText(node, text) {
    const parts = text.split('`');
    node.replaceChildren(...parts.map((part, i) => {
      if (!(i % 2)) return part;
      const code = node.ownerDocument.createElementNS('http://www.w3.org/1999/xhtml', 'code');
      code.textContent = part; return code;
    }));
  }
  function localize(root) {
    if (language === 'ja') return;
    for (const node of root.querySelectorAll('[data-ht]')) { const text = pageEn[node.getAttribute('data-ht')]; if (text) setText(node, text); }
    for (const attr of ['placeholder', 'aria-label']) {
      for (const node of root.querySelectorAll('[data-ht-' + attr + ']')) { const text = pageEn[node.getAttribute('data-ht-' + attr)]; if (text) node.setAttribute(attr, text); }
    }
  }
  return { language, t, localize, pageEn, messages };
})();
window.HTPrefs = {
  init() {
    const root = document.getElementById('ht-preferences');
    if (!root || root.getAttribute('data-initialized') === 'true') return;
    const api = Zotero.HoverTranslate;
    const t = HTPrefsText.t;
    HTPrefsText.localize(root);
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
    // Show only the fields the selected service uses.
    const fieldsFor = { google: [], deepl: ['deeplApiKey'], openai: ['endpointPreset','baseURL','model','apiKey'], anthropic: ['claudeModel','claudeApiKey'], gemini: ['geminiModel','geminiApiKey'] };
    const providerUI = () => {
      const provider = fieldsFor[get('provider').value] ? get('provider').value : 'openai';
      for (const key of Object.values(fieldsFor).flat()) {
        const shown = fieldsFor[provider].includes(key);
        get(key).disabled = !shown;
        for (const node of [get(key), document.querySelector('label[for="ht-' + key + '"]')]) if (node) node.style.display = shown ? '' : 'none';
      }
      get('api-help').textContent = t('help.' + provider);
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
      if (hadCredentials) notify('test-status', t('presetCleared'));
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
      get('loadModels').disabled = true; modelsStatus(t('loadingModels'));
      try {
        const ids = await api.listModels(values);
        if (ticket !== modelRequest) return;
        updateUI(() => {
          const select = get('modelChoice'), input = get(key);
          select.replaceChildren(option('', ids.length ? t('pickModel') : t('noModelOption')), ...ids.map(id => option(id, id)));
          select.setAttribute('data-provider', provider);
          // With a single model and an empty name, there is nothing to choose.
          if (!input.value.trim() && ids.length === 1) { input.value = ids[0]; input.dispatchEvent(new window.Event('input')); }
          select.value = ids.includes(input.value) ? input.value : '';
          showModelChoice();
        });
        modelsStatus(ids.length ? t('modelsFound', { count: ids.length }) : t('modelsNone'));
      } catch (e) {
        if (ticket === modelRequest) modelsStatus(e.message || t('modelsFailed'));
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
    const concurrencyLabel=()=>{get('fullConcurrencyValue').textContent=t('concurrency',{n:get('fullConcurrency').value});};
    get('fullConcurrency').addEventListener('input',concurrencyLabel);
    get('fullConcurrency').addEventListener('change',concurrencyLabel);
    concurrencyLabel();
    get('highlightSentence').onchange = () => {
      api.setSourceHighlight(get('highlightSentence').checked);
      notify('save-status', get('highlightSentence').checked ? t('highlightOn') : t('highlightOff'));
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
        ? t('previewAligned', { source: samples.en.join('') })
        : t('previewPlain', { source: samples.en.join('') });
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
        preview(); notify(target, target === 'default-status' ? t('appearanceReset') : t('appearanceSaved'));
      } catch(e) { fail(target, e.message || t('saveFailed')); }
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
    get('save').onclick = () => { try { save(); notify('save-status', t('settingsSaved')); } catch(e) { fail('save-status', e.message || t('saveFailed')); } };
    get('test').onclick = async () => {
      if (get('test').disabled) return;
      const button = get('test'), feedback = get('test-status');
      const label = button.textContent;
      window.clearTimeout(feedbackTimers.get('test-status'));
      feedbackTimers.delete('test-status');
      get('test').disabled = true;
      button.textContent = t('testing');
      feedback.textContent = t('testConnecting');
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
          details = t('connectedViews', { n: d.connectedPDFViews }) + (d.cache.error ? '\n' + d.cache.error : '');
        } catch (_) { /* Optional diagnostics must not turn success into failure. */ }
        const alignment = withAlignment ? t('alignedWord', { text: mapped || t('noAlignment') }) : '';
        notify('test-status', t('testOK', { text: result.text }) + alignment + details);
      } catch (e) {
        fail('test-status', t('testFailed', { text: e.message || t('requestIncomplete') }));
      } finally {
        updateUI(() => { button.disabled = false; button.textContent = label; feedback.removeAttribute('aria-busy'); });
      }
    };
    get('clear').onclick = async () => {
      if (get('clear').disabled) return;
      window.clearTimeout(feedbackTimers.get('clear-status'));
      get('clear-status').textContent = t('deleting');
      get('clear').disabled = true;
      try { await api.reset(); notify('clear-status', t('cacheDeleted')); }
      catch(e) { fail('clear-status', e.message || t('deleteFailed')); }
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
