"use client";

import { useState } from 'react';
import type { OfficerEvent } from '@/lib/officer-tracking';

export default function VolunteerAudienceFields({event,checkboxClass}: {event?:OfficerEvent;checkboxClass?:string}) {
  const [isPublic,setPublic]=useState(event?.public_volunteering??false);
  return <>
    <label className={checkboxClass}><input name="public_volunteering" type="checkbox" checked={isPublic} onChange={change=>setPublic(change.target.checked)}/>Open to public volunteers AND leadership</label>
    <p>{isPublic?'This event appears on the volunteer signup page for all GEA One members. Officer and public attendance are recorded in their respective rosters.':'Leadership only. This event will not appear on the public volunteer signup page.'}</p>
    <fieldset hidden={!isPublic} disabled={!isPublic}>
      <label>Public volunteer description<textarea name="public_description" rows={3} maxLength={10000} defaultValue={event?.public_description}/></label>
      <p>Only this description and the event title, location, and schedule are public. Officer notes stay private.</p>
      <label className={checkboxClass}><input name="public_signup_open" type="checkbox" defaultChecked={event?.public_signup_open??true}/>Accept public volunteer signups until the event starts</label>
      <label>Public volunteer capacity (optional)<input name="public_capacity" type="number" min={1} max={10000} step={1} defaultValue={event?.public_capacity??''}/></label>
    </fieldset>
  </>;
}
