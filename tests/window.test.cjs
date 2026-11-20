const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {JSDOM}=require(process.env.HT_JSDOM || 'jsdom');
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
// Zotero のメインウィンドウの代わり。setInterval で登録された処理を手で呼べるようにする。
function mainWindow(){
  return {ticks:new Map(),next:1,closed:false,
    setInterval(fn){const id=this.next++;this.ticks.set(id,fn);return id;},
    clearInterval(id){this.ticks.delete(id);},
    tick(){for(const fn of [...this.ticks.values()])fn();}};
}
function readerWindow(){
  const dom=new JSDOM('<!doctype html><body><div class="toolbar"><div class="end"></div></div><div class="pdfViewer"><div class="page" data-page-number="1"></div></div></body>',{pretendToBeVisual:true});
  dom.window.PDFViewerApplication={pdfDocument:{numPages:1}};
  return dom.window;
}
function plugin(firstMain){
  const prefs=new Map();
  const zotero={Prefs:{get:k=>prefs.get(k),set:(k,v)=>prefs.set(k,v)},HTTP:{request:async()=>{}},main:firstMain,getMainWindow(){return this.main;},Reader:{_readers:[]}};
  const scope={URL,Date,Zotero:zotero,Services:{},Components:{utils:{cloneInto:x=>x}}};
  vm.createContext(scope);
  for(const f of ['core.js','cache.js','fulltext.js','addon.js'])vm.runInContext(read(f),scope);
  return scope;
}
// 2026-11-20：Mac で Zotero のウィンドウを閉じて開き直すと、古いウィンドウの setInterval ごと
// 閲覧画面を探す処理が止まり、そのあと開いた PDF に設定ボタンが付かなかった。
test('reopening the Zotero main window keeps adding the controls to new readers',async()=>{
  const first=mainWindow();
  const scope=plugin(first);
  const api=scope.HoverTranslate;
  api.start();
  assert.equal(first.ticks.size,1,'the scan runs on the first main window');
  // ウィンドウを閉じる（Zotero は閉じる前に onMainWindowUnload を呼ぶ）。
  api.mainWindowUnloaded(first);
  first.closed=true;scope.Zotero.main=null;
  assert.equal(first.ticks.size,0,'the closed window keeps no timer');
  // Dock から開き直す。
  const second=mainWindow();scope.Zotero.main=second;
  api.mainWindowLoaded(second);
  assert.equal(second.ticks.size,1,'the scan moves to the new main window');
  const reader=readerWindow();
  try{
    scope.Zotero.Reader._readers.push({_iframeWindow:reader,_window:reader});
    second.tick();
    assert.ok(reader.document.querySelector('.toolbar .end #hover-translate-controls'),'the settings button is in the reader toolbar');
  }finally{await api.stop();reader.close();}
  assert.equal(second.ticks.size,0,'stop clears the timer');
});
test('opening a second main window does not start a second scan',async()=>{
  const first=mainWindow();
  const api=plugin(first).HoverTranslate;
  api.start();
  const second=mainWindow();
  api.mainWindowLoaded(second);
  assert.equal(first.ticks.size+second.ticks.size,1);
  // 動いているほうのウィンドウを閉じても、残ったウィンドウで続ける。
  const [running,other]=first.ticks.size?[first,second]:[second,first];
  api.mainWindowUnloaded(running);
  assert.equal(running.ticks.size,0);
  assert.equal(other.ticks.size,1);
  await api.stop();
});
test('a main window opened before start or after stop starts nothing',async()=>{
  const first=mainWindow();
  const api=plugin(first).HoverTranslate;
  api.mainWindowLoaded(first);
  assert.equal(first.ticks.size,0);
  api.start();await api.stop();
  const second=mainWindow();
  api.mainWindowLoaded(second);
  assert.equal(second.ticks.size,0);
});
test('bootstrap passes the main window hooks to the plugin',()=>{
  const calls=[];
  const scope={calls};
  vm.createContext(scope);
  vm.runInContext(read('bootstrap.js'),scope);
  const win={};
  scope.onMainWindowLoad({window:win});// プラグインの読み込み前でも落ちない
  vm.runInContext('htScope={HoverTranslate:{mainWindowLoaded:w=>calls.push(["load",w]),mainWindowUnloaded:w=>calls.push(["unload",w])}};',scope);
  scope.onMainWindowLoad({window:win});
  scope.onMainWindowUnload({window:win});
  assert.equal(calls.length,2);
  assert.equal(calls[0][0],'load');assert.equal(calls[0][1],win);
  assert.equal(calls[1][0],'unload');assert.equal(calls[1][1],win);
});
