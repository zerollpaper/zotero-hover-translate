/* Original Zotero integration; PDF coordinates come from Zotero's reader. */
var HoverTranslate = (() => {
  'use strict';
  const PREFIX = 'extensions.hoverTranslate.';
  const t = (key, params) => HTCore.t(key, params);
  const contexts = new Map(), inflight = new Map(), requests = new Set();
  const articleCaches = new Map(), memoryReaders = new WeakMap();
  const fullDocuments = new Map();
  let activeFullJob = null;
  let nextContextID = 0;
  function shortHash(value) {
    let n=2166136261;
    for(let i=0;i<value.length;i++) n=Math.imul(n^value.charCodeAt(i),16777619);
    return (n>>>0).toString(16);
  }
  async function fullDocumentFor(reader, store, c = config()) {
    if (!reader) return null;
    const serviceKey = store.cache.key(serviceURL(c), serviceModel(c), '', c.targetLanguage, c.alignWords);
    const item = reader._item || Zotero.Items?.get(reader.itemID);
    const id = String(item?.key || item?.id || reader.itemID || store.id);
    const registryKey = JSON.stringify([store.id,id,serviceKey]);
    if (!fullDocuments.has(registryKey)) {
      const prefix = store.path ? PathUtils.join(PathUtils.parent(store.path),'hover-translate-fulltext-'+shortHash(id)+'-'+shortHash(serviceKey)) : null;
      const entry = { prefix, reader, archive:null };
      entry.archive = HTFullText.create({
        id, serviceKey, title: item?.getField?.('title') || t('pdfFullTitle'),
        storage: prefix ? {
          async read() {
            if (!(await IOUtils.exists(prefix+'.json'))) return null;
            if ((await IOUtils.stat(prefix+'.json')).size > 100000000) throw new Error('Full-text archive too large');
            return IOUtils.readJSON(prefix+'.json');
          },
          write: data => IOUtils.writeJSON(prefix+'.json',data,{tmpPath:prefix+'.json.tmp'})
        } : null,
        translate: (text,signal) => translate(text,{reader:entry.reader,signal,skipFull:true})
      });
      fullDocuments.set(registryKey,entry);
    }
    const entry=fullDocuments.get(registryKey);
    entry.reader=reader;
    await entry.archive.ready;
    return entry;
  }
  let nextMemoryReader = 0;
  async function cacheFor(reader) {
    let cachePath = null, warning = '';
    if (reader && typeof PathUtils !== 'undefined') {
      try {
        const item = reader._item || Zotero.Items.get(reader.itemID);
        const file = await item.getFilePathAsync();
        if (file && await IOUtils.exists(file)) cachePath = PathUtils.join(PathUtils.parent(file), 'hover-translate-cache.json');
        else warning = t('pdfNotLocal');
      } catch (_) { warning = t('pdfPathFailed'); }
    }
    if (reader && !memoryReaders.has(reader)) memoryReaders.set(reader, ++nextMemoryReader);
    const id = cachePath || (reader ? 'memory-reader-' + memoryReaders.get(reader) : 'memory-test');
    if (!articleCaches.has(id)) {
      const cache = HTCache.create({ storage: cachePath ? {
        async read() {
          if (!(await IOUtils.exists(cachePath))) return null;
          if ((await IOUtils.stat(cachePath)).size > 8000000) throw new Error('Cache too large');
          return IOUtils.readJSON(cachePath);
        },
        write: data => IOUtils.writeJSON(cachePath, data, { tmpPath: cachePath + '.tmp' })
      } : null });
      articleCaches.set(id, { id, path: cachePath, warning, cache });
    }
    return articleCaches.get(id);
  }
  async function flushCaches() { await Promise.all([...articleCaches.values()].map(s => s.cache.flush())); }
  async function flushFullDocuments() { await Promise.allSettled([...fullDocuments.values()].map(d=>d.archive.settle())); }
  function cacheStatus() {
    const stores = [...articleCaches.values()];
    return {
      persistent: stores.some(s => s.path), count: stores.reduce((n,s) => n+s.cache.status().count,0),
      error: stores.map(s => s.cache.status().error || s.warning).filter(Boolean).join('; '),
      paths: stores.filter(s => s.path).map(s => s.path)
    };
  }
  let timer, timerWindow, running = false, generation = 0;
  let activeContext = null;
  function dropContext(win, ctx) {
    contexts.delete(win);
    try { ctx.destroy(); } catch (_) { /* The reader compartment may already be gone. */ }
  }
  function visitContexts(action) {
    for (const [win, ctx] of contexts) {
      try {
        if (!ctx.isAlive()) { dropContext(win, ctx); continue; }
        action(ctx);
      } catch (_) {
        // A closed PDF must never abort a settings save or another reader.
        dropContext(win, ctx);
      }
    }
  }
  const PROVIDERS = ['openai','google','anthropic','gemini','deepl'];
  // Each service keeps its own key and model, so switching services never sends
  // one service's key to another.
  const ALIGNMENT_PROVIDERS = ['openai','anthropic','gemini'];
  const appearanceRanges = { fontSize: [12, 32, 17], popupWidth: [240, 1200, 640], transparency: [0, 80, 0] };
  const defaults = { provider: 'openai', sourceLanguage: 'en', targetLanguage: HTCore.defaultTargetLanguage(), alignWords: false, enabled: true, highlightSentence: true, baseURL: '', model: '', apiKey: '', claudeModel: 'claude-haiku-5-5', claudeApiKey: '', geminiModel: 'gemini-3.5-flash-lite', geminiApiKey: '', deeplApiKey: '', delay: 500, fullConcurrency: 3, maxChars: 1800, fontSize: 17, popupWidth: 640, transparency: 0 };
  function normalizeConcurrency(value) {
    const n=Number(value);
    return Number.isFinite(n)?Math.max(1,Math.min(6,Math.floor(n))):3;
  }
  function normalizeAppearance(values) {
    return Object.fromEntries(Object.entries(appearanceRanges).map(([key, [min, max, fallback]]) => {
      const n = values[key] === '' || values[key] == null ? fallback : Number(values[key]);
      return [key, Number.isFinite(n) ? Math.round(Math.max(min, Math.min(max, n))) : fallback];
    }));
  }
  function config() {
    const c = {};
    for (const [key, fallback] of Object.entries(defaults)) c[key] = Zotero.Prefs.get(PREFIX + key, true) ?? fallback;
    if (!PROVIDERS.includes(c.provider)) c.provider = 'openai';
    c.sourceLanguage = HTCore.normalizeSourceLanguage(c.sourceLanguage);
    if (!ALIGNMENT_PROVIDERS.includes(c.provider) || c.sourceLanguage !== 'en' || (c.provider === 'openai' && HTCore.isPlamoTranslate(c.model))) c.alignWords = false;
    return { ...c, targetLanguage: HTCore.normalizeLanguage(c.targetLanguage), ...normalizeAppearance(c), fullConcurrency: normalizeConcurrency(c.fullConcurrency) };
  }
  function serviceURL(c) {
    return c.provider === 'google' ? HTCore.googleEndpoint : c.provider === 'anthropic' ? HTCore.anthropicEndpoint :
      c.provider === 'gemini' ? HTCore.geminiEndpoint : c.provider === 'deepl' ? HTCore.deeplEndpoint(c.deeplApiKey) : HTCore.endpoint(c.baseURL);
  }
  function serviceModel(c) {
    const model = { google: 'google-translate-gtx', anthropic: c.claudeModel, gemini: c.geminiModel, deepl: 'deepl' }[c.provider] ?? c.model;
    return model + '|source=' + c.sourceLanguage;
  }
  // Returns the message for a service that is not set up yet, or '' when it is ready.
  function setupProblem(c, place = t('placeSettings')) {
    if (c.provider === 'anthropic') return c.claudeApiKey && c.claudeModel ? '' : t('setupClaude', { place });
    if (c.provider === 'gemini') return c.geminiApiKey && c.geminiModel ? '' : t('setupGemini', { place });
    if (c.provider === 'deepl') return c.deeplApiKey ? '' : t('setupDeepL', { place });
    if (c.provider === 'openai') return c.baseURL && c.model ? '' : t('setupLLM', { place });
    return '';
  }
  function saveAppearance(values) {
    const appearance = normalizeAppearance({ ...config(), ...values });
    for (const [key,value] of Object.entries(appearance)) Zotero.Prefs.set(PREFIX + key, value, true);
    visitContexts(ctx => ctx.applyAppearance());
    return appearance;
  }
  function setSourceHighlight(enabled) {
    Zotero.Prefs.set(PREFIX + 'highlightSentence', !!enabled, true);
    visitContexts(ctx => ctx.refreshHighlight());
  }
  function save(values) {
    const baseURL = String(values.baseURL || '').trim();
    const provider = values.provider || config().provider;
    if (!PROVIDERS.includes(provider)) throw HTCore.failure('providerInvalid');
    if (provider === 'openai' && baseURL) HTCore.endpoint(baseURL);
    if (provider === 'openai' && baseURL && !String(values.model || '').trim()) throw HTCore.failure('modelRequired');
    if (provider === 'anthropic' && 'claudeModel' in values && !String(values.claudeModel || '').trim()) throw HTCore.failure('claudeModelRequired');
    if (provider === 'gemini' && 'geminiModel' in values && !String(values.geminiModel || '').trim()) throw HTCore.failure('geminiModelRequired');
    if ('sourceLanguage' in values) values.sourceLanguage = HTCore.normalizeSourceLanguage(values.sourceLanguage);
    if ('targetLanguage' in values) values.targetLanguage = HTCore.normalizeLanguage(values.targetLanguage);
    for (const key of Object.keys(defaults)) {
      if (!(key in values)) continue;
      if (key in appearanceRanges) continue;
      let value = values[key];
      if (key === 'delay') value = Math.max(200, Math.min(3000, Number(value) || 500));
      if (key === 'fullConcurrency') value = normalizeConcurrency(value);
      if (typeof value === 'string') value = value.trim();
      Zotero.Prefs.set(PREFIX + key, value, true);
    }
    cancelRequests();
    saveAppearance(values);
    visitContexts(ctx => ctx.syncControls?.());
  }
  function cancelRequests() {
    activeFullJob?.archive.cancel(t('settingsChanged'));
    generation++;
    for (const xhr of requests) { try { xhr.abort(); } catch (_) {} }
    requests.clear(); inflight.clear();
    visitContexts(ctx => ctx.clear());
  }
  async function reset() {
    cancelRequests();
    await Promise.all([...fullDocuments.values()].map(d=>d.archive.clear()));
    const results = await Promise.allSettled([...articleCaches.values()].map(s => s.cache.clear()));
    const failed = results.find(r => r.status === 'rejected');
    if (failed) throw failed.reason;
  }
  async function translate(text, { force = false, reader = null, signal = null, skipFull = false } = {}) {
    const epoch = generation;
    const store = await cacheFor(reader), cache = store.cache;
    await cache.ready;
    if (epoch !== generation) throw HTCore.failure('requestCancelled');
    const c = config();
    const problem = setupProblem(c);
    if (problem) throw new Error(problem);
    if (text.length > c.maxChars) throw HTCore.failure('tooLong');
    const tokens = HTCore.words(text);
    if (!tokens.length) throw HTCore.failure('noText');
    const key = cache.key(serviceURL(c), serviceModel(c), text, c.targetLanguage, c.alignWords);
    const full = !skipFull && reader ? await fullDocumentFor(reader,store,c) : null;
    if (!force && full?.archive.get(text)) return full.archive.get(text);
    if (epoch !== generation || signal?.cancelled) throw HTCore.failure('requestCancelled');
    const requestKey = JSON.stringify([store.id, key]);
    const cached = force ? null : cache.get(key);
    if (cached) return cached;
    if (inflight.has(requestKey)) return inflight.get(requestKey);
    // Keep one extra slot available to foreground hover while a full job runs.
    const requestLimit=signal?c.fullConcurrency:activeFullJob?c.fullConcurrency+1:2;
    while (inflight.size >= requestLimit) {
      if (!signal) throw HTCore.failure('busy');
      await Promise.race([...inflight.values()].map(p=>p.catch(()=>null)).concat(signal.promise));
      if (signal.cancelled || epoch !== generation) throw HTCore.failure('requestCancelled');
      if (inflight.has(requestKey)) return inflight.get(requestKey);
    }
    const promise = Promise.resolve().then(async () => {
      let xhr, removeCancel;
      try {
        if (epoch !== generation || signal?.cancelled) throw HTCore.failure('requestCancelled');
        const request = HTCore.serviceRequest(c, text, tokens);
        const response = await Zotero.HTTP.request(request.method, request.url, {
          headers: request.headers, body: request.body, timeout: 45000, responseType: 'json',
          requestObserver: x => {
            xhr = x; requests.add(x);
            removeCancel = signal?.onCancel(()=>{try{x.abort();}catch(_){}});
            if(signal?.cancelled) x.abort();
          }
        });
        const body = typeof response.response === 'string' ? JSON.parse(response.response) : response.response;
        const raw = HTCore.serviceText(c, body);
        const result = c.alignWords ? HTCore.parseResult(raw, tokens.length) : HTCore.parseTranslation(raw, tokens.length);
        if (epoch === generation && !signal?.cancelled) {
          // Bulk jobs checkpoint their own archive instead of rewriting the
          // ordinary LRU file for every sentence of the document.
          if (!skipFull) cache.put(key, result);
          if (full?.archive.get(text)) { try { await full.archive.put(text,result); } catch (_) {} }
        }
        return result;
      } catch (e) {
        const status = e?.status || e?.xmlhttp?.status;
        if (status === 401 || status === 403) throw HTCore.failure('authFailed');
        if (status === 429) throw HTCore.failure('quota');
        if (status && c.provider === 'anthropic') {
          if (status === 400) throw HTCore.failure('claudeBadRequest');
          if (status === 529) throw HTCore.failure('claudeOverloaded');
          throw HTCore.failure('claudeFailed', { status });
        }
        if (status && c.provider === 'gemini') {
          if (status === 400) throw HTCore.failure('geminiBadRequest');
          if (status === 404) throw HTCore.failure('geminiNotFound');
          throw HTCore.failure('geminiFailed', { status });
        }
        if (status && c.provider === 'deepl') {
          if (status === 456) throw HTCore.failure('deeplQuota');
          if (status === 529) throw HTCore.failure('deeplOverloaded');
          throw HTCore.failure('deeplFailed', { status });
        }
        if (status) throw HTCore.failure('httpFailed', { status });
        // Do not show server error bodies, request headers, or credentials.
        if (e instanceof SyntaxError) throw HTCore.failure('invalidJSON');
        // Errors this plugin raised (HTCore.failure) are shown as they are, except
        // a cancelled request, which ends like any other incomplete request.
        if (e?.htCode && e.htCode !== 'requestCancelled') throw e;
        throw HTCore.failure('requestFailed');
      } finally {
        requests.delete(xhr);
        removeCancel?.();
        if (inflight.get(requestKey) === promise) inflight.delete(requestKey);
      }
    });
    inflight.set(requestKey, promise);
    return promise;
  }
  // Lists the model IDs a service offers. values may hold unsaved settings from
  // the settings screen; anything missing comes from the saved configuration.
  async function listModels(values = {}) {
    const c = { ...config(), ...values };
    if (c.provider === 'anthropic' && !String(c.claudeApiKey || '').trim()) throw HTCore.failure('modelsNeedClaudeKey');
    if (c.provider === 'gemini' && !String(c.geminiApiKey || '').trim()) throw HTCore.failure('modelsNeedGeminiKey');
    if (c.provider === 'openai' && !String(c.baseURL || '').trim()) throw HTCore.failure('modelsNeedURL');
    const request = HTCore.modelsRequest(c);
    if (!request) return [];
    try {
      const response = await Zotero.HTTP.request('GET', request.url, { headers: request.headers, responseType: 'json', timeout: 15000 });
      const body = typeof response.response === 'string' ? JSON.parse(response.response) : response.response;
      return HTCore.modelIds(c, body);
    } catch (e) {
      const status = e?.status || e?.xmlhttp?.status;
      // Do not show server error bodies or credentials.
      if (status === 401 || status === 403) throw HTCore.failure('modelsAuth');
      if (c.provider === 'openai' && /^http:\/\/127\.0\.0\.1/.test(String(c.baseURL))) throw HTCore.failure('modelsLocalDown');
      throw HTCore.failure('modelsFailed');
    }
  }
  function makeContext(win, app, hostWindow, reader) {
    const doc = win.document, pages = new Map();
    const contextToken = {};
    const contextID = String(++nextContextID);
    let current = null, result = null, hoverTimer = null, sequence = 0, lookup = 0, lastPoint = null, lastMove = 0, disposed = false;
    let pending = null, overPopup = false, busy = false, hideTimer = null;
    const keyWindows = new Set();
    function isAlive() {
      try { return !disposed && !win.closed && win.document === doc && doc.documentElement.isConnected; }
      catch (_) { return false; }
    }
    let pdfDocument = app.pdfDocument;
    const html = name => doc.createElementNS('http://www.w3.org/1999/xhtml', name);
    doc.getElementById('hover-translate-controls')?.remove();
    doc.getElementById('hover-translate-fulltext')?.remove();
    const fullBar = html('div'); fullBar.id = 'hover-translate-controls';
    fullBar.style.cssText = 'display:inline-flex;align-items:center;position:relative;font:13px/1.5 system-ui;color:inherit;';
    const readerDoc=reader?._iframeWindow?.document || doc;
    const toolbar=readerDoc.querySelector('.toolbar .end') || readerDoc.querySelector('.toolbar');
    const controlsDoc=toolbar ? readerDoc : doc;
    const controlsRow = html('div'); controlsRow.style.cssText='display:flex;gap:6px;align-items:center;flex-wrap:wrap;';
    const toggle = html('button'); toggle.id='hover-translate-toggle'; toggle.type='button';
    const settings = html('button'); settings.type='button'; settings.title=t('settingsTitle');settings.setAttribute('aria-label',t('settingsTitle'));settings.className='toolbar-button';
    const icon=doc.createElementNS('http://www.w3.org/2000/svg','svg');
    for(const [key,value] of Object.entries({viewBox:'0 0 24 24',width:'24',height:'24',fill:'none',stroke:'currentColor','stroke-width':'1.5','stroke-linecap':'round','stroke-linejoin':'round','aria-hidden':'true'}))icon.setAttribute(key,value);
    const path=doc.createElementNS('http://www.w3.org/2000/svg','path');path.setAttribute('d','M3 5h12M9 3v2M5 5c0 5 4 9 8 11M13 5c0 5-4 9-9 11M13 21l4-10 4 10M14.5 17h5');icon.appendChild(path);settings.appendChild(icon); settings.setAttribute('aria-expanded','false');
    const fullStart = html('button'); fullStart.id='hover-translate-fulltext'; fullStart.type='button';
    fullStart.setAttribute('data-ht-context',contextID); fullStart.textContent=t('fullStart');
    for (const b of [toggle,fullStart]) { b.style.cssText='padding:4px 9px;border:var(--material-border-quarternary,1px solid #adb7be);border-radius:5px;background:var(--material-button,ButtonFace);color:inherit;cursor:pointer;font:inherit;';  }
    settings.style.cssText='width:28px;height:28px;padding:0;flex-shrink:0;';
    controlsRow.appendChild(settings);
    const panel = html('div'); panel.id='hover-translate-panel'; panel.hidden=true; panel.style.cssText='position:fixed;z-index:2147483646;box-sizing:border-box;width:340px;max-width:calc(100vw - 16px);max-height:calc(100vh - 70px);overflow:auto;padding:12px;border:var(--material-border-quarternary,1px solid #adb7be);border-radius:7px;background:var(--material-sidepane,Canvas);color:var(--fill-primary,CanvasText);box-shadow:0 3px 12px #0003;display:grid;gap:7px;';
    const actions=html('div');actions.style.cssText='display:flex;gap:6px;';actions.append(toggle,fullStart);panel.appendChild(actions);
    // hidden must win over the grid display rule on the initial render.
    panel.style.display='none';
    const fields={};
    function field(key,label,options=null) {
      const row=html('label'); row.style.cssText='display:grid;grid-template-columns:85px minmax(0,1fr);align-items:center;gap:6px;';
      const name=html('span'); name.textContent=label;
      const input=html(options?'select':'input'); input.id='hover-translate-reader-'+key; input.setAttribute('aria-label',label); input.style.cssText='font:inherit;min-width:0;width:100%;box-sizing:border-box;';
      if(options) for(const [value,text] of options) {const o=html('option');o.value=value;o.textContent=text;input.appendChild(o);}
      else input.type='text';
      row.append(name,input);panel.appendChild(row);fields[key]=input;
      input.addEventListener('change',()=>{try{const values={...config(),[key]:input.value};save(values);feedback.textContent=t('saved');}catch(e){feedback.textContent=e.message;syncControls();}});
      return input;
    }
    const languageOptions=['en','ja','zh-CN','ko','de','fr','es'].map(code=>[code,t('lang.'+code)]);
    field('provider',t('fieldProvider'),[['google',t('provider.google')],['deepl','DeepL'],['openai','LLM API'],['anthropic','Claude'],['gemini','Gemini']]);
    field('sourceLanguage',t('fieldSource'),[['auto',t('lang.auto')],...languageOptions]); field('targetLanguage',t('fieldTarget'),languageOptions);
    const urlField=field('baseURL','API URL'); urlField.placeholder='http://127.0.0.1:1234/v1';
    const modelField=field('model',t('fieldModel')); modelField.placeholder=t('modelPlaceholder');
    const claudeModelField=field('claudeModel',t('fieldModel')); claudeModelField.placeholder='claude-haiku-5-5';
    const geminiModelField=field('geminiModel',t('fieldModel')); geminiModelField.placeholder='gemini-3.5-flash-lite';
    const modelList=html('datalist');modelList.id='hover-translate-models-'+contextID;for(const input of [modelField,claudeModelField,geminiModelField])input.setAttribute('list',modelList.id);panel.appendChild(modelList);
    const loadModels=html('button');loadModels.type='button';loadModels.textContent=t('loadModels');panel.appendChild(loadModels);
    const feedback=html('div');feedback.setAttribute('role','status');feedback.style.cssText='font-size:12px;overflow-wrap:anywhere;';panel.appendChild(feedback);
    const help=html('div');help.style.cssText='font-size:11px;color:var(--fill-secondary,GrayText);';panel.appendChild(help);
    loadModels.onclick=async()=>{loadModels.disabled=true;feedback.textContent=t('loadingModels');try{
      const ids=await listModels(config());if(!isAlive())return;
      modelList.replaceChildren();for(const id of ids){const option=html('option');option.value=id;modelList.appendChild(option);}
      feedback.textContent=ids.length?t('modelsReady'):t('modelsNone');
    }catch(e){if(isAlive())feedback.textContent=e.message;}finally{if(isAlive())syncControls();}};
    function syncControls(){const c=config();toggle.textContent=c.enabled?t('toggleOn'):t('toggleOff');toggle.setAttribute('aria-pressed',String(c.enabled));
      for(const [key,input]of Object.entries(fields))input.value=c[key];
      const llm=c.provider==='openai',noModels=['google','deepl'].includes(c.provider);
      for(const [key,shown] of [['baseURL',llm],['model',llm],['claudeModel',c.provider==='anthropic'],['geminiModel',c.provider==='gemini']]){fields[key].disabled=!shown;fields[key].parentElement.style.display=shown?'grid':'none';}
      loadModels.style.display=noModels?'none':'';loadModels.disabled=noModels;
      help.textContent=t(['google','deepl','anthropic','gemini'].includes(c.provider)?'help.'+c.provider:'help.openai');
    }
    toggle.onclick=()=>{save({...config(),enabled:!config().enabled});};
    function closePanel(){panel.hidden=true;panel.style.display='none';settings.setAttribute('aria-expanded','false');settings.classList.remove('active');}
    settings.onclick=()=>{panel.hidden=!panel.hidden;panel.style.display=panel.hidden?'none':'grid';settings.setAttribute('aria-expanded',String(!panel.hidden));settings.classList.toggle('active',!panel.hidden);
      if(!panel.hidden){const r=settings.getBoundingClientRect();const width=controlsDoc.defaultView.innerWidth;panel.style.top=(r.bottom+6)+'px';panel.style.left=Math.max(8,Math.min(r.right-340,width-348))+'px';clear();}syncControls();};
    const dismissPanel=e=>{if(!fullBar.contains(e.target))closePanel();};
    const panelKey=e=>{if(e.key==='Escape'){closePanel();settings.focus();}};
    controlsDoc.addEventListener('pointerdown',dismissPanel,true);controlsDoc.addEventListener('keydown',panelKey);
    fullBar.append(controlsRow,panel);
    // Keep controls in the reader chrome, outside the PDF page canvas.
    if(toolbar)toolbar.prepend(fullBar);else doc.body.prepend(fullBar);
    syncControls();
    let fullEntry = null, unsubscribeFull = null, startingFull = false;
    function fullFeedback(s) {
      if (!isAlive()) return;
      const working = ['extracting','translating'].includes(s.phase);
      fullStart.disabled = startingFull;
      fullStart.textContent = s.phase === 'extracting' ? t('fullReading', { pages: s.pages, count: s.pageCount }) :
        s.phase === 'translating' ? t('fullTranslating', { done: s.done, total: s.total }) :
        s.phase === 'complete' ? t('fullDone') : s.phase === 'idle' ? t('fullStart') : t('fullResume');
      fullStart.title = working ? t('fullCancelHint') :
        s.phase === 'complete' ? t('fullDoneTitle', { done: s.done, total: s.total }) : s.message || '';
      if (!working && s.emptyPages) fullStart.title += t('fullEmptyPages', { count: s.emptyPages });
      fullStart.setAttribute('aria-busy', String(working));
    }
    async function startFull() {
      if (startingFull || fullStart.disabled) return;
      startingFull = true; fullStart.disabled = true; fullStart.textContent = t('preparing'); fullStart.title = '';
      const epoch = generation, documentRef = app.pdfDocument;
      try {
        const c = config();
        const problem = setupProblem(c, t('placePane'));
        if (problem) throw new Error(problem);
        serviceURL(c);
        const count = Number(documentRef?.numPages);
        if (!Number.isInteger(count) || count<1) throw HTCore.failure('pdfLoading');
        const store = await cacheFor(reader);
        if (!store.path) throw HTCore.failure('fullNeedsFolder');
        const entry = await fullDocumentFor(reader,store,c);
        if (!isAlive() || epoch !== generation) return;
        if (activeFullJob && activeFullJob.archive !== entry.archive) throw HTCore.failure('fullOtherPdf');
        fullEntry = entry; unsubscribeFull?.();
        unsubscribeFull = entry.archive.subscribe(fullFeedback);
        activeFullJob = entry; startingFull = false;
        await entry.archive.run({pageCount:count,concurrency:c.fullConcurrency,getPage:async i=>{
          if(!isAlive() || app.pdfDocument !== documentRef) throw HTCore.failure('readerChanged');
          return readPage(i,documentRef);
        }});
        if (activeFullJob === entry) activeFullJob = null;
      } catch(e) {
        if (isAlive()) { fullStart.textContent = t('fullRetry'); fullStart.title = e.message || t('fullStartFailed'); }
      } finally {
        startingFull = false;
        if (isAlive()) { fullStart.disabled=false; fullStart.setAttribute('aria-busy','false'); }
      }
    }
    fullStart.addEventListener('click',()=>{
      if (fullStart.disabled) return;
      if (fullEntry && ['extracting','translating'].includes(fullEntry.archive.status().phase)) {
        fullStart.disabled=true; fullStart.textContent=t('cancelling');
        fullEntry.archive.cancel(t('cancelledResume'));
      } else startFull();
    });
    async function readPage(pageIndex, documentRef = app.pdfDocument) {
      const args=Components.utils.cloneInto({pageIndex},win);
      const data=await documentRef.getPageData(args);
      const chars=Array.from(data.chars || [],c=>({
        c:c.c,fontSize:c.fontSize,fontName:c.fontName,rect:Array.from(c.rect || []),inlineRect:c.inlineRect?Array.from(c.inlineRect):null,
        ignorable:c.ignorable,spaceAfter:c.spaceAfter,lineBreakAfter:c.lineBreakAfter,paragraphBreakAfter:c.paragraphBreakAfter
      }));
      const viewBox=data.viewBox ? Array.from(data.viewBox) : null;
      return {...HTCore.buildPage(chars,viewBox), chars,viewBox,pageIndex};
    }
    const sentenceOverlay = html('div'); sentenceOverlay.id = 'hover-translate-sentence-highlight';
    sentenceOverlay.setAttribute('aria-hidden', 'true');
    // Blend the whole highlight group with the PDF so black glyphs stay black.
    // Group opacity also prevents overlapping character boxes from darkening.
    sentenceOverlay.style.cssText = 'position:fixed;inset:0;z-index:2147483645;pointer-events:none;mix-blend-mode:multiply;opacity:.32;';
    doc.body.appendChild(sentenceOverlay);
    function highlightSentence(hit) {
      sentenceOverlay.replaceChildren();
      if (!config().highlightSentence || !hit) return;
      for (const rect of hit.sentenceRects || []) {
        const mark = html('div');
        mark.style.cssText = 'position:absolute;pointer-events:none;background:rgb(255,225,100);';
        mark.style.left = rect.left + 'px'; mark.style.top = rect.top + 'px';
        mark.style.width = (rect.right-rect.left) + 'px'; mark.style.height = (rect.bottom-rect.top) + 'px';
        sentenceOverlay.appendChild(mark);
      }
    }
    const box = html('div'); box.id = 'hover-translate-popup';
    box.style.cssText = 'position:fixed;z-index:2147483646;left:12px;top:12px;width:max-content;max-width:min(640px, calc(100vw - 24px));max-height:42vh;overflow:auto;box-sizing:border-box;padding:16px 18px;background:#fff;color:#182a31;border:1px solid #9bacb6;border-radius:12px;box-shadow:0 5px 28px #0003;font:15px/1.65 system-ui,sans-serif;display:none;user-select:text;';
    const close = html('button'); close.textContent = '×'; close.title = t('close');
    close.style.cssText = 'position:absolute;right:10px;top:6px;width:24px;height:24px;padding:0;line-height:24px;border:0;background:transparent;color:inherit;font-size:22px;cursor:pointer;';
    const refresh = html('button'); refresh.textContent = '↻'; refresh.title = t('retranslate');
    refresh.setAttribute('aria-label', t('retranslateLabel'));
    refresh.style.cssText = 'position:absolute;right:10px;top:32px;width:24px;height:24px;padding:0;line-height:24px;border:0;background:transparent;color:inherit;font-size:20px;cursor:pointer;';
    const translation = html('div'); translation.style.cssText = 'font-size:17px;line-height:1.9;min-height:28px;padding-right:24px;white-space:normal;overflow-wrap:anywhere;';
    box.append(close, refresh, translation); doc.body.appendChild(box);
    function applyAppearance() {
      const c = config();
      translation.style.fontSize = c.fontSize + 'px';
      box.style.maxWidth = 'min(' + c.popupWidth + 'px, calc(100vw - 24px))';
      box.style.backgroundColor = 'rgba(255, 255, 255, ' + (1 - c.transparency / 100) + ')';
      position();
    }
    applyAppearance();
    function cancelPending() { win.clearTimeout(hoverTimer); hoverTimer = null; pending = null; }
    function cancelHide() { win.clearTimeout(hideTimer); hideTimer = null; }
    function scheduleHide() {
      if (overPopup || hideTimer !== null) return;
      hideTimer = win.setTimeout(clear, 100);
    }
    function sameSentence(a, b) {
      return a && b && a.pageIndex === b.pageIndex && a.sentence.start === b.sentence.start && a.sentence.text === b.sentence.text;
    }
    function position() {
      if (!current?.bounds || box.style.display === 'none') return;
      const margin = 12, gap = 10;
      let bounds = current.bounds;
      const width = win.innerWidth, height = win.innerHeight;
      let above = Math.max(0, bounds.top - gap - margin);
      let below = Math.max(0, height - margin - bounds.bottom - gap);
      // A long/offscreen sentence can span the whole visible page. Anchor near
      // the hovered line rather than collapsing the popup to one pixel.
      if (Math.max(above, below) < 96 && current.point) {
        bounds = { left: current.bounds.left, right: current.bounds.right, top: current.point.y - 12, bottom: current.point.y + 12 };
        above = Math.max(0, bounds.top - gap - margin);
        below = Math.max(0, height - margin - bounds.bottom - gap);
      }
      box.style.maxHeight = Math.max(1, height * 0.42) + 'px';
      const natural = box.getBoundingClientRect().height;
      const useAbove = above >= natural || above >= below;
      const room = useAbove ? above : below;
      box.style.maxHeight = Math.max(60, Math.min(height * 0.42, room)) + 'px';
      const size = box.getBoundingClientRect();
      const centerX = (bounds.left + bounds.right) / 2;
      const left = Math.max(margin, Math.min(centerX - size.width / 2, width - margin - size.width));
      const top = useAbove ? bounds.top - gap - size.height : bounds.bottom + gap;
      box.style.left = left + 'px';
      box.style.top = Math.max(margin, Math.min(top, height - margin - size.height)) + 'px';
    }
    function clear() {
      sequence++; lookup++; cancelPending(); cancelHide(); current = null; result = null; busy = false; overPopup = false;
      box.style.display = 'none'; lastPoint = null;
      sentenceOverlay.replaceChildren();
      if (activeContext === contextToken) activeContext = null;
      refresh.disabled = false; refresh.textContent = '↻'; box.removeAttribute('aria-busy');
    }
    function render() {
      if (!current || !result) return;
      translation.replaceChildren();
      for (const segment of result.segments) {
        const el = html('span'); el.textContent = segment.text;
        if (segment.source.includes(current.word.id)) {
          el.style.cssText = 'background:#ffe28a;color:#17252e;border-radius:3px;box-shadow:0 0 0 2px #ffe28a;';
        }
        translation.appendChild(el);
      }
      position();
    }
    async function show(force = false) {
      if (!current || !isAlive()) return;
      const ticket = sequence, text = current.sentence.text;
      busy = true;
      activeContext = contextToken;
      refresh.disabled = true; refresh.textContent = '…'; refresh.title = force ? t('retranslating') : t('translating');
      box.style.display = 'block';
      // Retain the existing translation while explicitly refreshing it.
      if (!force || !result) translation.textContent = t('translatingSentence');
      box.setAttribute('aria-busy', 'true');
      position();
      try {
        const translated = await translate(text, { force, reader });
        if (!isAlive() || ticket !== sequence || !current) return;
        result = translated; render();
        refresh.title = force ? t('retranslated') : t('retranslate');
      } catch (e) {
        if (!isAlive() || ticket !== sequence) return;
        if (force && result) { render(); translation.appendChild(doc.createTextNode(t('retranslateFailed'))); }
        else translation.textContent = e.message;
        refresh.title = t('translateFailed');
        position();
      } finally {
        if (isAlive() && ticket === sequence) { busy = false; refresh.disabled = false; refresh.textContent = '↻'; box.removeAttribute('aria-busy'); }
      }
    }
    async function locate(x, y) {
      const pageEl = doc.elementFromPoint(x,y)?.closest('.page[data-page-number]');
      if (!pageEl) return null;
      const pageIndex = Number(pageEl.dataset.pageNumber) - 1;
      const view = app.pdfViewer?.getPageView(pageIndex);
      if (!view?.viewport || !app.pdfDocument) return null;
      if (pdfDocument !== app.pdfDocument) { pdfDocument = app.pdfDocument; pages.clear(); clear(); }
      const cached= index => {
        if(!pages.has(index)) {
          pages.set(index,readPage(index).catch(e=>{pages.delete(index);throw e;}));
          if(pages.size>12) pages.delete(pages.keys().next().value);
        }
        return pages.get(index);
      };
      const indexes=[pageIndex-1,pageIndex,pageIndex+1].filter(i=>i>=0 && i<(app.pdfDocument.numPages||pageIndex+1));
      const neighboring=await Promise.all(indexes.map(cached));
      const page=HTCore.joinPages(neighboring);
      const rect = pageEl.getBoundingClientRect();
      const localX = (x - rect.left) * pageEl.offsetWidth / rect.width - pageEl.clientLeft;
      const localY = (y - rect.top) * pageEl.offsetHeight / rect.height - pageEl.clientTop;
      const [px, py] = view.viewport.convertToPdfPoint(localX * view.viewport.width / pageEl.clientWidth, localY * view.viewport.height / pageEl.clientHeight);
      const hit = HTCore.atPoint(page, px, py, pageIndex);
      if (!hit) {
        // Spaces and punctuation have no word mapping but still belong to the
        // active sentence. Keep its last highlight without restarting the timer.
        const previous = current || pending;
        if (previous?.pageIndex === pageIndex && HTCore.withinSentence(page, previous.sentence, px, py, pageIndex)) return previous;
        return null;
      }
      // Convert the full sentence's PDF rectangles back into viewport coordinates.
      // The anchor is sentence-wide, so moving between its words does not move the popup.
      let bounds = { left: x, right: x, top: y - 12, bottom: y + 12 };
      const highlightRects = [];
      try {
        const sentenceRects = page.anchors.filter(a => a.end > hit.sentence.start && a.start < hit.sentence.end)
        .map(a => {
          const targetIndex=a.pageIndex ?? pageIndex;
          const targetEl=targetIndex===pageIndex?pageEl:doc.querySelector('.page[data-page-number="'+(targetIndex+1)+'"]');
          const targetView=targetIndex===pageIndex?view:app.pdfViewer?.getPageView(targetIndex);
          if(!targetEl || !targetView?.viewport || !targetEl.clientWidth || !targetEl.clientHeight)return null;
          const targetRect=targetEl.getBoundingClientRect(),vp=targetView.viewport;
          // Only primitive numbers cross the PDF reader compartment boundary.
          const a1=vp.convertToViewportPoint(a.inlineRect[0],a.inlineRect[1]);
          const a2=vp.convertToViewportPoint(a.inlineRect[2],a.inlineRect[3]);
          const screenX=v=>targetRect.left+(targetEl.clientLeft+v*targetEl.clientWidth/vp.width)*targetRect.width/targetEl.offsetWidth;
          const screenY=v=>targetRect.top+(targetEl.clientTop+v*targetEl.clientHeight/vp.height)*targetRect.height/targetEl.offsetHeight;
          return {pageIndex:targetIndex,start:a.start,end:a.end,left:screenX(Math.min(a1[0],a2[0])),right:screenX(Math.max(a1[0],a2[0])),top:screenY(Math.min(a1[1],a2[1])),bottom:screenY(Math.max(a1[1],a2[1]))};
        }).filter(r => r && Object.values(r).every(Number.isFinite));
        // Merge adjacent glyph boxes on each line, never across line/column gaps.
        for (const r of sentenceRects.filter(r => r.right > r.left && r.bottom > r.top).sort((a,b) => a.top-b.top || a.left-b.left)) {
          const previous = highlightRects[highlightRects.length-1];
          const height = r.bottom-r.top;
          if (previous && previous.pageIndex===r.pageIndex && Math.abs(previous.top-r.top) <= height*0.25 && Math.abs(previous.bottom-r.bottom) <= height*0.25 && r.left-previous.right <= height*1.5) {
            previous.left = Math.min(previous.left,r.left); previous.right = Math.max(previous.right,r.right);
            previous.top = Math.min(previous.top,r.top); previous.bottom = Math.max(previous.bottom,r.bottom);
          } else highlightRects.push({...r});
        }
        const localRects=sentenceRects.filter(r=>r.pageIndex===pageIndex);
        if (localRects.length) bounds = {
        left: Math.min(...localRects.map(r => r.left)), right: Math.max(...localRects.map(r => r.right)),
        top: Math.min(...localRects.map(r => r.top)), bottom: Math.max(...localRects.map(r => r.bottom))
        };
      } catch (_) {
        // Geometry is optional: a valid sentence must still reach translation.
      }
      return { ...hit, pageIndex, bounds, sentenceRects: highlightRects, point: { x, y } };
    }
    async function move(event) {
      if (fullBar.contains(event.target)) { clear(); return; }
      if (box.contains(event.target)) { enterPopup(); return; }
      overPopup = false;
      if (!config().enabled || event.buttons || !win.getSelection().isCollapsed) { clear(); return; }
      const now = Date.now();
      if (now - lastMove < 45) return;
      lastMove = now;
      const point = { x: event.clientX, y: event.clientY }; lastPoint = point;
      const id = ++lookup;
      try {
        const hit = await locate(point.x, point.y);
        if (!isAlive() || id !== lookup || lastPoint !== point) return;
        if (!hit) {
          cancelPending(); scheduleHide();
          return;
        }
        cancelHide();
        activeContext = contextToken;
        if (sameSentence(current, hit)) {
          cancelPending();
          const changed = current.word.id !== hit.word.id;
          highlightSentence(hit);
          current = hit; if (result && changed) render(); return;
        }
        if (sameSentence(pending, hit)) { pending = hit; highlightSentence(hit); return; }
        clear(); activeContext = contextToken; pending = hit;
        highlightSentence(hit);
        // Hide the previous sentence immediately; only opening uses a delay.
        hoverTimer = win.setTimeout(() => {
          const next = pending; cancelPending();
          if (!next || disposed || overPopup) return;
          sequence++; current = next; result = null; show();
        }, config().delay);
      } catch (_) {
        // Malformed/scanned pages do not interrupt Zotero's own reader.
      }
    }
    function selection() {
      const selected = win.getSelection();
      if (!selected.isCollapsed && !box.contains(selected.anchorNode)) clear();
    }
    function retranslate() {
      if (!config().enabled || !current || box.style.display === 'none') return;
      if (busy) return;
      cancelPending(); sequence++; show(true);
    }
    function key(event) {
      if (activeContext !== contextToken || doc.hidden || disposed) return;
      if (event.key === 'Escape') { clear(); return; }
      if (event.defaultPrevented || event.repeat || event.shiftKey || !event.altKey || !(event.ctrlKey || event.metaKey)) return;
      if (event.code !== 'KeyR' && String(event.key).toLowerCase() !== 'r') return;
      const target = event.target;
      if (target?.isContentEditable || target?.closest?.('input, textarea, select, textbox, [contenteditable]:not([contenteditable="false"])')) return;
      if (!config().enabled || !current || box.style.display === 'none') return;
      event.preventDefault(); event.stopPropagation();
      retranslate();
    }
    function enterPopup() { activeContext = contextToken; overPopup = true; lookup++; cancelHide(); cancelPending(); }
    function exitPopup() { overPopup = false; scheduleHide(); }
    function leave(event) {
      if (box.contains(event.relatedTarget)) { enterPopup(); return; }
      overPopup = false; lookup++; cancelPending(); scheduleHide();
    }
    function scroll(event) { if (!box.contains(event.target)) clear(); }
    close.addEventListener('click', clear);
    refresh.addEventListener('click', retranslate);
    box.addEventListener('mouseenter', enterPopup);
    box.addEventListener('mouseleave', exitPopup);
    doc.addEventListener('mousemove', move, true);
    doc.addEventListener('selectionchange', selection);
    // Hover does not focus the PDF iframe. Listen along its containing-window
    // chain as well, and route to only the most recently hovered visible popup.
    let keyWindow = win;
    for (let i = 0; keyWindow && i < 8; i++) {
      try {
        if (keyWindows.has(keyWindow)) break;
        keyWindow.addEventListener('keydown', key, true);
        keyWindows.add(keyWindow);
        if (keyWindow.parent === keyWindow) break;
        keyWindow = keyWindow.parent;
      } catch (_) { break; }
    }
    if (hostWindow && !keyWindows.has(hostWindow)) {
      hostWindow.addEventListener('keydown', key, true); keyWindows.add(hostWindow);
    }
    doc.addEventListener('mouseleave', leave);
    doc.addEventListener('scroll', scroll, true);
    win.addEventListener('resize', clear);
    win.addEventListener('blur', clear);
    function destroy() {
      if (disposed) return;
      // Invalidate asynchronous work before touching any window-owned objects.
      disposed = true; sequence++; lookup++; current = null; pending = null; result = null; pages.clear();
      unsubscribeFull?.();
      if (activeFullJob === fullEntry) fullEntry?.archive.cancel(t('readerClosed'));
      if (activeContext === contextToken) activeContext = null;
      const cleanup = [
        () => win.clearTimeout(hoverTimer), () => win.clearTimeout(hideTimer),
        () => box.remove(), () => sentenceOverlay.remove(),
        () => fullBar.remove(),
        () => controlsDoc.removeEventListener('pointerdown',dismissPanel,true),
        () => controlsDoc.removeEventListener('keydown',panelKey),
        () => doc.removeEventListener('mousemove', move, true),
        () => doc.removeEventListener('selectionchange', selection),
        () => doc.removeEventListener('mouseleave', leave),
        () => doc.removeEventListener('scroll', scroll, true),
        () => win.removeEventListener('resize', clear),
        () => win.removeEventListener('blur', clear),
        () => win.removeEventListener('unload', unload)
      ];
      for (const w of keyWindows) cleanup.push(() => w.removeEventListener('keydown', key, true));
      // A dead inner frame must not prevent removal of listeners on its live host.
      for (const release of cleanup) { try { release(); } catch (_) {} }
      keyWindows.clear();
    }
    function unload() { contexts.delete(win); destroy(); }
    win.addEventListener('unload', unload, { once: true });
    return { clear, doc, contextID, isAlive, applyAppearance, syncControls, setFullControlVisible: visible => { fullStart.style.display=visible?'':'none'; fullBar.style.display=visible?'inline-flex':'none'; }, refreshHighlight: () => highlightSentence(current || pending), destroy };
  }
  function scan() {
    if (!running) return;
    const found = new Set();
    function walk(win, depth = 0, hostWindow = null, reader = null, controls = { assigned:false }) {
      if (!win || depth > 5) return;
      try {
        const native = win.wrappedJSObject || win;
        const app = native.PDFViewerApplication;
        // Zotero can expose the same PDF application on a wrapper frame.
        // Attach only to the actual page document, and reuse its context even
        // when Gecko exposes a different Window wrapper on a subsequent scan.
        if (app?.pdfDocument && win.document.body && win.document.querySelector('.pdfViewer, .page[data-page-number]')) {
          const id=win.document.getElementById('hover-translate-fulltext')?.getAttribute('data-ht-context');
          let existing=[...contexts].find(([,ctx])=>ctx.doc===win.document || ctx.contextID===id);
          if (existing && !existing[1].isAlive()) { dropContext(...existing); existing=null; }
          if (!existing) {
            if (contexts.has(win)) dropContext(win,contexts.get(win));
            const ctx=makeContext(win,app,hostWindow,reader);
            contexts.set(win,ctx); existing=[win,ctx];
          }
          if (!found.has(existing[0])) existing[1].setFullControlVisible(!controls.assigned);
          found.add(existing[0]);
          controls.assigned=true;
        }
        for (const iframe of win.document.querySelectorAll('iframe')) walk(iframe.contentWindow, depth + 1, hostWindow, reader, controls);
      } catch (_) {}
    }
    for (const reader of Zotero.Reader._readers || []) walk(reader._iframeWindow, 0, reader._window, reader);
    for (const [win, ctx] of contexts) if (!found.has(win)) dropContext(win, ctx);
  }
  // The scan timer lives on a main window, so it has to move when that window
  // closes: on macOS Zotero keeps running and opens a new main window later.
  function stopTimer() {
    try { timerWindow?.clearInterval(timer); } catch (_) {}
    timer = null; timerWindow = null;
  }
  function startTimer(win) {
    stopTimer();
    if (!win) return;
    timerWindow = win; timer = win.setInterval(scan, 1500);
  }
  const mainWindows = new Set();
  function start() {
    running = true; scan();
    const win = Zotero.getMainWindow();
    if (win) mainWindows.add(win);
    startTimer(win);
  }
  function mainWindowLoaded(win) {
    if (!running) return;
    mainWindows.add(win);
    if (timerWindow) return;
    startTimer(win); scan();
  }
  function mainWindowUnloaded(win) {
    mainWindows.delete(win);
    if (!running || win !== timerWindow) return;
    stopTimer();
    // Zotero may still report the closing window as the main one.
    const other = [...mainWindows].find(w => w !== win && !w.closed);
    if (other) startTimer(other);
  }
  async function stop() {
    running = false;
    stopTimer(); mainWindows.clear();
    cancelRequests();
    for (const [win, ctx] of contexts) dropContext(win, ctx);
    await flushFullDocuments();
    await flushCaches();
  }
  return { start, stop, mainWindowLoaded, mainWindowUnloaded, config, save, saveAppearance, listModels, setSourceHighlight, normalizeAppearance, translate, reset, flushCache: flushCaches, diagnostic: () => ({ connectedPDFViews: contexts.size, cache: cacheStatus() }) };
})();
