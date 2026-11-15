const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const load=(scope,files)=>{vm.createContext(scope);for(const file of files)vm.runInContext(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),scope);return scope;};
function setup(request,prefsValues={}){
  const values={provider:'anthropic',claudeModel:'claude-haiku-5-5',claudeApiKey:'claude-secret',baseURL:'https://example.com/v1',model:'local',apiKey:'llm-secret',...prefsValues};
  const prefs=new Map(Object.entries(values).map(([k,v])=>['extensions.hoverTranslate.'+k,v]));
  const scope=load({URL,Zotero:{Prefs:{get:k=>prefs.get(k),set:(k,v)=>prefs.set(k,v)},HTTP:{request},Reader:{_readers:[]},Profile:{dir:'/profile'}},Services:{},Components:{}},['core.js','cache.js','fulltext.js','addon.js']);
  return scope.HoverTranslate;
}
const claudeResponse=(text,extra={})=>({response:{content:[{type:'thinking',thinking:''},{type:'text',text}],stop_reason:'end_turn',...extra}});
test('Claude uses the Messages API with its own key, low effort and a JSON schema',async()=>{
  let seen;
  const api=setup(async(method,url,options)=>{seen={method,url,options,body:JSON.parse(options.body)};return claudeResponse('{"translation":"記憶。"}');});
  assert.equal((await api.translate('Memory.')).text,'記憶。');
  assert.equal(seen.method,'POST');assert.equal(seen.url,'https://api.anthropic.com/v1/messages');
  assert.equal(seen.options.headers['x-api-key'],'claude-secret');
  assert.ok(seen.options.headers['anthropic-version']);
  assert.equal(seen.options.headers.Authorization,undefined);
  assert.ok(!JSON.stringify(seen.options).includes('llm-secret'));
  assert.equal(seen.body.model,'claude-haiku-5-5');assert.ok(seen.body.max_tokens>0);
  assert.match(seen.body.system,/Japanese/);
  assert.deepEqual(seen.body.messages.map(m=>m.role),['user']);
  assert.equal(seen.body.output_config.effort,'low');
  assert.equal(seen.body.output_config.format.type,'json_schema');
  assert.deepEqual(seen.body.output_config.format.schema.required,['translation']);
});
test('word alignment with Claude asks for the segments schema',async()=>{
  let body;
  const api=setup(async(m,u,o)=>{body=JSON.parse(o.body);return claudeResponse('{"segments":[{"text":"記憶","source":[0]},{"text":"。","source":[]}]}');},{alignWords:true});
  const result=await api.translate('Memory.');
  assert.deepEqual(body.output_config.format.schema.required,['segments']);
  assert.equal(JSON.stringify(result.segments[0].source),'[0]');
});
test('the Claude key is never sent to the LLM API',async()=>{
  let options;
  const api=setup(async(m,u,o)=>{options=o;return {response:{choices:[{message:{content:'{"translation":"記憶。"}'}}]}};},{provider:'openai'});
  await api.translate('Memory.');
  assert.equal(options.headers.Authorization,'Bearer llm-secret');
  assert.ok(!JSON.stringify(options).includes('claude-secret'));
});
test('Claude needs an API key before any request is sent',async()=>{
  let calls=0;const api=setup(async()=>{calls++;},{claudeApiKey:''});
  await assert.rejects(api.translate('Memory.'),/ClaudeのAPIキー/);assert.equal(calls,0);
});
test('Claude refusals, cut-off replies and HTTP errors become clear messages without server details',async()=>{
  const replies=[claudeResponse('',{stop_reason:'refusal'}),claudeResponse('{"transl',{stop_reason:'max_tokens'})];
  let n=0;const api=setup(async()=>{const r=replies[n++];if(r)return r;throw {status:n===3?400:529,message:'claude-secret body'};});
  await assert.rejects(api.translate('One.'),/翻訳を断りました/);
  await assert.rejects(api.translate('Two.'),/途切れました/);
  await assert.rejects(api.translate('Three.'),e=>/クレジット残高/.test(e.message)&&!e.message.includes('claude-secret'));
  await assert.rejects(api.translate('Four.'),/混み合っています/);
});
test('Claude and Google translations stay in the disk cache after a restart',async()=>{
  const scope=load({URL},['core.js','cache.js']);
  let disk=null;const storage={read:async()=>disk,write:async v=>{disk=JSON.parse(JSON.stringify(v));}};
  const a=scope.HTCache.create({storage});await a.ready;
  const claude=a.key(scope.HTCore.anthropicEndpoint,'claude-haiku-5-5|source=en','Memory.','ja',false);
  const google=a.key(scope.HTCore.googleEndpoint,'google-translate-gtx|source=en','Memory.','ja',false);
  const result=scope.HTCore.parseTranslation('{"translation":"記憶。"}',1);
  a.put(claude,result);a.put(google,result);await a.flush();
  const b=scope.HTCache.create({storage});await b.ready;
  assert.equal(b.get(claude).text,'記憶。');assert.equal(b.get(google).text,'記憶。');
});
