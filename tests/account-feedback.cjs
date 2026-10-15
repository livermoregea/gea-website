const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function nodes(tree, predicate) {
  const matches=[];
  function visit(node){if(Array.isArray(node)){node.forEach(visit);return;}if(!node?.props)return;if(typeof node.type==='function')node=node.type(node.props);if(!node?.props)return;if(predicate(node))matches.push(node);visit(node.props.children);}
  visit(tree);return matches;
}
function harness(file, props, options={}) {
 const values=[];let index=0,id=0;
 const source=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 const exports={};const modules={
  react:{useState(initial){const at=index++;if(!(at in values))values[at]=initial;return[values[at],next=>{values[at]=typeof next==='function'?next(values[at]):next;}];},useId:()=>`field-${id++}`},
  'react/jsx-runtime':require('react/jsx-runtime'),
  '@/lib/use-unsaved-changes':{useUnsavedChanges(){}},
  '@/components/ActionError':{default:({message})=>require('react/jsx-runtime').jsx('p',{role:'alert',children:message})},
  'next/navigation':{useRouter:()=>({push(){},refresh(){}})},
  '@/lib/supabase/client':{createClient:()=>options.supabase??({auth:{signInWithPassword:async()=>{throw new Error('Offline');},getUser:async()=>({data:{user:{id:'test-user'}}})},from:()=>({insert:async()=>{throw new Error('Offline');}})})},
  '@/lib/supabase/config':{hasSupabaseConfig:()=>true},
  '@/lib/student-email':{isLvjusdStudentEmail:value=>/^[^\s@]+@lvjusd\.org$/i.test(value)},
 };
 vm.runInNewContext(source,{exports,require:name=>{assert.ok(name in modules,`Unexpected module ${name}`);return modules[name];},fetch:async()=>{throw new Error('Offline');}});
 return()=>{index=0;id=0;return exports.default(props);};
}
for(const [file,props] of [
 ['components/StudentAuthForm.tsx',{redirectTo:'/dashboard',initialMode:'signin'}],
 ['components/StudentAuthForm.tsx',{redirectTo:'/dashboard',initialMode:'signup'}],
 ['components/TeacherAuthForm.tsx',{redirectTo:'/teacher',mode:'signin'}],
 ['components/TeacherAuthForm.tsx',{redirectTo:'/teacher',mode:'signup'}],
 ['components/TeacherInviteSignupForm.tsx',{token:'test',teacherName:'Teacher',teacherEmail:'teacher@lvjusd.org'}],
 ['components/LoginForm.tsx',{redirectTo:'/admin-portal-x7k9'}],
 ['components/ProfileEditor.tsx',{kind:'student',profile:{id:'profile',full_name:'Student',school_email:'student@lvjusd.org',auth_email:'student@lvjusd.org',display_username:'Student',graduating_class_year:2028}}],
]) test(`${file} ${props.initialMode??props.mode??''}: connection failure is explained and retry stays available`,async()=>{
 const render=harness(file,props);let tree=render();
 for(const input of nodes(tree,n=>n.type==='input'&&n.props.onChange)){
  const text=input.props.type==='email'?'student@lvjusd.org':input.props.inputMode==='numeric'||input.props.type==='number'?'2028':'TestStudent123';
  input.props.onChange({target:{value:text}});
 }
 tree=render();await nodes(tree,n=>n.type==='form')[0].props.onSubmit({preventDefault(){}});
 tree=render();const alerts=nodes(tree,n=>n.props.role==='alert');
 assert.ok(alerts.some(n=>String(n.props.children).includes('Check your connection')),'An actionable error is displayed');
 assert.equal(nodes(tree,n=>n.type==='button'&&n.props.type==='submit')[0].props.disabled,false,'Submission is available for retry');
});

test('A successful profile request becomes pending immediately and cannot be submitted twice',async()=>{
 let writes=0;
 const render=harness('components/ProfileEditor.tsx',{kind:'student',profile:{id:'profile',full_name:'Student',school_email:'student@lvjusd.org',auth_email:'student@lvjusd.org',display_username:'Student',graduating_class_year:2028}},{supabase:{auth:{getUser:async()=>({data:{user:{id:'test-user'}}})},from:()=>({insert:async()=>{writes++;return{error:null};}})}});
 await nodes(render(),n=>n.type==='form')[0].props.onSubmit({preventDefault(){}});
 const tree=render();
 assert.equal(writes,1);
 assert.equal(nodes(tree,n=>n.type==='form').length,0,'Pending request replaces the editable form');
 assert.ok(nodes(tree,n=>n.type==='h2').some(n=>String(n.props.children).includes('waiting')));
});
for(const file of ['components/StudentAuthForm.tsx','components/TeacherAuthForm.tsx'])test(file+': account mode exposes its selected state',()=>{
 const render=harness(file,{redirectTo:'/account',initialMode:'signin',mode:'signin'});
 let tree=render();
 const group=nodes(tree,n=>n.props.role==='group')[0];
 assert.equal(group.props['aria-label'],'Account access');
 const buttons=nodes(group,n=>n.type==='button');
 assert.equal(buttons[0].props['aria-pressed'],true);
 assert.equal(buttons[1].props['aria-pressed'],false);
 buttons[1].props.onClick();
 tree=render();
 const next=nodes(nodes(tree,n=>n.props.role==='group')[0],n=>n.type==='button');
 assert.equal(next[0].props['aria-pressed'],false);
 assert.equal(next[1].props['aria-pressed'],true);
});

for(const file of ['components/StudentAuthForm.tsx','components/TeacherAuthForm.tsx'])test(file+': sign-in preserves the password exactly as entered',async()=>{
 let received;
 const render=harness(file,{redirectTo:'/account',initialMode:'signin',mode:'signin'},{supabase:{auth:{signInWithPassword:async input=>{received=input;return {error:{message:'Test rejection'}};}}}});
 for(const input of nodes(render(),n=>n.type==='input'&&n.props.onChange))input.props.onChange({target:{value:input.props.type==='password'?'  exact password  ':'student@lvjusd.org'}});
 await nodes(render(),n=>n.type==='form')[0].props.onSubmit({preventDefault(){}});
 assert.equal(received.password,'  exact password  ');
});
