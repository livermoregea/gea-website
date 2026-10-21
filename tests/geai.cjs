const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
const vm=require('node:vm');
function load(file,env={}){
 const exports={};
 const next={NextResponse:{json:(body,init={})=>({body,status:init.status||200,headers:init.headers})}};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,
 {exports,require:name=>{if(name==='next/server')return next;if(name==='node:crypto')return require(name);throw new Error(`Retired summary route imported ${name}`);},process:{env},Buffer});
 return exports;
}
test('old summary endpoint returns Gone without loading a provider, database, or cached student data',async()=>{
 const route=load('app/api/operations/geai/route.ts',{GROQ_API_KEY:'configured',SUPABASE_SERVICE_ROLE_KEY:'configured'});
 const response=await route.POST();
 assert.equal(response.status,410);assert.equal(response.body.disabled,true);
 assert.equal(response.headers['Cache-Control'],'no-store');
});
test('old authorized summary cron cannot claim jobs or consume AI tokens',async()=>{
 const route=load('app/api/operations/geai/refresh/route.ts',{CRON_SECRET:'secret',GROQ_API_KEY:'configured',SUPABASE_SERVICE_ROLE_KEY:'configured'});
 const request={headers:new Headers({authorization:'Bearer secret'})};
 for(const method of ['GET','POST']){
  const response=await route[method](request);
  assert.equal(response.status,410);assert.equal(response.body.attempted,0);assert.equal(response.body.updated,0);
 }
});
test('retired background endpoint keeps the cron authorization boundary',async()=>{
 const route=load('app/api/operations/geai/refresh/route.ts',{CRON_SECRET:'secret'});
 for(const authorization of ['','Bearer wrong','Bearer sëcret'])assert.equal((await route.GET({headers:new Headers({authorization})})).status,401);
 assert.equal((await load('app/api/operations/geai/refresh/route.ts').GET({headers:new Headers()})).status,401);
});
test('neither production nor local development schedules AI summaries',()=>{
 assert.ok(!JSON.parse(fs.readFileSync('vercel.json','utf8')).crons.some(job=>job.path.includes('/geai')));
 const dev=fs.readFileSync('scripts/dev.mjs','utf8');
 assert.ok(!dev.includes('/api/operations/geai'));
 assert.ok(!dev.includes('GROQ_API_KEY'));
 assert.ok(!dev.includes('setInterval'));
});
