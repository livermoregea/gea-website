const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');const ts=require('typescript');
function harness(dirty,confirmResult=false){
 const registered=new Map();let cleanup;let prompts=0;
 const source=ts.transpileModule(fs.readFileSync('lib/use-unsaved-changes.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
 class Element{constructor(link){this.link=link;}closest(){return this.link;}}
 const eventHost={addEventListener:(name,fn)=>registered.set(name,fn),removeEventListener:(name)=>registered.delete(name)};
 const exports={};vm.runInNewContext(source,{exports,URL,Element,document:eventHost,window:{...eventHost,location:{href:'https://gea.example/admin-portal-x7k9/officers'},confirm:()=>{prompts++;return confirmResult;}},require:()=>({useEffect:fn=>{cleanup=fn();}})});
 exports.useUnsavedChanges(dirty);
 return {registered,cleanup,get prompts(){return prompts;},Element,leaves:exports.leavesCurrentPage};
}
test('Unsaved attendance can cancel a workspace link and sign-out, with listeners cleaned up',()=>{
 const h=harness(true);let prevented=0,stopped=0;
 h.registered.get('click')({button:0,target:new h.Element({href:'https://gea.example/account',target:'',hasAttribute:()=>false}),preventDefault:()=>prevented++,stopPropagation:()=>stopped++});
 assert.equal(prevented,1);assert.equal(stopped,1);
 h.registered.get('gea:before-navigation')({preventDefault:()=>prevented++});assert.equal(prevented,2);
 const unload={preventDefault:()=>prevented++};h.registered.get('beforeunload')(unload);assert.equal(unload.returnValue,'');
 h.cleanup();assert.equal(h.registered.size,0);
});
test('Clean forms, same-page anchors, and new-tab links do not prompt',()=>{
 assert.equal(harness(false).registered.size,0);
 const h=harness(true);
 for(const link of [{href:'https://gea.example/admin-portal-x7k9/officers#tasks',target:''},{href:'https://gea.example/account',target:'_blank'}])
 h.registered.get('click')({button:0,target:new h.Element({...link,hasAttribute:()=>false}),preventDefault:()=>assert.fail('Should not intercept'),stopPropagation(){}});
 assert.equal(h.prompts,0);
 assert.equal(h.leaves('/account','https://gea.example/admin-portal-x7k9/officers'),true);
});
test('Confirming discard permits navigation',()=>{
 const h=harness(true,true);h.registered.get('click')({button:0,target:new h.Element({href:'https://gea.example/account',target:'',hasAttribute:()=>false}),preventDefault:()=>assert.fail('Confirmed navigation must proceed'),stopPropagation(){}});assert.equal(h.prompts,1);
});
