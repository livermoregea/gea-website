"use client";

import ActionError from "@/components/ActionError";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { AccountDirectory, ManagedAccount } from "@/lib/account-management";
import Modal from "./Modal";
import styles from "./officerboard.module.css";

type Draft = { userId: string; kind: ManagedAccount["kind"]; name: string; email: string; username: string; classYear: string; studentId: string; password: string; portalRole: string; reviewerKind: string; position: string };
const initial = (kind: ManagedAccount["kind"], account?: ManagedAccount): Draft => ({userId:account?.userId??"",kind,name:account?.name??"",email:account?.email??"",username:account?.username??"",classYear:account?.classYear?.toString()??"",studentId:"",password:"",portalRole:account?.portalRole??"officer",reviewerKind:account?.reviewerKind??"",position:account?.position??""});

export default function AccountsPanel({ actorId }: { actorId: string }) {
  const router=useRouter();
  const [directory,setDirectory]=useState<AccountDirectory>({accounts:[],authAccounts:[]});
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState<string|null>(null);
  const [message,setMessage]=useState("");
  const [query,setQuery]=useState("");
  const [draft,setDraft]=useState<Draft|null>(null);
  const [removal,setRemoval]=useState<ManagedAccount|null>(null);
  const [reason,setReason]=useState("");
  const [confirmed,setConfirmed]=useState(false);
  const load=useCallback(async(signal?:AbortSignal)=>{
    setLoading(true);
    try{
      const response=await fetch('/api/officerboard/accounts',{cache:'no-store',signal});
      const body=await response.json();
      if(!response.ok){setError(body.error??'Could not load accounts.');return;}
      setDirectory(body);setError(null);
    }catch{if(!signal?.aborted)setError('Could not load accounts. Check your connection and retry.');}
    finally{if(!signal?.aborted)setLoading(false);}
  },[]);
  useEffect(()=>{const controller=new AbortController();load(controller.signal);return()=>controller.abort();},[load]);
  async function save(event:FormEvent){
    event.preventDefault();setSaving(true);setError(null);setMessage("");
    try{
      const payload=removal?{action:'remove',userId:removal.userId,kind:removal.kind,reason,confirmed}:{...draft,action:'save'};
      const response=await fetch('/api/officerboard/accounts',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
      const body=await response.json();
      if(!response.ok){setError(body.error??'Could not save account changes.');return;}
      setDraft(null);setRemoval(null);setMessage(body.message??'Account saved.');await load();router.refresh();
    }catch{setError('Could not save account changes. Your entries are still here; check your connection and retry.');}
    finally{setSaving(false);}
  }
  function open(kind:ManagedAccount["kind"],account?:ManagedAccount){setError(null);setMessage("");setDraft(initial(kind,account));}
  const matching=directory.accounts.filter(account=>`${account.name} ${account.email} ${account.kind} ${account.position??''}`.toLowerCase().includes(query.toLowerCase()));
  return <section className={styles.section} aria-labelledby="account-management-heading">
    <div className={styles.sectionHeading}><div><h2 id="account-management-heading">GEA One accounts & permissions</h2><p>Add people, edit their profiles, and manage student, teacher, or officer access. Teachers receive super-admin access automatically.</p></div><div className={styles.actions}><button className={styles.primary} onClick={()=>open('student')} disabled={loading||saving}>Add student</button><button className={styles.secondary} onClick={()=>open('teacher')} disabled={loading||saving}>Add teacher</button><button className={styles.secondary} onClick={()=>open('officer')} disabled={loading||saving}>Grant officer access</button></div></div>
    <div className={styles.accountToolbar}><label htmlFor="account-search">Find a person</label><input id="account-search" type="search" placeholder="Name, email, or account type" value={query} onChange={event=>setQuery(event.target.value)} /><button className={styles.secondary} disabled={loading||saving} onClick={()=>load()}>Refresh GEA One accounts</button></div>
    <p role="status" className={styles.empty}>{loading?'Loading GEA One accounts…':message}</p>
    {error&&!draft&&!removal&&<ActionError message={error} className={styles.error} />}
    {!loading&&!matching.length&&!error&&<p className={styles.empty}>No matching GEA One accounts.</p>}
    {matching.map(account=><article key={`${account.kind}:${account.userId}`} className={styles.taskRow}><div className={styles.taskCopy}><span className={styles.badge}>{account.kind==='officer'?(account.portalEnabled===false?'Inactive officer access':account.reviewerKind==='advisor'?'Academy Advisor':account.reviewerKind==='president'?'President / reviewer':'Officer'):account.kind}</span><h3>{account.name}</h3><p>{account.email}{account.classYear?` · Class of ${account.classYear}`:''}{account.position?` · ${account.position}`:''}</p>{account.userId===actorId&&<span className={styles.badge}>Your GEA One account</span>}</div><div className={styles.actions}><button className={styles.secondary} onClick={()=>open(account.kind,account)}>Edit<span className="sr-only"> {account.kind} profile for {account.name}</span></button>{account.kind!=='officer'&&account.userId!==actorId&&<button className={styles.secondary} onClick={()=>{setError(null);setReason('');setConfirmed(false);setRemoval(account);}}>Remove {account.kind} access<span className="sr-only"> for {account.name}</span></button>}</div></article>)}
    {draft&&<Modal title={`${draft.userId?'Edit':'Add'} ${draft.kind} account`} busy={saving} onClose={()=>setDraft(null)}>
      <form onSubmit={save} className={styles.form}><h2 className={styles.modalTitle}>{draft.userId?'Edit':'Add'} {draft.kind==='officer'?'officer access':draft.kind}</h2>{error&&<ActionError message={error} className={styles.error} />}<fieldset disabled={saving}>
        {!draft.userId&&<label>Attach an existing GEA One account (optional)<select aria-label="Attach an existing GEA One account" value="" onChange={event=>{const existing=directory.authAccounts.find(account=>account.id===event.target.value);if(existing)setDraft({...draft,userId:existing.id,email:existing.email,name:existing.name});}}><option value="">Choose an existing GEA One account, or enter a new email below</option>{directory.authAccounts.map(account=><option key={account.id} value={account.id}>{account.email}</option>)}</select></label>}
        <label>Full name<input required maxLength={160} value={draft.name} onChange={event=>setDraft({...draft,name:event.target.value})} /></label>
        <label>GEA One email<input type="email" required maxLength={254} value={draft.email} onChange={event=>setDraft({...draft,email:event.target.value})} /></label><p>Use an @lvjusd.org address. Existing GEA One accounts keep their passwords when access is added.</p>
        {draft.kind==='student'&&<><label>Display username<input required maxLength={80} value={draft.username} onChange={event=>setDraft({...draft,username:event.target.value})} /></label><label>Graduating class year<input type="number" min="2020" max="2100" required value={draft.classYear} onChange={event=>setDraft({...draft,classYear:event.target.value})} /></label><label>Student ID {draft.userId?'(leave blank to keep existing)':''}<input maxLength={64} value={draft.studentId} onChange={event=>setDraft({...draft,studentId:event.target.value})} autoComplete="off" /></label></>}
        {draft.kind==='officer'&&<><label>Position<input maxLength={160} value={draft.position} onChange={event=>setDraft({...draft,position:event.target.value})} /></label><label>Portal permission<select aria-label="Portal permission" value={draft.portalRole==='officer'?'officer':draft.reviewerKind} onChange={event=>setDraft({...draft,portalRole:event.target.value==='officer'?'officer':'admin',reviewerKind:event.target.value==='officer'?'':event.target.value})}><option value="officer">Officer — own tasks and tracking</option><option value="president">President — reviewer</option><option value="advisor">Academy Advisor — reviewer and removal approval</option></select></label></>}
        {!draft.userId&&<label>Initial password (new GEA One accounts only)<input type="password" minLength={12} maxLength={128} value={draft.password} onChange={event=>setDraft({...draft,password:event.target.value})} autoComplete="new-password" /><span className={styles.help}>At least 12 characters. Not needed if the email already has a GEA One account.</span></label>}
      </fieldset><div className={styles.modalActions}><button type="button" className={styles.secondary} disabled={saving} onClick={()=>setDraft(null)}>Cancel</button><button className={styles.primary} disabled={saving}>{saving?'Saving…':'Save GEA One account'}</button></div></form>
    </Modal>}
    {removal&&<Modal title={`Remove ${removal.kind} access`} busy={saving} onClose={()=>setRemoval(null)}><form onSubmit={save} className={styles.form}><h2 className={styles.modalTitle}>Remove {removal.kind} access?</h2><p>{removal.name} · {removal.email}</p><p>{removal.kind==='student'?'This deletes the student profile and associated student records.':'This deletes the teacher profile, revokes outstanding invites, and removes automatically granted super-admin, site-admin, and officer access.'} The GEA One account and any separate officer/admin permissions remain.</p>{error&&<ActionError message={error} className={styles.error} />}<label>Removal reason<textarea required minLength={10} maxLength={2000} rows={4} value={reason} disabled={saving} onChange={event=>setReason(event.target.value)} /></label><label className={styles.checkbox}><input type="checkbox" required checked={confirmed} disabled={saving} onChange={event=>setConfirmed(event.target.checked)} />I confirm removal of this {removal.kind} profile and access.</label><div className={styles.modalActions}><button type="button" className={styles.secondary} disabled={saving} onClick={()=>setRemoval(null)}>Keep GEA One account</button><button className={styles.danger} disabled={saving||!confirmed}>{saving?'Removing…':'Remove access'}</button></div></form></Modal>}
  </section>;
}
