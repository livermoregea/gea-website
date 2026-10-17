import type { Metadata } from 'next';
import VolunteerEvents from '@/components/volunteering/VolunteerEvents';
import { createClient } from '@/lib/supabase/server';
import { hasSupabaseConfig } from '@/lib/supabase/config';
import { volunteerRows, PUBLIC_EVENT_COLUMNS, PUBLIC_SIGNUP_COLUMNS, type PublicVolunteerEvent, type PublicVolunteerSignup } from '@/lib/public-volunteering';
import styles from '@/components/volunteering/volunteering.module.css';

export const metadata: Metadata={title:'Volunteer with GEA',description:'Find public GEA volunteer events and sign up with your GEA One account.'};
export const dynamic='force-dynamic';
export default async function VolunteerPage(){
  const header=<header className={styles.header}><div><h1>Volunteer with GEA</h1><p>Public volunteer opportunities for everyone with a GEA One account. You don’t need to be an officer.</p></div></header>;
  if(!hasSupabaseConfig())return <div className={styles.page}>{header}<p>Volunteer events will be available once the site is connected.</p></div>;
  const client=await createClient();
  const {data:{user}}=await client.auth.getUser();
  try{
    const [events,signups]=await Promise.all([
      volunteerRows<PublicVolunteerEvent>((from,to)=>client.from('public_volunteer_events').select(PUBLIC_EVENT_COLUMNS).order('starts_at').order('id').range(from,to)),
      user?volunteerRows<PublicVolunteerSignup>((from,to)=>client.from('public_volunteer_signups').select(PUBLIC_SIGNUP_COLUMNS).eq('user_id',user.id).order('id').range(from,to)):Promise.resolve([]),
    ]);
    // Staff may read drafts through RLS; the public page always hides unpublished listings.
    const publicEvents=events.filter(event=>event.status==='published'||signups.some(row=>row.event_id===event.id));
    const name=typeof user?.user_metadata?.full_name==='string'?user.user_metadata.full_name:'';
    return <div className={styles.page}>{header}<VolunteerEvents events={publicEvents} signups={signups} signedIn={Boolean(user)} initialName={name}/></div>;
  }catch{return <div className={styles.page}>{header}<p role="alert">Could not load volunteer events. Please refresh or contact a coordinator if this continues.</p></div>;}
}
