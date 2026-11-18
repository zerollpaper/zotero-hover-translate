const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {JSDOM}=require(process.env.HT_JSDOM || 'jsdom');
const core=require('../core.js');
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
const japanese=/[぀-ヿ一-鿿]/;
function plugin(locale,request=async()=>{throw new Error('no request expected');},prefsValues={}){
  const prefs=new Map(Object.entries(prefsValues).map(([k,v])=>['extensions.hoverTranslate.'+k,v]));
  const scope={URL,Zotero:{locale,Prefs:{get:k=>prefs.get(k),set:(k,v)=>prefs.set(k,v)},HTTP:{request},Reader:{_readers:[]}},Services:{},Components:{}};
  vm.createContext(scope);
  for(const f of ['core.js','cache.js','fulltext.js','addon.js'])vm.runInContext(read(f),scope);
  return scope;
}
function prefsPane(locale){
  const dom=new JSDOM(read('prefs.xhtml'),{contentType:'application/xhtml+xml'});
  const values={provider:'openai',sourceLanguage:'en',targetLanguage:'de',enabled:true,highlightSentence:true,alignWords:false,baseURL:'',model:'',apiKey:'',delay:500,fullConcurrency:3,fontSize:17,popupWidth:640,transparency:0};
  const api={config:()=>values,normalizeAppearance:v=>Object.fromEntries(['fontSize','popupWidth','transparency'].map(k=>[k,Number(v[k])])),diagnostic:()=>({cache:{error:''}})};
  const scope={window:dom.window,document:dom.window.document,Zotero:{locale,HoverTranslate:api}};
  vm.runInNewContext(read('prefs.js'),scope);
  dom.window.HTPrefs.init();
  return {dom,get:k=>dom.window.document.getElementById('ht-'+k)};
}
test('the text language follows Zotero: Japanese for ja, English for other locales',()=>{
  for(const locale of ['ja','ja-JP',undefined,''])assert.equal(core.uiLanguage(locale),'ja',String(locale));
  for(const locale of ['en-US','en-GB','de','zh-CN','jam'])assert.equal(core.uiLanguage(locale),'en',locale);
  assert.equal(core.t('authFailed',{},'en'),'API authentication failed. Check the API key and your access to the model.');
  assert.equal(core.t('claudeFailed',{status:500},'en'),'The request to the Claude API failed (HTTP 500). Try again later.');
});
test('every message exists in both languages with the same placeholders',()=>{
  const placeholders=text=>[...text.matchAll(/\{(\w+)\}/g)].map(m=>m[1]).sort();
  assert.deepEqual(Object.keys(core.messages.en).sort(),Object.keys(core.messages.ja).sort());
  for(const key of Object.keys(core.messages.ja)){
    assert.deepEqual(placeholders(core.messages.en[key]),placeholders(core.messages.ja[key]),key);
    assert.doesNotMatch(core.messages.en[key],japanese,key);
  }
  const dom=new JSDOM(read('prefs.xhtml'),{contentType:'application/xhtml+xml'});
  const scope={window:dom.window,document:dom.window.document,Zotero:{locale:'en-US'}};
  vm.runInNewContext(read('prefs.js')+';this.text=HTPrefsText;',scope);
  const text=scope.text;
  assert.deepEqual(Object.keys(text.messages.en).sort(),Object.keys(text.messages.ja).sort());
  for(const key of Object.keys(text.messages.ja)){
    assert.deepEqual(placeholders(text.messages.en[key]),placeholders(text.messages.ja[key]),key);
    assert.doesNotMatch(text.messages.en[key],japanese,key);
  }
  const keys=[...dom.window.document.querySelectorAll('[data-ht],[data-ht-placeholder],[data-ht-aria-label]')]
    .flatMap(n=>['data-ht','data-ht-placeholder','data-ht-aria-label'].map(a=>n.getAttribute(a)).filter(Boolean));
  for(const key of keys)assert.ok(text.pageEn[key],key);
  for(const value of Object.values(text.pageEn))assert.doesNotMatch(value,japanese);
  dom.window.close();
});
test('errors carry codes, so English messages pass through and stop full-text jobs',async()=>{
  const scope=plugin('en-US',async()=>{throw {status:429};},{baseURL:'https://example.com/v1',model:'m'});
  const api=scope.HoverTranslate;
  await assert.rejects(api.translate('Memory.'),e=>e.htCode==='quota'&&/usage limit/.test(e.message));
  const bad=plugin('en-US',async()=>({response:{choices:[{message:{content:'{"segments":[]}'}}]}}),{baseURL:'https://example.com/v1',model:'m',alignWords:true});
  await assert.rejects(bad.HoverTranslate.translate('Memory.'),e=>e.htCode==='segmentsMissing'&&/JSON output/.test(e.message));
  const offline=plugin('en-US',async()=>{throw new Error('network down');},{baseURL:'https://example.com/v1',model:'m'});
  await assert.rejects(offline.HoverTranslate.translate('Memory.'),e=>e.htCode==='requestFailed'&&!e.message.includes('network down'));
  await assert.rejects(plugin('en-US',undefined,{provider:'anthropic',claudeApiKey:''}).HoverTranslate.translate('Memory.'),/To use Claude, enter a Claude API key and model name in the Hover Translate settings\./);
  let calls=0;
  const archive=scope.HTFullText.create({id:'A',serviceKey:'svc',translate:async()=>{calls++;throw scope.HTCore.failure('authFailed');}});
  const page=texts=>({segments:texts.map(text=>({text}))});
  const s=await archive.run({pageCount:1,concurrency:1,getPage:async()=>page(['One.','Two.','Three.','Four.'])});
  assert.equal(calls,1);assert.equal(s.phase,'partial');assert.match(s.message,/authentication failed/);
});
test('the first-run translation language follows the Zotero language when offered',()=>{
  assert.equal(core.defaultTargetLanguage('ja-JP'),'ja');
  assert.equal(core.defaultTargetLanguage('en-US'),'ja');
  assert.equal(core.defaultTargetLanguage('de-DE'),'de');
  assert.equal(core.defaultTargetLanguage('zh-CN'),'zh-CN');
  assert.equal(core.defaultTargetLanguage(undefined),'ja');
  assert.equal(plugin('fr-FR').HoverTranslate.config().targetLanguage,'fr');
  assert.equal(plugin('fr-FR',undefined,{targetLanguage:'ja'}).HoverTranslate.config().targetLanguage,'ja');
});
test('the settings pane is English for an English Zotero and Japanese for a Japanese one',()=>{
  const en=prefsPane('en-US');
  try{
    const doc=en.dom.window.document;
    const visible=[...doc.querySelectorAll('h2,label,option,button,summary,p,span')].map(n=>n.textContent).join('\n');
    assert.doesNotMatch(visible,japanese);
    assert.equal(doc.querySelector('[data-ht="heading.service"]').textContent,'Translation service');
    assert.equal(doc.querySelector('[data-ht="cache.where"] code').textContent,'hover-translate-cache.json');
    assert.equal(en.get('model').placeholder,'Model ID of the service');
    assert.equal(en.get('preview').getAttribute('aria-label'),'Popup preview');
    assert.equal(en.get('fullConcurrencyValue').textContent,'3');
    assert.match(en.get('api-help').textContent,/OpenAI-compatible/);
  }finally{en.dom.window.close();}
  const ja=prefsPane('ja-JP');
  try{
    assert.equal(ja.dom.window.document.querySelector('[data-ht="heading.service"]').textContent,'翻訳サービス');
    assert.equal(ja.get('fullConcurrencyValue').textContent,'3 件');
  }finally{ja.dom.window.close();}
});
test('the reader controls are English for an English Zotero',()=>{
  const dom=new JSDOM('<!doctype html><body><div class="pdfViewer"><div class="page" data-page-number="1"></div></div></body>',{pretendToBeVisual:true});
  const win=dom.window;
  win.PDFViewerApplication={pdfDocument:{numPages:1}};
  const prefs=new Map();
  const scope={URL,Date,Zotero:{locale:'en-US',Prefs:{get:k=>prefs.get(k),set:(k,v)=>prefs.set(k,v)},HTTP:{request:async()=>{}},getMainWindow:()=>win,Reader:{_readers:[{_iframeWindow:win,_window:win}]}},Services:{},Components:{utils:{cloneInto:x=>x}}};
  vm.createContext(scope);
  for(const f of ['core.js','cache.js','fulltext.js','addon.js'])vm.runInContext(read(f),scope);
  scope.HoverTranslate.start();
  try{
    const doc=win.document;
    assert.equal(doc.getElementById('hover-translate-fulltext').textContent,'Translate all');
    assert.equal(doc.getElementById('hover-translate-toggle').textContent,'Translation: On');
    const panel=doc.getElementById('hover-translate-panel');
    assert.doesNotMatch(panel.textContent,japanese);
    assert.ok([...panel.querySelectorAll('option')].some(o=>o.textContent==='Chinese (Simplified)'));
    assert.ok(doc.querySelector('[aria-label="Translation settings"]'));
    assert.equal(doc.querySelector('#hover-translate-popup [aria-label]').getAttribute('aria-label'),'Translate this sentence again');
  }finally{scope.HoverTranslate.stop();win.close();}
});
