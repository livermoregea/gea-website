"use client";

import { taskAverage, type OfficerTask, type PeetEvaluation } from "@/lib/peet";
import OfficerTaskSubmission from "./OfficerTaskSubmission";
import styles from "./officerboard.module.css";

function date(value: string | null) {
  return value ? new Date(value.length === 10 ? `${value}T12:00:00` : value).toLocaleDateString("en-US", {month:"short",day:"numeric",year:"numeric"}) : "—";
}

export default function OfficerTaskHistory({ tasks, evaluations, admin, actorId, busy, canEvaluate, onReview, onCancel }: {
  tasks: OfficerTask[]; evaluations: PeetEvaluation[]; admin: boolean; actorId: string; busy: boolean;
  canEvaluate: (task: OfficerTask) => boolean; onReview: (task: OfficerTask) => void; onCancel: (task: OfficerTask) => void;
}) {
  const completed = tasks.filter(task => !task.cancelled_at && task.status === "completed");
  return <section className={styles.section} aria-labelledby="peet-history-heading">
    <div className={styles.sectionHeading}><div><h2 id="peet-history-heading">Task history</h2><p>Scores are out of 4. Each evaluated task carries equal weight.</p></div><span className={styles.badge}>{completed.length} completed</span></div>
    {!completed.length ? <p className={styles.empty}>Completed tasks and reviewer feedback will appear here.</p> : completed.map(task => {
      const evaluation = evaluations.find(row => row.task_id === task.id);
      return <article key={task.id} className={styles.historyCard}>
        <div className={styles.historyHeading}><div><h3>{task.title}</h3><p>Completed {date(task.completed_at)}</p></div><div className={styles.actions}>
          {admin && canEvaluate(task) && <button className={styles.secondary} disabled={busy} onClick={() => onReview(task)}>Adjust scores<span className="sr-only"> for {task.title}</span></button>}
          {admin && task.assigned_to !== actorId && <button className={styles.secondary} disabled={busy} onClick={() => onCancel(task)}>Cancel task<span className="sr-only"> {task.title}</span></button>}
        </div></div>
        <dl className={styles.historyScores}>{(["efficiency","effectiveness","time","average"] as const).map(pillar => <div key={pillar}><dt>{pillar[0].toUpperCase()+pillar.slice(1)}</dt><dd>{evaluation ? pillar === "average" ? taskAverage(evaluation).toFixed(2) : Number(evaluation[pillar]).toFixed(1) : "—"}</dd></div>)}</dl>
        <div className={styles.historyFeedback}><h4>Reviewer feedback</h4><p>{evaluation?.feedback_notes || "No written feedback."}</p>{evaluation && <small>Evaluated {date(evaluation.evaluated_at)}</small>}</div>
        <OfficerTaskSubmission task={task} />
        <div className={styles.historyFooter}><p>Assigned {date(task.created_at)} · Due {date(task.due_date)}</p></div>
      </article>;
    })}
  </section>;
}
