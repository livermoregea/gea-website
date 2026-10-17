"use client";

import styles from "./officerboard.module.css";

export const officerTopics = [
  ["overview", "Summary"], ["tasks", "Tasks & PEET"], ["attendance", "Attendance"],
  ["volunteer", "Volunteer"], ["accountability", "Concerns & notes"],
] as const;
export type OfficerTopic = typeof officerTopics[number][0];

export default function OfficerTopicNavigation({ topic, onSelect, pending = {} }: { topic: OfficerTopic; onSelect: (topic: OfficerTopic) => void; pending?: Partial<Record<OfficerTopic,number>> }) {
  return <><label className={styles.mobileTopicPicker}>Record section<select value={topic} onChange={event => onSelect(event.target.value as OfficerTopic)}>{officerTopics.map(([value,label]) => <option key={value} value={value}>{label}{pending[value] ? ` (${pending[value]} pending)` : ""}</option>)}</select></label><nav className={`${styles.topicNavigation} ${styles.officerTopics}`} aria-label="Selected officer topics">
    {officerTopics.map(([value,label]) => <button key={value} type="button" aria-current={topic === value ? "page" : undefined} onClick={() => onSelect(value)}>{label}{Boolean(pending[value]) && <span className={styles.topicCount}>{pending[value]}<span className="sr-only"> pending</span></span>}</button>)}
  </nav></>;
}
