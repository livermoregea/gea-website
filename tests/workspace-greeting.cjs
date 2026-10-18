const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const ts=require('typescript');
const React=require('react');
const {renderToStaticMarkup}=require('react-dom/server');
function load(file,deps={}) {
 const exports={};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,
 {exports,require:name=>deps[name]??require(name),Intl,Date});
 return exports;
}
const helpers=load('lib/workspace-greeting.ts');
test('Greetings change at noon and 5 p.m. Pacific and follow daylight saving time',()=>{
 for(const [iso,expected] of [
  ['2026-10-18T07:00:00Z','Good morning'],
  ['2026-10-18T18:59:00Z','Good morning'],
  ['2026-10-18T19:00:00Z','Good afternoon'],
  ['2026-10-18T23:59:00Z','Good afternoon'],
  ['2026-10-19T00:00:00Z','Good evening'],
  ['2026-12-18T19:59:00Z','Good morning'],
  ['2026-12-18T20:00:00Z','Good afternoon'],
  ['2026-12-19T01:00:00Z','Good evening'],
 ])assert.equal(helpers.workspaceGreeting(new Date(iso)),expected,iso);
});
test('Greeting names stay plain text and missing names do not render placeholders',()=>{
 const Greeting=load('components/GreetingClock.tsx',{'@/lib/workspace-greeting':helpers,
 './workspace-greeting.module.css':{__esModule:true,default:{greeting:'greeting',name:'gold-name'}}}).default;
 const html=renderToStaticMarkup(React.createElement(Greeting,{name:'Jaden <script>',initialGreeting:'Good afternoon'}));
 assert.ok(html.includes('Good afternoon'));
 assert.ok(html.includes('class="gold-name">Jaden &lt;script&gt;</span>'));
 const anonymous=renderToStaticMarkup(React.createElement(Greeting,{name:null,initialGreeting:'Good evening'}));
 assert.ok(!anonymous.includes('null'));
 assert.ok(!anonymous.includes('gold-name'));
});
