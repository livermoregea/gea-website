"use client";

import { taskCompleteFor, evaluationForOfficer, officerTaskPeople, isOfficerTaskParticipant, taskAverage, peetPercentage, type OfficerTask, type PeetEvaluation } from "@/lib/peet";
import TaskSection from "./TaskSection";
import OfficerTaskSubmission from "./OfficerTaskSubmission";
import styles from "./officerboard.module.css";

function date(value: string | null) {
  return value ? new Date(value.length === 10 ? `${value}T12:00:00` : value).toLocaleDateString("en-US", {month:"short",day:"numeric",year:"numeric"}) : "—";
}

export default function OfficerTaskHistory({ tasks, evaluations, admin, actorId, busy, subjectId, defaultOpen = false, peopleNames = {}, canEvaluate, onReview, onCancel }: {
  subjectId?: string; peopleNames?: Record<string, string>; defaultOpen?: boolean; tasks: OfficerTask[]; evaluations: PeetEvaluation[]; admin: boolean; actorId: string; busy: boolean;
  canEvaluate: (task: OfficerTask) => boolean; onReview: (task: OfficerTask) => void; onCancel: (task: OfficerTask) => void;
}) {
  const completed = tasks.filter(task => !task.cancelled_at && taskCompleteFor(task, subjectId || (!admin ? actorId : undefined)));
  return <TaskSection title="Completed tasks" count={completed.length} defaultOpen={defaultOpen}>
    {!completed.length ? <p className={styles.compactEmpty}>No completed tasks to show.</p> : completed.map(task => {
      const evaluation = evaluationForOfficer(evaluations, task.id, subjectId || (!admin ? actorId : undefined));
      return <details key={task.id} className={styles.taskDisclosure}>
        <summary className={styles.taskRowSummary}><span className={styles.disclosureChevron} aria-hidden="true" /><span className={styles.taskRowTitle}>{task.title}</span><span className={styles.badge}>{evaluation ? `${taskAverage(evaluation).toFixed(2)}/4` : task.individual_peet ? "Individual scores" : "No score"}</span><span className={styles.rowMeta}>{date(evaluation?.evaluated_at || task.completed_at)}</span></summary>
        <div className={styles.taskDetails}><div className={styles.actions}>
          {admin && canEvaluate(task) && <button className={styles.secondary} disabled={busy} onClick={() => onReview(task)}>{evaluation ? "Adjust scores" : "Evaluate"}<span className="sr-only"> for {task.title}</span></button>}
          {admin && !isOfficerTaskParticipant(task, actorId) && <button className={styles.secondary} disabled={busy} onClick={() => onCancel(task)}>Cancel task<span className="sr-only"> {task.title}</span></button>}
        </div>
        {officerTaskPeople(task).length > 1 && <p>Shared with {officerTaskPeople(task).map(id => peopleNames[id] || "Former officer").join(", ")} · {task.individual_peet ? "Shared deliverable · Individual reflections and scores" : "Historical shared submission and evaluation"}</p>}
        {task.ended_by && <p>Ended by a reviewer{!evaluation ? " · No PEET score" : ""}. {task.end_notes}</p>}
        {task.individual_peet && admin && !subjectId && <section><h4>Individual evaluations</h4>{evaluations.filter(row => row.task_id === task.id && row.officer_id).map(row => <p key={row.id}><strong>{peopleNames[row.officer_id!] || "Officer"}</strong> · {peetPercentage(taskAverage(row)).toFixed(1)}/100 · {row.feedback_notes}</p>)}</section>}
        <dl className={styles.historyScores}>{(["efficiency","effectiveness","time","average"] as const).map(pillar => <div key={pillar}><dt>{pillar[0].toUpperCase()+pillar.slice(1)}</dt><dd>{evaluation ? pillar === "average" ? taskAverage(evaluation).toFixed(2) : Number(evaluation[pillar]).toFixed(1) : "—"}</dd></div>)}</dl>
        <div className={styles.historyFeedback}><h4>Reviewer feedback</h4><p>{evaluation?.feedback_notes || "No written feedback."}</p>{evaluation && <small>Evaluated {date(evaluation.evaluated_at)}</small>}</div>
        <OfficerTaskSubmission task={task} />
        <div className={styles.historyFooter}><p>Assigned {date(task.created_at)} · Due {date(task.due_date)}</p></div>
        </div>
      </details>;
    })}
  </TaskSection>;
}
