"use client";

import { useState } from "react";
import type { TaskTeammate } from "@/lib/peet";
import styles from "./officerboard.module.css";

export default function TaskPeoplePicker({ people, selected, creatorId, includeCreator = true, onChange }: {
  people: TaskTeammate[]; selected: string[]; creatorId: string; includeCreator?: boolean; onChange: (ids: string[]) => void;
}) {
  const [search, setSearch] = useState("");
  const options = [...people, ...selected.filter(id => !people.some(person => person.id === id)).map(id => ({ id, name: "Former officer", position: "Remove to save changes" }))];
  const matches = options.filter(person => `${person.name} ${person.position ?? ""}`.toLowerCase().includes(search.toLowerCase()));
  return <details className={styles.peoplePicker}>
    <summary>Add people <span className={styles.badge}>{selected.filter(id => !includeCreator || id !== creatorId).length} added</span></summary>
    <p>{includeCreator ? "You stay on the task. Choose other officers to work with you." : "Choose two or more participants. You are only included if you select yourself."} One shared deliverable; individual contribution reflections and PEET scores.</p>
    <label>Find officers<input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Name or position" /></label>
    <div className={styles.assignmentList}>{matches.map(person => <label key={person.id} className={styles.assignmentPerson}>
      <input type="checkbox" checked={(includeCreator && person.id === creatorId) || selected.includes(person.id)} disabled={includeCreator && person.id === creatorId} onChange={event => onChange(event.target.checked ? Array.from(new Set([...selected, person.id])) : selected.filter(id => id !== person.id))} />
      <span><strong>{person.name}{person.id === creatorId ? " (you)" : ""}</strong><small>{person.position || "Officer"}</small></span>
    </label>)}</div>
    {matches.length === 0 && <p>No officers match your search.</p>}
  </details>;
}
