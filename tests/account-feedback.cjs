const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function nodes(tree, predicate) {
  const matches=[];
  function visit(node){if(Array.isArray(node)){node.forEach(visit);return;}if(!node?.props)return;if(predicate(node))matches.push(node);visit(node.props.children);}
  visit(tree);return matches;
}
function harness(file, props) {
 const values=[];let index=0,id=0;
 const source=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 const exports={};const modules={
  react:{useState(initial){const at=index++;if(!(at in values))values[at]=initial;return[values[at],next=>{values[at]=typeof next==='function'?next(values[at]):next;}];},useId:()=>`field-${id++}`},
  'react/jsx-runtime':require('react/jsx-runtime'),
  'next/navigation':{useRouter:()=>({push(){},refresh(){}})},
  '@/lib/supabase/client':{createClient:()=>({auth:{signInWithPassword:async()=>{throw new Error('Offline');}}})},
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
