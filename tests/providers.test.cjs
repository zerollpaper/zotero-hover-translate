const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const core=require('../core.js');
const base={sourceLanguage:'en',targetLanguage:'ja',alignWords:false,baseURL:'',model:'',apiKey:'llm-secret',claudeModel:'claude-haiku-5-5',claudeApiKey:'claude-secret',geminiModel:'gemini-3.5-flash-lite',geminiApiKey:'gemini-secret',deeplApiKey:'deepl-secret:fx'};
const request=(c,text='Memory.')=>{const r=core.serviceRequest({...base,...c},text,core.words(text));return {...r,json:r.body?JSON.parse(r.body):null};};
const secrets=['llm-secret','claude-secret','gemini-secret','deepl-secret'];
const only=(r,allowed)=>{const all=JSON.stringify([r.url,r.headers,r.body]);for(const s of secrets)if(s!==allowed)assert.ok(!all.includes(s),s+' leaked');};
test('Gemini uses generateContent with its own key, a response schema and the least thinking per model',()=>{
  const r=request({provider:'gemini'});
  assert.equal(r.url,'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent');
  assert.equal(r.headers['x-goog-api-key'],'gemini-secret');only(r,'gemini-secret');
  assert.match(r.json.systemInstruction.parts[0].text,/Japanese/);
  assert.equal(r.json.contents[0].role,'user');
  assert.equal(r.json.generationConfig.responseMimeType,'application/json');
  assert.deepEqual(r.json.generationConfig.responseSchema.required,['translation']);
  assert.equal(r.json.generationConfig.thinkingConfig,undefined);
  assert.deepEqual(request({provider:'gemini',geminiModel:'gemini-3.6-flash'}).json.generationConfig.thinkingConfig,{thinkingLevel:'low'});
  assert.deepEqual(request({provider:'gemini',geminiModel:'gemini-4-carbon'}).json.generationConfig.thinkingConfig,{thinkingLevel:'low'});
  assert.deepEqual(request({provider:'gemini',geminiModel:'gemini-2.5-flash'}).json.generationConfig.thinkingConfig,{thinkingBudget:0});
  assert.equal(request({provider:'gemini',geminiModel:'gemini-2.5-pro'}).json.generationConfig.thinkingConfig,undefined);
  assert.match(request({provider:'gemini',geminiModel:'models/gemini-3.6-flash'}).url,/models\/gemini-3\.6-flash:generateContent$/);
  assert.deepEqual(request({provider:'gemini',alignWords:true}).json.generationConfig.responseSchema.required,['segments']);
});
test('Gemini replies skip thought parts and report blocks and cut-offs',()=>{
  const c={...base,provider:'gemini'};
  assert.equal(core.serviceText(c,{candidates:[{content:{parts:[{text:'thinking…',thought:true},{text:'{"translation":"記憶。"}'}]},finishReason:'STOP'}]}),'{"translation":"記憶。"}');
  assert.throws(()=>core.serviceText(c,{promptFeedback:{blockReason:'SAFETY'}}),/断りました/);
  assert.throws(()=>core.serviceText(c,{candidates:[{finishReason:'SAFETY'}]}),/断りました/);
  assert.throws(()=>core.serviceText(c,{candidates:[{content:{parts:[{text:'{"tra'}]},finishReason:'MAX_TOKENS'}]}),/途切れました/);
});
test('DeepL picks the Free or Pro host from the key and maps language codes',()=>{
  const free=request({provider:'deepl'});
  assert.equal(free.url,'https://api-free.deepl.com/v2/translate');
  assert.equal(free.headers.Authorization,'DeepL-Auth-Key deepl-secret:fx');only(free,'deepl-secret');
  assert.deepEqual(free.json,{text:['Memory.'],target_lang:'JA',source_lang:'EN'});
  assert.equal(request({provider:'deepl',deeplApiKey:'pro-key'}).url,'https://api.deepl.com/v2/translate');
  assert.equal(request({provider:'deepl',sourceLanguage:'auto'}).json.source_lang,undefined);
  assert.equal(request({provider:'deepl',sourceLanguage:'ja',targetLanguage:'en'}).json.target_lang,'EN-US');
  assert.equal(request({provider:'deepl',targetLanguage:'zh-CN'}).json.target_lang,'ZH-HANS');
  assert.equal(core.serviceText({provider:'deepl'},{translations:[{detected_source_language:'EN',text:'記憶。'}]}),'{"translation":"記憶。"}');
  assert.throws(()=>core.serviceText({provider:'deepl'},{translations:[]}),/DeepLから訳文/);
});
test('LLM API services get the JSON output setting each one documents',()=>{
  const llm=(baseURL,model='m',alignWords=false)=>request({provider:'openai',baseURL,model,alignWords}).json;
  const openai=llm('https://api.openai.com/v1','gpt-5-mini');
  assert.equal(openai.response_format.type,'json_schema');assert.equal(openai.response_format.json_schema.strict,true);
  assert.deepEqual(openai.response_format.json_schema.schema.required,['translation']);
  assert.equal(openai.reasoning_effort,'low');
  assert.equal(llm('https://api.openai.com/v1','gpt-4o').reasoning_effort,undefined);
  assert.equal(llm('http://127.0.0.1:11434/v1').response_format.type,'json_schema');
  assert.deepEqual(llm('http://127.0.0.1:11434/v1','m',true).response_format.json_schema.schema.required,['segments']);
  assert.equal(llm('https://api.deepseek.com').response_format.type,'json_object');
  assert.equal(llm('https://openrouter.ai/api/v1').response_format,undefined);
  assert.equal(llm('https://example.com/v1').response_format,undefined);
  const r=request({provider:'openai',baseURL:'https://api.openai.com/v1',model:'m'});
  assert.equal(r.headers.Authorization,'Bearer llm-secret');only(r,'llm-secret');
});
test('Gemini and DeepL caches survive a restart',async()=>{
  const scope={URL};vm.createContext(scope);
  for(const f of ['core.js','cache.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'..',f),'utf8'),scope);
  let disk=null;const storage={read:async()=>disk,write:async v=>{disk=JSON.parse(JSON.stringify(v));}};
  const a=scope.HTCache.create({storage});await a.ready;
  const keys=[scope.HTCore.geminiEndpoint,scope.HTCore.deeplEndpoint('k:fx'),scope.HTCore.deeplEndpoint('k')].map(e=>a.key(e,'m|source=en','Memory.','ja',false));
  const result=scope.HTCore.parseTranslation('{"translation":"記憶。"}',1);
  for(const k of keys)a.put(k,result);await a.flush();
  const b=scope.HTCache.create({storage});await b.ready;
  for(const k of keys)assert.equal(b.get(k).text,'記憶。');
});
function plugin(prefsValues,request){
  const prefs=new Map(Object.entries({...base,...prefsValues}).map(([k,v])=>['extensions.hoverTranslate.'+k,v]));
  const scope={URL,Zotero:{Prefs:{get:k=>prefs.get(k),set:(k,v)=>prefs.set(k,v)},HTTP:{request},Reader:{_readers:[]},Profile:{dir:'/profile'}},Services:{},Components:{}};
  vm.createContext(scope);
  for(const f of ['core.js','cache.js','fulltext.js','addon.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'..',f),'utf8'),scope);
  return scope.HoverTranslate;
}
test('the plugin translates through Gemini and DeepL and explains their errors',async()=>{
  const gemini=plugin({provider:'gemini'},async(m,u,o)=>{assert.equal(o.headers['x-goog-api-key'],'gemini-secret');return {response:{candidates:[{content:{parts:[{text:'{"translation":"記憶。"}'}]},finishReason:'STOP'}]}};});
  assert.equal((await gemini.translate('Memory.')).text,'記憶。');
  const deepl=plugin({provider:'deepl'},async()=>({response:{translations:[{text:'睡眠。'}]}}));
  assert.equal((await deepl.translate('Sleep.')).text,'睡眠。');
  const quota=plugin({provider:'deepl'},async()=>{throw {status:456,message:'deepl-secret'};});
  await assert.rejects(quota.translate('One.'),e=>/文字数の上限/.test(e.message)&&!e.message.includes('deepl-secret'));
  const missing=plugin({provider:'gemini',geminiApiKey:''},async()=>{throw new Error('no request expected');});
  await assert.rejects(missing.translate('Two.'),/GeminiのAPIキー/);
  const notFound=plugin({provider:'gemini'},async()=>{throw {status:404};});
  await assert.rejects(notFound.translate('Three.'),/モデルが見つかりません/);
});
test('word alignment stays off for DeepL',()=>{
  const api=plugin({provider:'deepl',alignWords:true},async()=>({}));
  assert.equal(api.config().alignWords,false);
  assert.equal(plugin({provider:'gemini',alignWords:true},async()=>({})).config().alignWords,true);
});
test('PLaMo Translate gets the source text with its own settings line and replies in plain text',()=>{
  const model='hf.co/pfnet/plamo-3-translate-2b-GGUF:Q4_K_M';
  const r=request({provider:'openai',baseURL:'http://127.0.0.1:11434/v1',model},'Sleep improves memory.');
  assert.deepEqual(r.json.messages,[{role:'system',content:'[plamo-translate]\ntarget_lang=ja\nsource_lang=en'},{role:'user',content:'Sleep improves memory.'}]);
  assert.equal(r.json.response_format,undefined);assert.equal(r.json.temperature,0);
  assert.deepEqual(r.json.stop,['<|plamo:tag|>','<|plamo:bos|>']);
  assert.equal(request({provider:'openai',baseURL:'http://127.0.0.1:11434/v1',model,sourceLanguage:'auto',targetLanguage:'zh-CN'}).json.messages[0].content,'[plamo-translate]\ntarget_lang=zh-hans');
  const c={...base,provider:'openai',model};
  assert.equal(core.parseTranslation(core.serviceText(c,{choices:[{message:{content:' 睡眠は記憶を改善する。\n'}}]}),3).text,'睡眠は記憶を改善する。');
  assert.equal(plugin({provider:'openai',baseURL:'http://127.0.0.1:11434/v1',model,alignWords:true},async()=>({})).config().alignWords,false);
});
