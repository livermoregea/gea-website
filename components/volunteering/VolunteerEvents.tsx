"use client";

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { schoolDate, durationLabel } from '@/lib/officer-tracking';
import { publicSignupOpen, publicVolunteerError, type PublicVolunteerEvent, type PublicVolunteerSignup } from '@/lib/public-volunteering';
import styles from './volunteering.module.css';

export default function VolunteerEvents({events,signups,signedIn,initialName}: {events:PublicVolunteerEvent[];signups:PublicVolunteerSignup[];signedIn:boolean;initialName:string}) {
  const router=useRouter();
  const [name,setName]=useState(initialName);
  const [saving,setSaving]=useState<string|null>(null);
  const [refreshing,startTransition]=useTransition();
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const busy=Boolean(saving)||refreshing;
  async function register(eventId:string,registered:boolean){
    setSaving(eventId);setError('');setNotice('');
    try {
      const result=await createClient().rpc('set_public_volunteer_signup',{p_event_id:eventId,p_registered:registered,p_name:name.trim()});
      if(result.error){setError(publicVolunteerError(result.error));return;}
      setNotice(registered?'You are signed up to volunteer.':'Your volunteer signup has been withdrawn.');
      startTransition(()=>router.refresh());
    }catch{setError('Could not update your signup. Check your connection and retry.');}
    finally{setSaving(null);}
  }
  const visible=events.filter(event=>Date.parse(event.ends_at)>=Date.now()||signups.some(row=>row.event_id===event.id));
  return <>
    {signedIn?<div className={styles.form}><label>Your full name for the volunteer roster<input value={name} maxLength={160} autoComplete="name" disabled={busy} onChange={event=>setName(event.target.value)} /></label></div>:<p className={styles.notice}><Link className={styles.secondary} href="/login?next=%2Fvolunteer">Sign in to GEA One to volunteer</Link></p>}
    {error&&<p role="alert" className={styles.error}>{error}</p>}
    <p role="status" className={styles.notice}>{refreshing?'Updating your signup…':notice}</p>
    {!visible.length&&<p className={styles.muted}>No public volunteer events are open right now. Check back for the next opportunity.</p>}
    <div className={styles.grid}>{visible.map(event=>{
      const signup=signups.find(row=>row.event_id===event.id);
      const registered=signup?.status==='registered';
      const open=publicSignupOpen(event);
      const canWithdraw=registered&&signup.attendance==='unmarked'&&(Date.parse(event.starts_at)>Date.now()||event.status==='cancelled');
      return <article className={styles.card} key={event.id}>
        <span className={styles.badge}>Public volunteer event</span>
        <h2>{event.title}</h2>
        <p>{schoolDate(event.starts_at)} – {schoolDate(event.ends_at)}</p>
        <p>{event.location||'Location to be announced'}</p>
        {event.description&&<p>{event.description}</p>}
        {event.capacity&&<p className={styles.muted}>Volunteer capacity: {event.capacity}</p>}
        {event.status==='cancelled'?<p>Event cancelled</p>:!open&&<p>Signups closed</p>}
        {registered&&<p><strong>{event.status==='cancelled'?'Your signup is on record':'You’re signed up'}</strong> · {signup.name}</p>}
        {signup?.status==='withdrawn'&&<p>You withdrew your signup.</p>}
        {signup&&signup.attendance!=='unmarked'&&<p>Attendance: {signup.attendance==='present'?'Present':'Absent'} · Verified service: {durationLabel(signup.verified_minutes)}</p>}
        {signup?.attendance_note&&<p>Coordinator note: {signup.attendance_note}</p>}
        {signedIn&&<div className={styles.actions}>
          {!registered&&open&&<button className={styles.primary} disabled={busy||!name.trim()} onClick={()=>register(event.id,true)}>{saving===event.id?'Signing up…':'Sign up to volunteer'}</button>}
          {canWithdraw&&<button className={styles.secondary} disabled={busy} onClick={()=>register(event.id,false)}>{saving===event.id?'Withdrawing…':'Withdraw signup'}</button>}
        </div>}
      </article>;
    })}</div>
  </>;
}
