const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {JSDOM}=require(process.env.HT_JSDOM || 'jsdom');
test('appearance preview, independent save and defaults work without API configuration',()=>{
  const dom=new JSDOM(fs.readFileSync(path.join(__dirname,'..','prefs.xhtml'),'utf8'),{contentType:'application/xhtml+xml'});
  const values={enabled:true,baseURL:'',model:'',apiKey:'',delay:500,fullConcurrency:3,fontSize:17,popupWidth:640,transparency:0};
  let saved=0;
  const api={
    config:()=>values,
    normalizeAppearance:v=>Object.fromEntries(['fontSize','popupWidth','transparency'].map(k=>[k,Number(v[k])])),
    saveAppearance(v){saved++;const a=this.normalizeAppearance(v);Object.assign(values,a);return a;},
    diagnostic:()=>({cache:{error:''}})
  };
  const scope={window:dom.window,document:dom.window.document,Zotero:{HoverTranslate:api}};
  try{
    vm.runInNewContext(fs.readFileSync(path.join(__dirname,'..','prefs.js'),'utf8'),scope);
    dom.window.HTPrefs.init();
    const get=k=>dom.window.document.getElementById('ht-'+k);
    assert.equal(get('fullConcurrencyValue').textContent,'3 件');
    get('fullConcurrency').value='5';get('fullConcurrency').dispatchEvent(new dom.window.Event('input'));
    assert.equal(get('fullConcurrencyValue').textContent,'5 件');
    for(const key of ['fontSize','popupWidth','transparency']) assert.equal(get(key).type,'range');
    assert.equal(get('fontSizeValue').textContent,'17 px');
    assert.equal(get('popupWidthValue').textContent,'640 px');
    get('fontSize').value='24';get('popupWidth').value='900';get('transparency').value='50';
    get('transparency').dispatchEvent(new dom.window.Event('input'));
    assert.equal(get('preview').style.fontSize,'24px');assert.equal(get('transparencyValue').textContent,'50%');
    assert.equal(get('fontSizeValue').textContent,'24 px');assert.equal(get('popupWidthValue').textContent,'900 px');
    assert.equal(get('preview').style.backgroundColor,'rgba(255, 255, 255, 0.5)');assert.equal(saved,0);
    get('transparency').value='80';get('transparency').dispatchEvent(new dom.window.Event('change'));
    assert.equal(get('preview').style.backgroundColor,'rgba(255, 255, 255, 0.2)');
    get('transparency').value='0';get('transparency').dispatchEvent(new dom.window.Event('input'));
    assert.equal(get('preview').style.backgroundColor,'rgb(255, 255, 255)');
    get('saveAppearance').click();assert.equal(saved,1);assert.equal(values.popupWidth,900);
    get('defaultAppearance').click();assert.equal(saved,2);assert.equal(values.fontSize,17);assert.equal(values.popupWidth,640);assert.equal(values.transparency,0);
  }finally{dom.window.close();}
});
function servicePane(saveError = null, requestError = null) {
  const dom=new JSDOM(fs.readFileSync(path.join(__dirname,'..','prefs.xhtml'),'utf8'),{contentType:'application/xhtml+xml'});
  let calls=0,finish;
  const values={enabled:true,baseURL:'https://example.com/v1',model:'test',apiKey:'',delay:500,fullConcurrency:3,fontSize:17,popupWidth:640,transparency:0};
  const api={config:()=>values,normalizeAppearance:v=>v,diagnostic:()=>({connectedPDFViews:1,cache:{error:''}}),
    save(){if(saveError)throw new Error(saveError);},
    async translate(){calls++;await new Promise(r=>finish=r);if(requestError)throw new Error(requestError);return {text:'睡眠は記憶を改善します。',segments:[{text:'睡眠',source:[4]}]};},flushCache:async()=>{}};
  const scope={window:dom.window,document:dom.window.document,Zotero:{HoverTranslate:api}};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'..','prefs.js'),'utf8'),scope);
  const get=k=>dom.window.document.getElementById('ht-'+k);
  // Simulate Zotero fragment load, rather than manually calling init.
  get('preferences').dispatchEvent(new dom.window.Event('load'));
  return {dom,get,api,calls:()=>calls,finish:()=>finish()};
}
test('test translation shows loading and success directly under service button',async()=>{
  const f=servicePane();
  try{
    assert.equal(typeof f.get('test').onclick,'function');
    f.get('test').click();assert.equal(f.get('test').disabled,true);
    assert.equal(f.get('test').textContent,'テスト中…');
    assert.match(f.get('test-status').textContent,/設定を保存して/);
    f.get('test').click();assert.equal(f.calls(),1);
    f.dom.window.HTPrefs.init();assert.equal(f.get('test').disabled,true);
    f.finish();await new Promise(r=>setImmediate(r));
    assert.match(f.get('test-status').textContent,/接続成功：睡眠は記憶を改善します/);
    assert.equal(f.get('test').disabled,false);
    assert.equal(f.get('test-status').closest('groupbox'),f.get('test').closest('groupbox'));
  }finally{f.dom.window.close();}
});
test('optional dead diagnostics cannot change a successful translation into a test failure',async()=>{
  const f=servicePane();let flushes=0;
  try{
    f.api.diagnostic=()=>{throw new Error("can't access dead object");};
    f.api.flushCache=async()=>{flushes++;throw new Error("can't access dead object");};
    const request=f.get('test').onclick();
    f.finish();await request;
    assert.match(f.get('test-status').textContent,/接続成功：睡眠は記憶を改善します/);
    assert.doesNotMatch(f.get('test-status').textContent,/接続テスト失敗|dead object/);
    assert.equal(f.get('test').disabled,false);assert.equal(flushes,0);
  }finally{f.dom.window.close();}
});
test('closing preferences during a test does not access destroyed controls on completion',async()=>{
  const f=servicePane();let writes=0;
  try{
    const request=f.get('test').onclick();
    f.dom.window.dispatchEvent(new f.dom.window.Event('unload'));
    for(const key of ['test','test-status']){
      Object.defineProperty(f.get(key),'textContent',{set(){writes++;throw new Error("can't access dead object");}});
    }
    f.finish();await request;assert.equal(writes,0);
  }finally{f.dom.window.close();}
});
test('configuration errors appear in service section without sending API request',()=>{
  const f=servicePane('モデル名を入力してください。');
  try{f.get('test').click();assert.match(f.get('test-status').textContent,/接続テスト失敗：モデル名を入力してください/);assert.equal(f.calls(),0);assert.equal(f.get('test').disabled,false);}finally{f.dom.window.close();}
});
test('API error restores test button and displays failure in service section',async()=>{
  const f=servicePane(null,'API認証に失敗しました');
  try{f.get('test').click();f.finish();await new Promise(r=>setImmediate(r));assert.match(f.get('test-status').textContent,/API認証に失敗しました/);assert.equal(f.get('test').disabled,false);assert.equal(f.get('test').textContent,'保存して接続テスト');}finally{f.dom.window.close();}
});
test('action feedback appears beside buttons, expires after 2 seconds and restarts on repeat',async()=>{
  const f=servicePane();let now=0,id=0;const timers=new Map();
  f.dom.window.setTimeout=(fn,delay)=>{timers.set(++id,{fn,due:now+delay});return id;};
  f.dom.window.clearTimeout=k=>timers.delete(k);
  const advance=ms=>{now+=ms;for(const [k,t] of [...timers])if(t.due<=now){timers.delete(k);t.fn();}};
  f.api.saveAppearance=v=>v;let finishClear;
  f.api.reset=()=>new Promise(r=>finishClear=r);
  try{
    assert.equal(f.get('status'),null);
    f.get('save').click();assert.match(f.get('save-status').textContent,/保存しました/);
    assert.equal(f.get('save-status').previousElementSibling,f.get('save'));
    advance(1500);f.get('save').click();advance(500);assert.match(f.get('save-status').textContent,/保存しました/);
    f.get('saveAppearance').click();assert.equal(f.get('appearance-status').previousElementSibling,f.get('saveAppearance'));
    advance(1499);assert.match(f.get('save-status').textContent,/保存しました/);
    advance(1);assert.equal(f.get('save-status').textContent,'');assert.match(f.get('appearance-status').textContent,/保存しました/);
    advance(500);assert.equal(f.get('appearance-status').textContent,'');
    f.get('clear').click();advance(3000);assert.equal(f.get('clear-status').textContent,'削除中…');
    finishClear();await new Promise(r=>setImmediate(r));
    assert.equal(f.get('clear-status').previousElementSibling,f.get('clear'));assert.match(f.get('clear-status').textContent,/削除しました/);
    advance(1999);assert.match(f.get('clear-status').textContent,/削除しました/);advance(1);assert.equal(f.get('clear-status').textContent,'');
    // Failures stay until the same button reports again, so the reason can be read.
    f.api.save=()=>{throw new Error('保存失敗');};f.get('save').click();assert.equal(f.get('save-status').textContent,'保存失敗');advance(60000);assert.equal(f.get('save-status').textContent,'保存失敗');
    f.api.save=()=>{};f.get('save').click();assert.match(f.get('save-status').textContent,/保存しました/);advance(2000);assert.equal(f.get('save-status').textContent,'');
  }finally{f.dom.window.close();}
});
test('test feedback expires after completion and a new request cancels previous dismissal',async()=>{
  const f=servicePane();let now=0,id=0;const timers=new Map();
  f.dom.window.setTimeout=(fn,delay)=>{timers.set(++id,{fn,due:now+delay});return id;};
  f.dom.window.clearTimeout=k=>timers.delete(k);
  const advance=ms=>{now+=ms;for(const [k,t] of [...timers])if(t.due<=now){timers.delete(k);t.fn();}};
  try{
    assert.match(f.get('clear').parentElement.previousElementSibling.textContent,/今回の起動中/);
    f.get('test').click();advance(3000);assert.match(f.get('test-status').textContent,/設定を保存して/);
    f.finish();await new Promise(r=>setImmediate(r));
    advance(1999);assert.match(f.get('test-status').textContent,/接続成功/);
    advance(1);assert.equal(f.get('test-status').textContent,'');
    f.get('test').click();f.finish();await new Promise(r=>setImmediate(r));
    advance(1000);f.get('test').click();advance(2000);assert.match(f.get('test-status').textContent,/設定を保存して/);
    f.finish();await new Promise(r=>setImmediate(r));advance(2000);assert.equal(f.get('test-status').textContent,'');
    f.api.save=()=>{throw new Error('設定エラー');};f.get('test').click();
    // A failed test stays readable until the next test replaces it.
    assert.match(f.get('test-status').textContent,/設定エラー/);advance(60000);assert.match(f.get('test-status').textContent,/接続テスト失敗：設定エラー/);
    f.api.save=()=>{};f.get('test').click();assert.match(f.get('test-status').textContent,/設定を保存して/);
    f.finish();await new Promise(r=>setImmediate(r));assert.match(f.get('test-status').textContent,/接続成功/);advance(2000);assert.equal(f.get('test-status').textContent,'');
  }finally{f.dom.window.close();}
});
