const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const ts=require('typescript');
const jsx=require('react/jsx-runtime');
function load(file,deps={}){
 const exports={};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports,require:name=>{assert.ok(name in deps,name);return deps[name];},Date,Intl,FormData:class{constructor(form){this.fields=form.fields;}get(key){return this.fields[key]??null;}}});
 return exports;
}
const volunteering=load('lib/public-volunteering.ts');
const tracking=load('lib/officer-tracking.ts');
const future={id:'public-event',title:'Community cleanup',description:'Everyone with a GEA One account is welcome',location:'Park',starts_at:new Date(Date.now()+86400000).toISOString(),ends_at:new Date(Date.now()+90000000).toISOString(),status:'published',signup_open:true,capacity:10,version:1};
const signup={id:'signup',event_id:future.id,user_id:'member',name:'Member Name',email:'member@lvjusd.org',status:'registered',attendance:'unmarked',verified_minutes:0,attendance_note:'',version:1};
function nodes(tree,predicate){const found=[];function visit(node){if(Array.isArray(node)){node.forEach(visit);return;}if(!node?.props)return;if(predicate(node))found.push(node);visit(node.props.children);}visit(tree);return found;}
function text(tree){if(Array.isArray(tree))return tree.map(text).join('');if(tree?.props)return text(tree.props.children);return typeof tree==='string'||typeof tree==='number'?String(tree):'';}
function harness(file,props,options={}){
 const state=[],effects=[],calls=[];let index=0,refreshes=0;
 const client={from(table){calls.push({table});const query={select(){return query;},eq(){return query;},order(){return query;},range:async()=>({data:table==='public_volunteer_events'?(options.events??[future]):(options.signups??[signup]),error:null})};return query;},rpc:async(name,args)=>{calls.push({name,args});return {data:future.id,error:options.error??null};}};
 const deps={'react/jsx-runtime':jsx,react:{useState(initial){const at=index++;if(!(at in state))state[at]=initial;return [state[at],next=>{state[at]=typeof next==='function'?next(state[at]):next;}];},useTransition:()=>[false,fn=>fn()],useCallback:fn=>fn,useEffect:fn=>effects.push(fn)},'next/navigation':{useRouter:()=>({refresh(){refreshes++;}})},'next/link':{default:'a'},'@/lib/supabase/client':{createClient:()=>client},'@/lib/officer-tracking':tracking,'@/lib/public-volunteering':volunteering,'./volunteering.module.css':{default:{}},'@/components/volunteering/volunteering.module.css':{default:{}},'@/components/officerboard/Modal':{default:'modal'}};
 const Component=load(file,deps).default;
 return {calls,props,render(){index=0;return Component(props);},async mount(){this.render();effects[0]?.();await new Promise(setImmediate);},get refreshes(){return refreshes;}};
}
const publicHarness=(props={},options={})=>harness('components/volunteering/VolunteerEvents.tsx',{events:[future],signups:[],signedIn:true,initialName:'Member Name',...props},options);
test('Public signup needs only GEA One authentication, not officer membership',async()=>{
 const h=publicHarness();let tree=h.render();
 assert.match(text(tree),/Public volunteer event/);
 await nodes(tree,n=>n.type==='button'&&text(n)==='Sign up to volunteer')[0].props.onClick();
 const call=h.calls.find(call=>call.name);assert.equal(call.name,'set_public_volunteer_signup');
 assert.equal(call.args.p_event_id,future.id);assert.equal(call.args.p_registered,true);assert.equal(call.args.p_name,'Member Name');
 assert.equal(Object.hasOwn(call.args,'user_id'),false);assert.equal(h.refreshes,1);
});
test('Anonymous visitors get a GEA One sign-in link and cannot submit volunteer signups',()=>{
 const tree=publicHarness({signedIn:false}).render();
 assert.equal(nodes(tree,n=>n.type==='button').length,0);
 assert.equal(nodes(tree,n=>n.type==='a')[0].props.href,'/login?next=%2Fvolunteer');
});
test('Failed signup keeps the entered name and explains a full event',async()=>{
 const h=publicHarness({}, {error:{code:'P0001',message:'This public event is full.'}});
 let tree=h.render();nodes(tree,n=>n.type==='input')[0].props.onChange({target:{value:'Entered Name'}});
 tree=h.render();await nodes(tree,n=>n.type==='button')[0].props.onClick();tree=h.render();
 assert.equal(nodes(tree,n=>n.type==='input')[0].props.value,'Entered Name');
 assert.match(text(nodes(tree,n=>n.props.role==='alert')),/event is full/);assert.equal(h.refreshes,0);
});
test('Withdrawal updates only the public signup and closed events have no signup control',async()=>{
 const h=publicHarness({signups:[signup]});const tree=h.render();
 await nodes(tree,n=>n.type==='button'&&text(n)==='Withdraw signup')[0].props.onClick();
 assert.equal(h.calls[0].name,'set_public_volunteer_signup');assert.equal(h.calls[0].args.p_registered,false);
 for(const change of [{status:'cancelled'},{signup_open:false},{starts_at:new Date(Date.now()-1000).toISOString()}]){
  const closed=publicHarness({events:[{...future,...change}]}).render();
  assert.equal(nodes(closed,n=>n.type==='button').length,0);
 }
});
test('Cancelled and historical registrations retain attendance and verified service',()=>{
 const tree=publicHarness({events:[{...future,status:'cancelled',starts_at:'2026-01-01T10:00:00Z',ends_at:'2026-01-01T12:00:00Z'}],signups:[{...signup,attendance:'present',verified_minutes:120}]}).render();
 assert.match(text(tree),/Event cancelled/);assert.match(text(tree),/Present.*2h 0m/);
 assert.equal(nodes(tree,n=>n.type==='button').length,0);
});
test('Public admin roster reads only public volunteer tables and labels the separate officer workspace',async()=>{
 const h=harness('components/admin/AdminVolunteers.tsx',{});await h.mount();
 const tree=h.render();assert.match(text(tree),/Public volunteering/);assert.match(text(tree),/Member Name/);
 assert.match(text(tree),/Choose leadership-only or public AND leadership/);
 assert.deepEqual(h.calls.map(call=>call.table),['public_volunteer_events','public_volunteer_signups']);
 const buttons=nodes(tree,n=>n.type==='button');assert.ok(buttons.some(button=>text(button)==='Add public & leadership event'));
 assert.equal(buttons.find(button=>text(button).startsWith('Record attendance')).props.disabled,true);
});
test('Large public rosters are paginated without silently dropping older signups',async()=>{
 const ranges=[];const values=await volunteering.volunteerRows(async(from,to)=>{ranges.push([from,to]);return {data:from===0?Array.from({length:100},(_,id)=>({id})):[{id:100}],error:null};});
 assert.equal(values.length,101);assert.deepEqual(ranges,[[0,99],[100,199]]);
});

test('Staff save public attendance through its own RPC, preserving the signup version',async()=>{
 const past={...future,starts_at:'2026-01-01T10:00:00Z',ends_at:'2026-01-01T12:00:00Z'};
 const h=harness('components/admin/AdminVolunteers.tsx',{}, {events:[past]});await h.mount();
 let tree=h.render();nodes(tree,n=>n.type==='button'&&text(n).startsWith('Record attendance'))[0].props.onClick();
 tree=h.render();await nodes(tree,n=>n.type==='form')[0].props.onSubmit({preventDefault(){},currentTarget:{fields:{attendance:'present',minutes:'60',note:'Verified community service'}}});
 const call=h.calls.find(call=>call.name);assert.equal(call.name,'record_public_volunteer_attendance');
 assert.equal(call.args.p_signup_id,signup.id);assert.equal(call.args.p_version,signup.version);assert.equal(call.args.p_minutes,60);
 assert.ok(h.calls.every(call=>!call.table||call.table.startsWith('public_volunteer_')));
});
test('Volunteer sign-in returns to volunteering and accepts no external redirect',async()=>{
 const Login=load('app/login/page.tsx',{
  'react/jsx-runtime':jsx,'next/link':{default:'a'},'@/components/DiscordConnect':{default:()=>null},'@/components/GEAOneBadge':{default:'badge'},
  'next/navigation':{redirect:destination=>{throw new Error('redirect:'+destination);}},
  '@/components/StudentAuthForm':{default:'student-auth'},'@/lib/supabase/config':{hasSupabaseConfig:()=>true},
  '@/lib/supabase/server':{createClient:async()=>({auth:{getUser:async()=>({data:{user:null}})}})},
  '@/lib/account-landing':{accountLanding:async()=>'/account'},
 }).default;
 const volunteer=await Login({searchParams:Promise.resolve({next:'/volunteer'})});
 assert.equal(nodes(volunteer,n=>n.type==='student-auth')[0].props.redirectTo,'/volunteer');
 const external=await Login({searchParams:Promise.resolve({next:'https://outside.example'})});
 assert.equal(nodes(external,n=>n.type==='student-auth')[0].props.redirectTo,'/account/redirect');
});

test('The shared audience checkbox defaults to leadership only and restores saved public settings when editing',()=>{
 let at=0;const state=[];
 const Audience=load('components/officerboard/VolunteerAudienceFields.tsx',{
  'react/jsx-runtime':jsx,react:{useState(initial){const index=at++;if(!(index in state))state[index]=initial;return[state[index],next=>state[index]=next];}},
 }).default;
 const render=props=>{at=0;return Audience(props);};
 let tree=render({});let checkbox=nodes(tree,n=>n.type==='input'&&n.props.name==='public_volunteering')[0];
 assert.equal(checkbox.props.checked,false);assert.match(text(tree),/Leadership only/);
 assert.equal(nodes(tree,n=>n.type==='fieldset')[0].props.disabled,true);
 checkbox.props.onChange({target:{checked:true}});tree=render({});assert.match(text(tree),/public volunteers AND leadership/);
 assert.equal(nodes(tree,n=>n.type==='fieldset')[0].props.disabled,false);
 assert.match(text(tree),/Officer notes stay private/);
 state.length=0;tree=render({event:{...future,public_volunteering:true,public_description:'Public details',public_capacity:12}});
 assert.equal(nodes(tree,n=>n.props.name==='public_volunteering')[0].props.checked,true);
 assert.equal(nodes(tree,n=>n.props.name==='public_description')[0].props.defaultValue,'Public details');
 assert.equal(nodes(tree,n=>n.props.name==='public_capacity')[0].props.defaultValue,12);
});
