const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {JSDOM}=require(process.env.HT_JSDOM || 'jsdom');
const core=require('../core.js');
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
function pane(values){
  const dom=new JSDOM(read('prefs.xhtml'),{contentType:'application/xhtml+xml'});
  const config={provider:'openai',sourceLanguage:'en',targetLanguage:'ja',alignWords:false,baseURL:'',model:'',apiKey:'',claudeModel:'claude-haiku-5-5',claudeApiKey:'',delay:500,fullConcurrency:3,fontSize:17,popupWidth:640,transparency:0,...values};
  vm.runInNewContext(read('prefs.js'),{window:dom.window,document:dom.window.document,Zotero:{HoverTranslate:{config:()=>config,normalizeAppearance:v=>v,diagnostic:()=>({cache:{error:''}})}}});
  dom.window.HTPrefs.init();
  const get=k=>dom.window.document.getElementById('ht-'+k);
  const change=(k,v,type='change')=>{get(k).value=v;get(k).dispatchEvent(new dom.window.Event(type));};
  return {dom,get,change};
}
test('every preset is a valid API URL ending in a chat/completions endpoint',()=>{
  const {dom,get}=pane({});
  try{
    const options=[...get('endpointPreset').options].filter(o=>o.value).map(o=>[o.value,o.textContent]);
    // The settings list and the request-side table must name the same services.
    assert.deepEqual(options,core.llmPresets.map(p=>[p.url,p.label]));
    for(const [url] of options) assert.match(core.endpoint(url),/\/chat\/completions$/);
  }finally{dom.window.close();}
});
test('choosing a service fills the URL and clears the model and key of the previous one',()=>{
  const {dom,get,change}=pane({baseURL:'https://api.openai.com/v1',model:'old-model',apiKey:'openai-secret'});
  try{
    assert.equal(get('endpointPreset').value,'https://api.openai.com/v1');
    change('endpointPreset','https://api.x.ai/v1');
    assert.equal(get('baseURL').value,'https://api.x.ai/v1');
    assert.equal(get('model').value,'');assert.equal(get('apiKey').value,'');
    assert.match(get('test-status').textContent,/空にしました/);
    change('baseURL','https://example.com/v1','input');
    assert.equal(get('endpointPreset').value,'');
  }finally{dom.window.close();}
});
test('a saved URL with a trailing slash or full endpoint still shows its service',()=>{
  const {dom,get}=pane({baseURL:'http://127.0.0.1:11434/v1/chat/completions'});
  try{assert.equal(get('endpointPreset').value,'http://127.0.0.1:11434/v1');}finally{dom.window.close();}
});
test('the service list appears only for the LLM API',()=>{
  const {dom,get,change}=pane({});
  try{
    assert.notEqual(get('endpointPreset').style.display,'none');
    for(const provider of ['anthropic','gemini','deepl']){change('provider',provider);assert.equal(get('endpointPreset').style.display,'none');}
    change('provider','google');assert.equal(get('endpointPreset').style.display,'none');
  }finally{dom.window.close();}
});
