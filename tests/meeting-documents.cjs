const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');const ts=require('typescript');
const api={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/meeting-documents.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{exports:api,URL});
test('Accepts regular, account-specific, and published Google Docs links',()=>{
 for(const link of ['https://docs.google.com/document/d/doc_ID-123/edit?usp=sharing','https://docs.google.com/document/u/1/d/doc123/edit','https://docs.google.com/document/d/e/published123/pub','https://docs.google.com/document/d/doc123'])assert.equal(api.googleDocLink(link),link);
 assert.equal(api.googleDocLink('  https://docs.google.com/document/d/doc123  '),'https://docs.google.com/document/d/doc123');
});
test('Rejects spoofed hosts, credentials, unsafe schemes, other document types, and invalid paths',()=>{
 for(const link of ['javascript:alert(1)','http://docs.google.com/document/d/id','https://docs.google.com.evil.test/document/d/id','https://docs.google.com@evil.test/document/d/id','https://evil.test@docs.google.com/document/d/id','https://docs.google.com:444/document/d/id','https://docs.google.com/spreadsheets/d/id','https://drive.google.com/file/d/id','https://docs.google.com/document/','https://docs.google.com/document/d/id/edit/extra','https:\\docs.google.com/document/d/id']){
   assert.equal(api.googleDocLink(link),null,link);
 }
 assert.equal(api.googleDocLink('https://docs.google.com/document/d/doc\nid'),null);
 assert.equal(api.googleDocLink('https://docs.google.com/document/d/'+'a'.repeat(2048)),null);
 assert.equal(api.googleDocLink(''),null);assert.equal(api.googleDocLink(null),null);
});
