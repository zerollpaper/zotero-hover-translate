const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {JSDOM}=require(process.env.HT_JSDOM || 'jsdom');
const core=require('../core.js');
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
const wait=()=>new Promise(r=>setImmediate(r));
test('each service lists its models at its own address with its own key',()=>{
  const llm=core.modelsRequest({provider:'openai',baseURL:'http://127.0.0.1:11434/v1',apiKey:''});
  assert.equal(llm.url,'http://127.0.0.1:11434/v1/models');assert.equal(llm.headers.Authorization,undefined);
  assert.equal(core.modelsRequest({provider:'openai',baseURL:'https://api.openai.com/v1',apiKey:'k'}).headers.Authorization,'Bearer k');
  const claude=core.modelsRequest({provider:'anthropic',claudeApiKey:'c'});
  assert.equal(claude.url,'https://api.anthropic.com/v1/models?limit=100');assert.equal(claude.headers['x-api-key'],'c');
  const gemini=core.modelsRequest({provider:'gemini',geminiApiKey:'g'});
  assert.match(gemini.url,/^https:\/\/generativelanguage\.googleapis\.com\/v1beta\/models\?/);assert.equal(gemini.headers['x-goog-api-key'],'g');
  assert.equal(core.modelsRequest({provider:'deepl'}),null);
  assert.deepEqual(core.modelIds({provider:'openai'},{data:[{id:'a'},{id:'a'},{id:'b'},{}]}),['a','b']);
  assert.deepEqual(core.modelIds({provider:'gemini'},{models:[{name:'models/gemini-3.6-flash',supportedGenerationMethods:['generateContent']},{name:'models/embed',supportedGenerationMethods:['embedContent']}]}),['gemini-3.6-flash']);
});
function plugin(prefsValues,request){
  const prefs=new Map(Object.entries(prefsValues).map(([k,v])=>['extensions.hoverTranslate.'+k,v]));
  const scope={URL,Zotero:{Prefs:{get:k=>prefs.get(k),set:(k,v)=>prefs.set(k,v)},HTTP:{request},Reader:{_readers:[]},Profile:{dir:'/profile'}},Services:{},Components:{}};
  vm.createContext(scope);
  for(const f of ['core.js','cache.js','fulltext.js','addon.js'])vm.runInContext(read(f),scope);
  return scope.HoverTranslate;
}
test('listModels uses unsaved values and explains what is missing',async()=>{
  let seen;
  const api=plugin({provider:'openai',baseURL:''},async(method,url)=>{seen={method,url};return {response:{data:[{id:'hf.co/pfnet/plamo'}]}};});
  assert.deepEqual([...await api.listModels({baseURL:'http://127.0.0.1:11434/v1'})],['hf.co/pfnet/plamo']);
  assert.deepEqual(seen,{method:'GET',url:'http://127.0.0.1:11434/v1/models'});
  await assert.rejects(api.listModels({}),/API URLを入力/);
  await assert.rejects(api.listModels({provider:'anthropic',claudeApiKey:''}),/ClaudeのAPIキー/);
  const down=plugin({provider:'openai',baseURL:'http://127.0.0.1:11434/v1'},async()=>{throw new Error('connection refused');});
  await assert.rejects(down.listModels(),/起動しているか/);
  const denied=plugin({provider:'gemini',geminiApiKey:'g'},async()=>{throw {status:403,message:'secret body'};});
  await assert.rejects(denied.listModels(),e=>/APIキーを確認/.test(e.message)&&!e.message.includes('secret'));
});
function pane(values,listModels){
  const dom=new JSDOM(read('prefs.xhtml'),{contentType:'application/xhtml+xml'});
  const config={provider:'openai',sourceLanguage:'en',targetLanguage:'ja',alignWords:false,baseURL:'',model:'',apiKey:'',claudeModel:'claude-haiku-5-5',claudeApiKey:'',geminiModel:'gemini-3.5-flash-lite',geminiApiKey:'',deeplApiKey:'',delay:500,fullConcurrency:3,fontSize:17,popupWidth:640,transparency:0,...values};
  const calls=[];
  const api={config:()=>config,normalizeAppearance:v=>v,diagnostic:()=>({cache:{error:''}}),listModels:async v=>{calls.push(v);return listModels(v);}};
  vm.runInNewContext(read('prefs.js'),{window:dom.window,document:dom.window.document,Zotero:{HoverTranslate:api}});
  dom.window.HTPrefs.init();
  const get=k=>dom.window.document.getElementById('ht-'+k);
  const change=(k,v)=>{get(k).value=v;get(k).dispatchEvent(new dom.window.Event('change'));};
  return {dom,get,change,calls};
}
test('choosing Ollama lists its models at once and fills in the only one',async()=>{
  const f=pane({},()=>['hf.co/pfnet/plamo-3-translate-2b-GGUF:Q4_K_M']);
  try{
    assert.equal(f.get('modelChoice').style.display,'none');
    f.change('endpointPreset','http://127.0.0.1:11434/v1');await wait();
    assert.equal(f.calls.length,1);assert.equal(f.calls[0].baseURL,'http://127.0.0.1:11434/v1');
    assert.equal(f.get('model').value,'hf.co/pfnet/plamo-3-translate-2b-GGUF:Q4_K_M');
    assert.match(f.get('models-status').textContent,/1件/);
    // PLaMo is translation-only, so word alignment cannot be chosen.
    assert.equal(f.get('alignWords').disabled,true);
  }finally{f.dom.window.close();}
});
test('several models are offered as choices and a choice fills the model name',async()=>{
  const f=pane({provider:'anthropic',claudeApiKey:'c',claudeModel:''},()=>['claude-haiku-5-5','claude-sonnet-5-5']);
  try{
    assert.equal(f.calls.length,0,'cloud services are listed only on request');
    f.get('loadModels').click();await wait();
    assert.equal(f.calls[0].claudeApiKey,'c');
    assert.notEqual(f.get('modelChoice').style.display,'none');
    assert.deepEqual([...f.get('modelChoice').options].map(o=>o.value),['','claude-haiku-5-5','claude-sonnet-5-5']);
    assert.equal(f.get('claudeModel').value,'');
    f.change('modelChoice','claude-sonnet-5-5');
    assert.equal(f.get('claudeModel').value,'claude-sonnet-5-5');
    f.change('provider','google');
    assert.equal(f.get('modelChoice').style.display,'none');assert.equal(f.get('loadModels').style.display,'none');
  }finally{f.dom.window.close();}
});
test('opening the settings with a local server lists its models; failures are explained',async()=>{
  const f=pane({baseURL:'http://127.0.0.1:1234/v1',model:'kept'},()=>{throw new Error('モデル一覧を取得できません。Ollama や LM Studio が起動しているか確認してください。');});
  try{
    await wait();
    assert.equal(f.calls.length,1);assert.match(f.get('models-status').textContent,/起動しているか/);
    assert.equal(f.get('model').value,'kept');
  }finally{f.dom.window.close();}
});
