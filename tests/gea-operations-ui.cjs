const {test}=require('node:test');const assert=require('node:assert/strict');const vm=require('node:vm');const fs=require('node:fs');const path=require('node:path');const ts=require('typescript');const React=require('react');const {renderToStaticMarkup}=require('react-dom/server');
const cache={};
function load(file){if(cache[file])return cache[file];const exports={};cache[file]=exports;const resolver=name=>{if(name.endsWith('.module.css'))return {__esModule:true,default:new Proxy({},{get:(_,key)=>String(key)})};if(name==='next/navigation')return {useRouter:()=>({refresh(){}})};if(name==='next/link')return {__esModule:true,default:({children,...props})=>React.createElement('a',props,children)};if(name==='@/lib/supabase/client')return {createClient:()=>({rpc:async()=>({error:null,data:[]})})};if(name.startsWith('@/')||name.startsWith('.')){let target=name.startsWith('@/')?name.slice(2):path.join(path.dirname(file),name);target+=fs.existsSync(target+'.tsx')?'.tsx':'.ts';return load(target);}return require(name);};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true,target:ts.ScriptTarget.ES2020}}).outputText,{exports,require:resolver,Intl,Date,TextEncoder,URL,Set});return exports;}
const Hub=load('components/operations/OperationsHub.tsx').default;
function fixture(reviewer=false){return {userId:'me',membership:{isOfficer:true,isAdmin:reviewer,isTeacher:false},reviewer,canMeetings:false,taskHref:'/officerboard',tasks:[],events:[{id:'meeting',title:'Weekly meeting',kind:'meeting',starts_at:'2026-10-16T15:00:00Z',ends_at:'2026-10-16T16:00:00Z',location:'Lab',cancelled:false}],attendance:[],logs:[],people:[{id:'me',name:'My name',position:'Treasurer'},{id:'other',name:'Other officer',position:'President'}],notes:[{event_id:'meeting',minutes:'Discussed outreach',decisions:'Order posters',agenda_doc_url:'https://docs.google.com/document/d/agenda123/edit',notes_doc_url:'https://docs.google.com/document/d/notes123/edit',version:1,updated_at:'2026-10-16T16:00:00Z'}],agenda:[{id:'agenda',event_id:'meeting',title:'Outreach plan',details:'Make posters',task_id:null}],plans:[],checklist:[],blockers:[],readKeys:[],digestEnabled:false,digests:[],attention:[],calendar:[]};}
function render(data,view,event='meeting'){return renderToStaticMarkup(React.createElement(Hub,{data,initialView:view,initialEvent:event}));}
test('Every operations view renders empty and populated states without loading a browser or contacting production',()=>{for(const view of ['today','calendar','meetings','events','blockers','inbox','reports']){const html=render(fixture(),view);assert.ok(html.includes('Officer workspace'));assert.ok(!html.includes('undefined'));}});
test('Secretary gets meeting notes and roll call controls without becoming a reviewer',()=>{const ordinary=render(fixture(),'meetings');assert.ok(ordinary.includes('Discussed outreach'));assert.ok(!ordinary.includes('Save document links'));assert.ok(!ordinary.includes('Save attendance'));const data=fixture();data.canMeetings=true;const secretary=render(data,'meetings');assert.ok(secretary.includes('Save document links'));assert.ok(secretary.includes('Save attendance'));assert.ok(secretary.includes('Agenda Google Doc'));assert.ok(secretary.includes('Meeting notes Google Doc'));assert.ok(!secretary.includes('<textarea'));assert.ok(!secretary.includes('Create or edit events'));});
test('Reports keep ordinary officers scoped to themselves and omit personal evaluations and accountability fields',()=>{const html=render(fixture(),'reports');assert.ok(html.includes('My name'));assert.ok(!html.includes('Other officer'));assert.ok(!html.includes('All officers'));const reviewer=render(fixture(true),'reports');assert.ok(reviewer.includes('All officers'));assert.ok(reviewer.includes('Other officer'));});


test('One workspace embeds officer records and has no separate Inbox or Need help destinations',()=>{
 const data=fixture();
 const tools=React.createElement('div',null,'Embedded officer records');
 const overview=renderToStaticMarkup(React.createElement(Hub,{data,officerTools:tools,initialView:'overview'}));
 assert.ok(overview.includes('Needs your attention'));
 assert.ok(overview.includes('My work'));
 assert.ok(!overview.includes('>Inbox<'));
 assert.ok(!overview.includes('>Need help<'));
 assert.ok(!overview.includes('Embedded officer records'));
 const tasks=renderToStaticMarkup(React.createElement(Hub,{data,officerTools:tools,initialView:'tasks'}));
 assert.ok(tasks.includes('Embedded officer records'));
 assert.ok(tasks.includes('Blocked / need help'));
 assert.ok(!tasks.includes('Needs your attention'));
});


test('Meeting documents are openable by officers and editable only by the secretary/reviewers',()=>{
 const ordinary=render(fixture(),'meetings');
 assert.ok(ordinary.includes('href="https://docs.google.com/document/d/agenda123/edit"'));
 assert.ok(ordinary.includes('href="https://docs.google.com/document/d/notes123/edit"'));
 assert.ok(ordinary.includes('target="_blank"'));
 assert.ok(!ordinary.includes('name="agenda_doc_url"'));
 const data=fixture();data.canMeetings=true;
 const secretary=render(data,'meetings');
 assert.ok(secretary.includes('name="agenda_doc_url"'));
 assert.ok(secretary.includes('name="notes_doc_url"'));
 assert.ok(secretary.includes('Save document links'));
 assert.ok(secretary.includes('Previously recorded agenda'));
 assert.ok(!secretary.includes('<textarea'));
});


test('Embedded workspace has no duplicate header and keeps scheduling beside meeting controls',()=>{
 const embedded=renderToStaticMarkup(React.createElement(Hub,{data:fixture(true),embedded:true,initialView:'overview',officerTools:React.createElement('div',null,'Records')}));
 assert.ok(!embedded.includes('<h1'));
 assert.ok(!embedded.includes('Officer workspace</h2>'));
 assert.ok(embedded.includes('Officers'));
 const reviewer=render(fixture(true),'meetings');assert.ok(reviewer.includes('Schedule a meeting'));assert.ok(reviewer.includes('Edit schedule'));
 assert.ok(!reviewer.includes('Manage event dates in'));
 const officer=render(fixture(),'meetings');assert.ok(!officer.includes('Schedule a meeting'));
});

test('Overview shows the progress dashboard while Officers keeps the detailed tools',()=>{
 const props={data:fixture(true),officerOverview:React.createElement('section',null,'Score and attendance dashboard'),officerTools:React.createElement('section',null,'Detailed officer editor')};
 const overview=renderToStaticMarkup(React.createElement(Hub,{...props,initialView:'overview'}));
 assert.ok(overview.includes('Score and attendance dashboard'));
 assert.ok(overview.includes('Needs your attention'));
 assert.ok(!overview.includes('Detailed officer editor'));
 const details=renderToStaticMarkup(React.createElement(Hub,{...props,initialView:'tasks'}));
 assert.ok(details.includes('Detailed officer editor'));
 assert.ok(!details.includes('Score and attendance dashboard'));
});
