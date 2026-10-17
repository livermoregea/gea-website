"use client";

import Link from 'next/link';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { createClient } from '@/lib/supabase/client';
import { localDateInput, schoolDate, durationLabel } from '@/lib/officer-tracking';
import { volunteerRows, publicVolunteerError, PUBLIC_EVENT_COLUMNS, PUBLIC_SIGNUP_COLUMNS, type PublicVolunteerEvent, type PublicVolunteerSignup } from '@/lib/public-volunteering';
import Modal from '@/components/officerboard/Modal';
import styles from '@/components/volunteering/volunteering.module.css';

type Editor={kind:'event';event?:PublicVolunteerEvent}|{kind:'attendance';signup:PublicVolunteerSignup};
export default function AdminVolunteers(){
  const [events,setEvents]=useState<PublicVolunteerEvent[]>([]);
  const [signups,setSignups]=useState<PublicVolunteerSignup[]>([]);
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const [selectedId,setSelectedId]=useState('');
  const [search,setSearch]=useState('');
  const [editor,setEditor]=useState<Editor|null>(null);
  const busy=loading||saving;
  const load=useCallback(async()=>{
    setLoading(true);
    try{
      const client=createClient();
      const [eventRows,signupRows]=await Promise.all([
        volunteerRows<PublicVolunteerEvent>((from,to)=>client.from('public_volunteer_events').select(PUBLIC_EVENT_COLUMNS).order('starts_at',{ascending:false}).order('id').range(from,to)),
        volunteerRows<PublicVolunteerSignup>((from,to)=>client.from('public_volunteer_signups').select(PUBLIC_SIGNUP_COLUMNS).order('name').order('id').range(from,to)),
      ]);
      setEvents(eventRows);setSignups(signupRows);return true;
    }catch(failure){setError(failure instanceof Error?failure.message:'Could not load public volunteering. Refresh to retry.');return false;}
    finally{setLoading(false);}
  },[]);
  useEffect(()=>{void load();},[load]);
  const selected=events.find(event=>event.id===selectedId)??events[0];
  const roster=signups.filter(row=>row.event_id===selected?.id);
  const shown=roster.filter(row=>`${row.name} ${row.email}`.toLowerCase().includes(search.toLowerCase()));
  function open(next:Editor){setError('');setNotice('');setEditor(next);}
  async function save(event:FormEvent<HTMLFormElement>){
    event.preventDefault();if(!editor)return;
    const fields=new FormData(event.currentTarget);
    setSaving(true);setError('');setNotice('');
    try{
      const result=editor.kind==='event'?await createClient().rpc('save_public_volunteer_event',{
        p_title:String(fields.get('title')).trim(),p_description:String(fields.get('description')),p_location:String(fields.get('location')).trim(),
        p_starts_at:new Date(String(fields.get('starts_at'))).toISOString(),p_ends_at:new Date(String(fields.get('ends_at'))).toISOString(),
        p_status:fields.get('status'),p_signup_open:fields.get('signup_open')==='on',p_capacity:fields.get('capacity')?Number(fields.get('capacity')):null,
        p_id:editor.event?.id??null,p_version:editor.event?.version??0,
      }):await createClient().rpc('record_public_volunteer_attendance',{
        p_signup_id:editor.signup.id,p_attendance:fields.get('attendance'),p_minutes:Number(fields.get('minutes')),
        p_note:String(fields.get('note')),p_version:editor.signup.version,
      });
      if(result.error){setError(publicVolunteerError(result.error));return;}
      if(editor.kind==='event'&&typeof result.data==='string')setSelectedId(result.data);
      setEditor(null);
      if(await load())setNotice(editor.kind==='event'?'Public volunteer event saved.':'Public volunteer attendance saved.');
    }catch{setError('Could not save. Check the dates and your connection, then retry.');}
    finally{setSaving(false);}
  }
  return <section aria-labelledby="public-volunteers-heading">
    <header className={styles.header}><div><h2 id="public-volunteers-heading">Public volunteering</h2><p>Manage public signups and attendance for the same volunteer events scheduled in the Officer workspace.</p><p className={styles.muted}>Choose leadership-only or public AND leadership when scheduling an event in the <Link href="/admin-portal-x7k9/officers?view=volunteer" className="underline">Officer workspace</Link>.</p></div><button className={styles.primary} disabled={busy} onClick={()=>open({kind:'event'})}>Add public & leadership event</button></header>
    <p><Link className={styles.secondary} href="/volunteer">Open volunteer signup page</Link></p>
    <p role="status" className={styles.notice}>{loading?'Loading public volunteering…':notice}</p>
    {error&&!editor&&<p role="alert" className={styles.error}>{error}</p>}
    <div className={styles.form}><label>Public volunteer event<select disabled={busy||!events.length} value={selected?.id??''} onChange={event=>setSelectedId(event.target.value)}>{!events.length&&<option value="">No public volunteer events yet</option>}{events.map(event=><option key={event.id} value={event.id}>{event.title} · {schoolDate(event.starts_at,false)} · {event.status}</option>)}</select></label></div>
    <div className={styles.actions}><button className={styles.secondary} disabled={busy} onClick={()=>{setError('');void load();}}>Refresh public volunteer records</button>{selected&&<button className={styles.secondary} disabled={busy} onClick={()=>open({kind:'event',event:selected})}>Edit public event</button>}</div>
    {selected&&<>
      <article className={`${styles.card} mt-5`}><span className={styles.badge}>Public & leadership · {selected.status}</span><h3>{selected.title}</h3><p>{schoolDate(selected.starts_at)} – {schoolDate(selected.ends_at)} · {selected.location||'Location to be announced'}</p><p>{roster.filter(row=>row.status==='registered').length} signed up{selected.capacity?` / ${selected.capacity} places`:''} · {roster.filter(row=>row.attendance==='present').length} present · {durationLabel(roster.reduce((sum,row)=>sum+row.verified_minutes,0))} verified</p></article>
      <div className={styles.form}><label>Find a public volunteer<input type="search" value={search} onChange={event=>setSearch(event.target.value)} placeholder="Name or email" /></label></div>
      {Date.parse(selected.starts_at)>Date.now()&&<p className={styles.muted}>Attendance opens when the event starts. Service minutes can be verified after it ends.</p>}
      <div className={styles.roster}>{shown.map(row=><article className={styles.rosterRow} key={row.id}><div><h3 className="font-semibold">{row.name}</h3><p>{row.email}</p><p>{row.status==='withdrawn'?'Withdrawn':row.attendance==='unmarked'?'Signed up · attendance unmarked':row.attendance==='present'?'Present':'Absent'} · {durationLabel(row.verified_minutes)} verified</p></div><button className={styles.secondary} disabled={busy||row.status==='withdrawn'||selected.status!=='published'||Date.parse(selected.starts_at)>Date.now()} onClick={()=>open({kind:'attendance',signup:row})}>Record attendance<span className="sr-only"> for {row.name}</span></button></article>)}</div>
      {!shown.length&&!loading&&<p className="mt-5">{roster.length?'No public volunteers match your search.':'No one has signed up for this public event yet.'}</p>}
    </>}
    {editor&&<Modal title={editor.kind==='event'?editor.event?'Edit public volunteer event':'Add public volunteer event':`Public attendance: ${editor.signup.name}`} busy={busy} onClose={()=>setEditor(null)}>
      <form className={styles.form} onSubmit={save}>
        {error&&<p role="alert" className={styles.error}>{error}</p>}
        <fieldset disabled={busy}>
          {editor.kind==='event'?<>
            <p><span className={styles.badge}>Public volunteer event</span> This is the same event used by leadership. Published events accept public volunteers as well. Schedule changes here also update the Officer workspace.</p>
            <label>Event title<input name="title" required maxLength={200} defaultValue={editor.event?.title}/></label>
            <label>Description<textarea name="description" rows={4} maxLength={10000} defaultValue={editor.event?.description}/></label>
            <label>Location<input name="location" maxLength={500} defaultValue={editor.event?.location}/></label>
            <p className={styles.muted}>Enter dates in your device’s time zone: {Intl.DateTimeFormat().resolvedOptions().timeZone}. The signup page displays Pacific Time.</p>
            <div className={styles.columns}><label>Starts<input name="starts_at" type="datetime-local" required defaultValue={editor.event&&localDateInput(editor.event.starts_at)}/></label><label>Ends<input name="ends_at" type="datetime-local" required defaultValue={editor.event&&localDateInput(editor.event.ends_at)}/></label></div>
            <label>Publishing status<select name="status" defaultValue={editor.event?.status??'draft'}><option value="draft">Draft — hidden from public listings</option><option value="published">Published — public volunteer event</option><option value="cancelled">Cancelled — retain signup history</option></select></label>
            <label className={styles.checkbox}><input type="checkbox" name="signup_open" defaultChecked={editor.event?.signup_open??true}/>Accept volunteer signups until the event starts</label>
            <label>Volunteer capacity (optional)<input name="capacity" type="number" min={1} max={10000} step={1} defaultValue={editor.event?.capacity??''}/></label>
          </>:<>
            <p>{editor.signup.name} · {editor.signup.email}</p>
            <label>Attendance<select name="attendance" defaultValue={editor.signup.attendance}><option value="unmarked">Unmarked</option><option value="present">Present</option><option value="absent">Absent</option></select></label>
            <label>Verified service minutes<input name="minutes" type="number" required min={0} max={1440} step={1} defaultValue={editor.signup.verified_minutes}/></label>
            <label>Note shared with this volunteer<textarea name="note" rows={3} maxLength={2000} defaultValue={editor.signup.attendance_note}/></label>
            <p className={styles.muted}>Record attendance after the event starts and verify service after it ends.</p>
          </>}
        </fieldset>
        <div className={styles.actions}><button type="button" className={styles.secondary} disabled={busy} onClick={()=>setEditor(null)}>Cancel</button><button className={styles.primary} disabled={busy}>{saving?'Saving…':'Save'}</button></div>
      </form>
    </Modal>}
  </section>;
}
