const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');const ts=require('typescript');const jsx=require('react/jsx-runtime');
function nodes(tree,predicate){const result=[];function walk(n){if(Array.isArray(n)){n.forEach(walk);return;}if(!n?.props)return;if(predicate(n))result.push(n);walk(n.props.children);}walk(tree);return result;}
function harness(mode='submit',initial=null){
 let cursor=0,effectCursor=0,result={data:initial,error:null};const state=[],effects=[],pending=[],busy=[],completed=[];
 const source={id:'task-1',title:'Workshop',description:'Deliver a workshop',assigned_to:'student',status:mode==='review'?'submitted':'in_progress',submission_description:'Delivered workshop',final_product_url:null};
 const props={officerTask:source,actorId:mode==='review'?'reviewer':'student',mode,manualFallback:jsx.jsx('form',{'aria-label':'Manual form'}),onComplete:message=>completed.push(message),onBusyChange:value=>busy.push(value)};
 const deps={react:{useState(initial){const i=cursor++;if(!(i in state))state[i]=initial;return[state[i],next=>{state[i]=typeof next==='function'?next(state[i]):next;}];},useRef(){const i=cursor++;if(!(i in state))state[i]={current:false};return state[i];},useEffect(fn,dependencies){const i=effectCursor++,previous=effects[i];if(!previous||dependencies.some((value,index)=>value!==previous.dependencies[index])){pending.push(()=>{previous?.cleanup?.();const cleanup=fn();effects[i]={dependencies,cleanup};});}}},'react/jsx-runtime':jsx,'@/lib/use-form-draft':{useFormDraft:()=>({ref:{current:null},persist(){},clear(){},saved:false,unavailable:false})},'@/lib/supabase/client':{createClient:()=>({from:()=>({select:()=>({eq(){return this;},then(resolve){return Promise.resolve({...result,data:result.data ? (Array.isArray(result.data)?result.data:[result.data]) : []}).then(resolve);}})})})},'@/lib/peet-ai':{peetCategories:['Outreach'],pillars:['efficiency','effectiveness','time'],peetScorePercent:()=>75},'@/lib/peet':{productLink:value=>value},'./peet.module.css':{default:new Proxy({},{get:(_,key)=>String(key)})}};
 const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('components/officerboard/OfficerTaskPeet.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports,require:name=>{assert.ok(name in deps,name);return deps[name];}});
 return{props,busy,completed,setResult(value){result=value;},render(){cursor=0;effectCursor=0;return exports.default(props);},async settle(){while(pending.length)pending.shift()();await new Promise(setImmediate);},type(name){return exports[name];}};
}
test('Embedded submitter flow loads the task, stays open for questions, and completes only after answers',async()=>{
 const h=harness();let tree=h.render();assert.equal(nodes(tree,n=>n.props.role==='status').length,1);await h.settle();tree=h.render();
 const form=nodes(tree,n=>n.type===h.type('PeetSubmissionForm'))[0];assert.equal(form.props.sourceTask.id,'task-1');
 const draft={id:'ai-1',task_id:'task-1',student_id:'student',status:'clarification',version:1};form.props.onSaved(draft);tree=h.render();
 let card=nodes(tree,n=>n.type===h.type('PeetTaskCard'))[0];assert.equal(card.props.task.id,'ai-1');assert.equal(h.completed.length,0);
 card.props.onSaved({...draft,status:'pending',version:2});assert.equal(h.completed.length,1);assert.match(h.completed[0],/submitted for review/);
 assert.deepEqual(h.busy,[true,false]);
});
test('Reopening a task restores persisted clarification without another submission form',async()=>{
 const saved={id:'ai-1',task_id:'task-1',student_id:'student',status:'clarification',version:1};const h=harness('submit',saved);h.render();await h.settle();const tree=h.render();
 assert.equal(nodes(tree,n=>n.type===h.type('PeetSubmissionForm')).length,0);assert.equal(nodes(tree,n=>n.type===h.type('PeetTaskCard'))[0].props.task.id,'ai-1');
});
test('Reviewer stays in task evaluation for questions and scores; only approval completes the dialog',async()=>{
 const saved={id:'ai-1',task_id:'task-1',student_id:'student',status:'pending',version:2};const h=harness('review',saved);h.render();await h.settle();let tree=h.render();
 let card=nodes(tree,n=>n.type===h.type('PeetTaskCard'))[0];assert.equal(card.props.canReview,true);assert.equal(card.props.actorId,'reviewer');
 card.props.onSaved({...saved,version:3,reviewer_assessment:{reviewerQuestions:['Goals?','Delivery?']}});tree=h.render();assert.equal(h.completed.length,0);
 card=nodes(tree,n=>n.type===h.type('PeetTaskCard'))[0];card.props.onSaved({...saved,version:4,status:'approved'});assert.match(h.completed[0],/overall PEET score/);
});
test('Older submissions request submitter questions inside evaluation, with a manual fallback for load errors',async()=>{
 const h=harness('review');h.render();await h.settle();let tree=h.render();assert.equal(nodes(tree,n=>n.type===h.type('PeetLegacyClarification')).length,1);
 const failed=harness('review');failed.setResult({data:null,error:{message:'Offline'}});failed.render();await failed.settle();tree=failed.render();
 assert.equal(nodes(tree,n=>n.props.role==='alert').length,1);assert.equal(nodes(tree,n=>n.props['aria-label']==='Manual form').length,1);
 failed.setResult({data:null,error:null});nodes(tree,n=>n.type==='button')[0].props.onClick();failed.render();await failed.settle();tree=failed.render();assert.equal(nodes(tree,n=>n.type===failed.type('PeetLegacyClarification')).length,1);
});

test('A teammate gets their own reflection form after shared delivery instead of another officer card',async()=>{
 const h=harness('submit');h.props.officerTask.individual_peet=true;h.props.officerTask.status='submitted';
 h.render();await h.settle();const tree=h.render();
 const form=nodes(tree,n=>n.type===h.type('PeetSubmissionForm'))[0];
 assert.ok(form);assert.equal(form.props.sourceTask.individual_peet,true);
 assert.equal(nodes(tree,n=>n.type==='details'&&n.props.children?.[1]===h.props.manualFallback).length,0);
});

test('Reviewers select and score each participant contribution separately',async()=>{
 const a={id:'a-reflection',task_id:'task-1',student_id:'a',student_name:'Alice',status:'pending',version:2};
 const b={id:'b-reflection',task_id:'task-1',student_id:'b',student_name:'Bob',status:'pending',version:2};
 const h=harness('review',[a,b]);h.props.officerTask.individual_peet=true;h.props.officerTask.assigned_to='a';h.props.officerTask.officer_task_members=[{officer_id:'b'}];
 h.render();await h.settle();let tree=h.render();
 nodes(tree,n=>n.type==='select')[0].props.onChange({target:{value:'b'}});tree=h.render();
 const card=nodes(tree,n=>n.type===h.type('PeetTaskCard'))[0];assert.equal(card.props.task.student_id,'b');
 card.props.onSaved({...b,status:'approved',version:3});assert.match(h.completed[0],/officer.*evaluation.*saved/i);assert.doesNotMatch(h.completed[0],/task is complete/);
});

test('Removed participants do not appear in contribution review selection',async()=>{
 const former={id:'former',student_id:'removed',student_name:'Former teammate',status:'pending'};
 const current={id:'current',student_id:'student',student_name:'Current officer',status:'pending'};
 const h=harness('review',[former,current]);h.props.officerTask.individual_peet=true;
 h.render();await h.settle();const tree=h.render();
 assert.equal(nodes(tree,n=>n.type==='option').length,1);
 assert.equal(nodes(tree,n=>n.type===h.type('PeetTaskCard'))[0].props.task.student_id,'student');
 });
