"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import type { OfficerTask } from "@/lib/peet";
import type { ReactNode } from "react";
import { peetCategories, pillars, peetScorePercent, type PeetTask, type PeetSourceTask, type PeetScores } from "@/lib/peet-ai";
import { productLink } from "@/lib/peet";
import { useFormDraft } from "@/lib/use-form-draft";
import styles from "./peet.module.css";

async function saveTask(endpoint: string, body: unknown): Promise<PeetTask> {
  const response = await fetch(`/api/peet/${endpoint}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Could not save your changes. Please try again.");
  return result.task;
}

export default function OfficerTaskPeet({ officerTask, actorId, mode, manualFallback, onComplete, onBusyChange, peopleNames = {} }: {
  peopleNames?: Record<string, string>;
  officerTask: OfficerTask; actorId: string; mode: "submit" | "review"; manualFallback: ReactNode;
  onComplete: (message: string) => void; onBusyChange: (busy: boolean) => void;
}) {
  const [contributions, setContributions] = useState<PeetTask[]>([]);
  const [selectedStudent, setSelectedStudent] = useState("");
  const [task, setTask] = useState<PeetTask | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true); setLoadError(""); onBusyChange(true);
    async function load() {
      try {
        let query = createClient().from("gea_peet_tasks").select("*").eq("task_id", officerTask.id);
        if (mode === "submit") query = query.eq("student_id", actorId);
        const { data, error } = await query;
        if (error) throw new Error("Could not load task clarification. Retry, or use the manual form below.");
        if (active) {
          const rows = (data || []) as PeetTask[];
          setContributions(rows);
          const selected = mode === "submit" ? rows.find(row => row.student_id === actorId) : rows.find(row => row.status === "pending") || rows[0];
          setSelectedStudent(selected?.student_id || ""); setTask(selected || null);
        }
      } catch (error) { if (active) setLoadError(error instanceof Error ? error.message : "Could not load task clarification."); }
      finally { if (active) { setLoading(false); onBusyChange(false); } }
    }
    void load();
    return () => { active = false; onBusyChange(false); };
  }, [officerTask.id, actorId, mode, retry, onBusyChange]);
  function update(saved: PeetTask) {
    setTask(saved);
    setContributions(rows => [...rows.filter(row => row.id !== saved.id), saved]);
    setSelectedStudent(saved.student_id);
    if (saved.status === "approved") onComplete(officerTask.individual_peet ? "This officer’s PEET evaluation is saved. Teammates keep their own reflections and scores." : "PEET evaluation saved. The task is complete and the overall PEET score is updated.");
    else if (saved.status === "pending" && mode === "submit") onComplete("Work and clarification answers submitted for review.");
  }
  return <div className={styles.taskFlow}>
    {!loading && officerTask.individual_peet && mode === "review" && <section className={styles.assessment}><h2>Individual contribution reviews</h2><p>One shared deliverable, a separate reflection and PEET score for each officer.</p><ul>{[officerTask.assigned_to, ...(officerTask.officer_task_members || []).map(member => member.officer_id)].map(id => <li key={id}>{peopleNames[id] || contributions.find(row => row.student_id === id)?.student_name || "Officer"} · {contributions.find(row => row.student_id === id)?.status === "approved" ? "Evaluated" : contributions.find(row => row.student_id === id)?.status === "pending" ? "Ready for review" : contributions.some(row => row.student_id === id) ? "Reflection in progress" : "Reflection not submitted"}</li>)}</ul>{contributions.length ? <label>Officer contribution<select value={selectedStudent} onChange={event => { setSelectedStudent(event.target.value); setTask(contributions.find(row => row.student_id === event.target.value) || null); }}>{contributions.map(row => <option key={row.id} value={row.student_id}>{row.student_name} · {row.status === "pending" ? "Ready for review" : row.status === "approved" ? "Evaluated" : "Reflection in progress"}</option>)}</select></label> : <p>No individual reflections have been submitted yet. Each participant can open this task to describe their contribution.</p>}</section>}
    {loading && <><h2>{officerTask.title}</h2><p role="status">Loading task clarification…</p></>}
    {loadError && <><h2>{officerTask.title}</h2><p role="alert" className={styles.error}>{loadError}</p><button className={styles.secondary} onClick={() => setRetry(value => value + 1)}>Retry</button></>}
    {!loading && !loadError && officerTask.individual_peet && task && mode === "review" && task.status !== "clarification" && <ContributionManualReview task={task} onComplete={onComplete} onBusyChange={onBusyChange} />}
    {!loading && !loadError && (task ? <PeetTaskCard key={`${task.id}:${task.version}`} task={task} actorId={actorId} own={task.student_id === actorId} canReview={mode === "review"} onSaved={update} onBusyChange={onBusyChange} />
      : mode === "submit" ? <PeetSubmissionForm sourceTask={officerTask as PeetSourceTask} actorId={actorId} onSaved={update} onBusyChange={onBusyChange} />
      : officerTask.individual_peet ? <p>Participants must submit their own contribution reflections before they can receive a score.</p> : <PeetLegacyClarification officerTask={officerTask} onSaved={update} onBusyChange={onBusyChange} />)}
    {!loading && !officerTask.individual_peet && <details className={styles.manual}><summary>{mode === "submit" ? "Submit manually" : "Enter PEET scores manually"}</summary>{manualFallback}</details>}
  </div>;
}

export function PeetLegacyClarification({ officerTask, onSaved, onBusyChange }: { officerTask: OfficerTask; onSaved: (task: PeetTask) => void; onBusyChange?: (busy: boolean) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const locked = useRef(false);
  async function start(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (locked.current) return;
    locked.current = true; setBusy(true); onBusyChange?.(true); setError("");
    const data = new FormData(event.currentTarget);
    try { onSaved(await saveTask("evaluate-submission", { officerTaskId: officerTask.id, category: data.get("category"), description: officerTask.submission_description.slice(0, 5000) || "Supporting deliverable submitted for review.", requestForSubmitter: true })); }
    catch (error) { setError(error instanceof Error ? error.message : "Could not prepare submitter questions."); }
    finally { locked.current = false; setBusy(false); onBusyChange?.(false); }
  }
  return <section><h2>{officerTask.title}</h2><p className={styles.copy}>{officerTask.description}</p><p className={styles.copy}>{officerTask.submission_description}</p>
    {productLink(officerTask.final_product_url) && <a className="inline-flex min-h-11 items-center underline" href={productLink(officerTask.final_product_url)!} target="_blank" rel="noopener noreferrer">View supporting deliverable ↗</a>}
    <p className={styles.hint}>This task was submitted before clarification began. Prepare a few questions for the submitter; their answers will appear here before your reviewer questions and AI scoring.</p>
    <p className={styles.hint}>Task details will be sent to Groq, our AI provider, to prepare clarification questions. Avoid sensitive personal information.</p>
    <form onSubmit={start} className={styles.form}><fieldset disabled={busy}><label>Task category<select name="category">{peetCategories.map(category => <option key={category}>{category}</option>)}</select></label><button className={styles.primary} type="submit">{busy ? "Preparing questions…" : "Ask submitter for clarification"}</button></fieldset></form>
    {error && <p role="alert" className={styles.error}>{error}</p>}
  </section>;
}

export function PeetSubmissionForm({ sourceTask, actorId, onSaved, onBusyChange }: { sourceTask: PeetSourceTask; actorId?: string; onSaved: (task: PeetTask) => void; onBusyChange?: (busy: boolean) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const locked = useRef(false);
  const draft = useFormDraft(`gea:submission:${actorId || sourceTask.assigned_to}:${sourceTask.id}`);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (locked.current) return;
    draft.persist();
    locked.current = true; setBusy(true); onBusyChange?.(true); setError("");
    const data = new FormData(event.currentTarget);
    try {
      const saved = await saveTask("evaluate-submission", { officerTaskId: sourceTask.id, description: data.get("description"), category: data.get("category"), submissionUrl: data.get("url"), deliverableDescription: data.get("deliverableDescription") || "" });
      draft.clear(); onSaved(saved);
    }
    catch (error) { setError(error instanceof Error ? error.message : "Could not submit your work."); }
    finally { locked.current = false; setBusy(false); onBusyChange?.(false); }
  }
  return <section className={styles.card} aria-labelledby="peet-submit-heading">
    {sourceTask.individual_peet && sourceTask.status === "submitted" && <div className={styles.assessment}><h2>The shared deliverable is already submitted!</h2><p>Nice work reaching this step with your team. Now tell us what you contributed and answer a few questions so you can receive your own PEET score.</p><p className={styles.copy}>{sourceTask.submission_description}</p></div>}
    <p className={styles.eyebrow}>1 · {sourceTask.individual_peet ? 'Your contribution & reflection' : 'Submitter clarification'}</p><h2 id="peet-submit-heading">{sourceTask.title}</h2>
    <p className={styles.copy}>Task goals: {sourceTask.description || "No written goals recorded."}</p>
    <p className={styles.hint}>Due: {sourceTask.due_date || "No deadline recorded"}. The AI will ask a few questions about your work before the reviewer begins.</p>
    <form ref={draft.ref} onInput={draft.persist} onChange={draft.persist} onSubmit={submit} className={styles.form}><fieldset disabled={busy}>
      {sourceTask.individual_peet && sourceTask.status === "in_progress" && <label>Shared deliverable description<textarea name="deliverableDescription" required maxLength={5000} rows={3} placeholder="What did your team deliver together? This description is shared with your teammates." /></label>}
      <label>{sourceTask.individual_peet ? 'Your contribution and reflection' : 'Completed work and deliverables'}<textarea name="description" required maxLength={5000} rows={4} defaultValue={sourceTask.individual_peet ? "" : sourceTask.submission_description} placeholder="What did you deliver? How did you use your time and resources? When was the work finished?" /></label>
      <label>Supporting link (optional)<input type="url" name="url" maxLength={2048} readOnly={sourceTask.status === "submitted"} defaultValue={sourceTask.final_product_url || ""} placeholder="https://…" /></label>
      <label>Category<select name="category" required>{peetCategories.map(category => <option key={category}>{category}</option>)}</select></label>
      <p className={styles.hint}>Task details and clarification answers are sent to Groq, our AI provider, for this review. Avoid sensitive personal information.</p>
      <button type="submit" className={styles.primary}>{busy ? "Preparing your questions…" : "Get clarification questions"}</button>
    </fieldset>{draft.saved && <p className={styles.hint} role="status">Draft saved in this browser.</p>}{draft.unavailable && <p role="alert">Browser draft saving is unavailable. Keep this page open or copy your text before leaving.</p>}{error && <p role="alert" className={styles.error}>{error}</p>}</form>
  </section>;
}

export function PeetTaskCard({ task, actorId, own, canReview, onSaved, onBusyChange }: { task: PeetTask; actorId: string; own: boolean; canReview: boolean; onSaved: (task: PeetTask) => void; onBusyChange?: (busy: boolean) => void }) {
  const url = productLink(task.submission_url ?? task.source_context.final_product_url);
  return <article className={styles.card}>
    <div className={styles.heading}><div><p className={styles.eyebrow}>{task.category} · {task.student_name}</p><h2>{task.title}</h2></div><span className={styles.badge}>{task.status === "clarification" ? "Submitter answers needed" : task.status === "pending" ? "Pending PEET review" : "Approved"}</span></div>
    <div className={styles.assessment}><strong>Original task goals</strong><p className={styles.copy}>{task.source_context.description || "No written goals recorded."}</p><p>Due: {task.source_context.due_date || "No deadline recorded"} · {task.source_context.individual_peet ? "Shared deliverable submitted" : "Submitted"}: {task.source_context.submitted_at ? new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "America/Los_Angeles" }).format(new Date(task.source_context.submitted_at)) : "Not yet submitted"}</p></div>
    {task.source_context.individual_peet && <div className={styles.assessment}><strong>Shared team deliverable</strong><p className={styles.copy}>{task.source_context.submission_description}</p></div>}
    {task.reflected_at && task.source_context.individual_peet && <p className={styles.hint}>This officer’s reflection submitted: {new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "America/Los_Angeles" }).format(new Date(task.reflected_at))}</p>}
    <h3 className="mt-4">{task.source_context.individual_peet ? "This officer’s contribution and reflection" : "Submitter’s deliverables"}</h3><p className={styles.copy}>{task.description}</p>
    {url && <a className="inline-flex min-h-11 items-center underline" href={url} target="_blank" rel="noopener noreferrer">View supporting deliverable ↗</a>}
    <div className={styles.assessment}><strong>AI-generated clarification</strong><p>{task.assessment.initialAssessmentSummary}</p></div>
    {task.status === "clarification" && own ? <PeetClarificationForm task={task} onSaved={onSaved} onBusyChange={onBusyChange} /> : <QuestionAnswers title="Submitter questions and answers" questions={task.assessment.studentQuestions} answers={task.answers} />}
    {task.status === "clarification" && !own && <p className={styles.hint}>{task.student_name} needs to answer the clarification questions. They can reopen this task and choose “Submission & clarification.”</p>}
    {task.status === "pending" && canReview && !own ? <PeetReviewForm task={task} actorId={actorId} onSaved={onSaved} onBusyChange={onBusyChange} /> : <>
      {task.reviewer_notes && <div className={styles.assessment}><strong>Reviewer observation</strong><p className={styles.copy}>{task.reviewer_notes}</p></div>}
      {task.reviewer_assessment && <QuestionAnswers title="Reviewer questions and answers" questions={task.reviewer_assessment.reviewerQuestions} answers={task.reviewer_answers} />}
      {task.recommendation && <PeetScoreBreakdown task={task} />}
    </>}
    {task.status === "pending" && own && <p className={styles.hint}>An independent reviewer will answer clarification questions, then review the AI’s PEET recommendation.</p>}
    {task.status === "approved" && task.approved_scores && <div className={styles.award}><strong>Approved PEET · {peetScorePercent(task.approved_scores).toFixed(1)}/100</strong><dl className={styles.dimensions}>{pillars.map(pillar => <div key={pillar}><dt>{pillar[0].toUpperCase() + pillar.slice(1)}</dt><dd>{task.approved_scores![pillar].toFixed(1)}<span> / 4</span></dd></div>)}</dl>{task.override_reason && <p>Reviewer adjustment: {task.override_reason}</p>}</div>}
  </article>;
}
function QuestionAnswers({ title, questions, answers }: { title: string; questions: string[]; answers: string[] }) {
  return <section aria-label={title} className={styles.answers}><h3>{title}</h3><dl>{questions.map((question, i) => <div key={i}><dt>{question}</dt><dd>{answers[i] || "Awaiting answer"}</dd></div>)}</dl></section>;
}
export function PeetClarificationForm({ task, onSaved, onBusyChange }: { task: PeetTask; onSaved: (task: PeetTask) => void; onBusyChange?: (busy: boolean) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const locked = useRef(false);
  const draft = useFormDraft(`gea:clarification:${task.student_id}:${task.id}:${task.version}`);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (locked.current) return;
    draft.persist();
    locked.current = true; setBusy(true); onBusyChange?.(true); setError("");
    const data = new FormData(event.currentTarget);
    try {
      const saved = await saveTask("finalize-submission", { taskId: task.id, version: task.version, answers: task.assessment.studentQuestions.map((_, i) => data.get(`answer-${i}`)) });
      draft.clear(); onSaved(saved);
    }
    catch (error) { setError(error instanceof Error ? error.message : "Could not save your answers."); }
    finally { locked.current = false; setBusy(false); onBusyChange?.(false); }
  }
  return <form ref={draft.ref} onInput={draft.persist} onChange={draft.persist} onSubmit={submit} className={styles.form}><h3>Clarify your work</h3><fieldset disabled={busy}>
    {task.assessment.studentQuestions.map((question, i) => <label key={i}>{question}<textarea name={`answer-${i}`} required maxLength={2000} rows={3} defaultValue={task.answers[i] || ""} /></label>)}
    <button className={styles.primary} type="submit">{busy ? "Saving answers…" : "Send for reviewer clarification"}</button>
  </fieldset>{draft.saved && <p className={styles.hint} role="status">Answers saved in this browser.</p>}{draft.unavailable && <p role="alert">Browser draft saving is unavailable. Keep this page open or copy your answers before leaving.</p>}{error && <p role="alert" className={styles.error}>{error}</p>}</form>;
}
export function PeetScoreBreakdown({ task }: { task: PeetTask }) {
  const score = task.recommendation;
  if (!score) return null;
  return <section className={styles.score} aria-label="AI PEET recommendation"><h3>AI PEET recommendation · {peetScorePercent(score).toFixed(1)}/100</h3>
    <dl className={styles.dimensions}>{pillars.map(pillar => <div key={pillar}><dt>{pillar[0].toUpperCase() + pillar.slice(1)}</dt><dd>{score[pillar].toFixed(1)}<span> / 4</span></dd></div>)}</dl>
    <p className={styles.copy}>{score.justification}</p><p className={styles.hint}>3.0 = Meets Expectations = 85%. A 3.5 average earns 92.5%. The three dimensions are averaged and converted to a percentage; the AI recommendation requires human approval.</p>
  </section>;
}
export function PeetReviewForm({ task, actorId, onSaved, onBusyChange }: { task: PeetTask; actorId: string; onSaved: (task: PeetTask) => void; onBusyChange?: (busy: boolean) => void }) {
  const [notes, setNotes] = useState(task.reviewer_notes);
  const ownQuestions = task.questions_by === actorId;
  const [answers, setAnswers] = useState(ownQuestions ? task.reviewer_answers : []);
  const [scores, setScores] = useState<PeetScores>({ efficiency: task.recommendation?.efficiency ?? 3, effectiveness: task.recommendation?.effectiveness ?? 3, time: task.recommendation?.time ?? 3 });
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const locked = useRef(false);
  const questions = ownQuestions ? task.reviewer_assessment?.reviewerQuestions ?? [] : [];
  const notesChanged = notes.trim() !== task.reviewer_notes;
  const answersChanged = questions.some((_, i) => (answers[i] || "").trim() !== task.reviewer_answers[i]);
  const canApprove = !!task.recommendation && task.reviewed_by === actorId && ownQuestions && !notesChanged && !answersChanged;
  const overridden = !!task.recommendation && pillars.some(pillar => scores[pillar] !== task.recommendation![pillar]);
  async function run(endpoint: string, body: unknown) {
    if (locked.current) return;
    locked.current = true; setBusy(endpoint); onBusyChange?.(true); setError("");
    try { onSaved(await saveTask(endpoint, body)); }
    catch (error) { setError(error instanceof Error ? error.message : "Could not save the review."); }
    finally { locked.current = false; setBusy(""); onBusyChange?.(false); }
  }
  return <section className={styles.review} aria-label="Reviewer clarification and scoring">
    <p className={styles.eyebrow}>2 · Reviewer clarification</p>
    <p className={styles.hint}>Task details, submitter answers, and your notes and answers are sent to Groq for AI-assisted review. Avoid sensitive personal information. Verify recommendations against the actual work; AI can make mistakes and cannot open supporting links.</p>
    <form onSubmit={event => { event.preventDefault(); void run("clarify-review", { taskId: task.id, version: task.version, reviewerNotes: notes }); }} className={styles.form}><fieldset disabled={!!busy}>
      <label>Reviewer Notes/Observation <span className={styles.hint}>(optional; visible to the submitter)</span><textarea value={notes} onChange={event => setNotes(event.target.value)} maxLength={3000} rows={3} placeholder="What were the goals, and how did the deliverables compare with your expectations?" /></label>
      <button type="submit" className={styles.secondary}>{busy === "clarify-review" ? "Preparing reviewer questions…" : questions.length ? "Refresh reviewer questions" : "Get reviewer questions"}</button>
    </fieldset></form>
    {!ownQuestions && task.reviewer_assessment && <p className={styles.hint}>Another reviewer began this review. Generate your own questions to record your observations before scoring.</p>}
    {notesChanged && <p role="status" className={styles.hint}>Refresh reviewer questions to include your changed observations.</p>}
    {questions.length > 0 && <form className={styles.form} onSubmit={event => { event.preventDefault(); void run("evaluate-review", { taskId: task.id, version: task.version, answers }); }}>
      <h3>Clarify goals and assess the deliverables</h3><p className={styles.hint}>{task.reviewer_assessment?.reviewContextSummary}</p><fieldset disabled={!!busy || notesChanged}>
        {questions.map((question, i) => <label key={i}>{question}<textarea required rows={3} maxLength={2000} name={`reviewer-answer-${i}`} value={answers[i] || ""} onChange={event => setAnswers(current => questions.map((_, j) => j === i ? event.target.value : current[j] || ""))} /></label>)}
        <button type="submit" className={styles.primary}>{busy === "evaluate-review" ? "Calculating PEET scores…" : "Calculate AI PEET Score"}</button>
      </fieldset>
    </form>}
    {task.recommendation && <><PeetScoreBreakdown task={task} />
      {(answersChanged || notesChanged) && <p role="status" className={styles.hint}>Recalculate with your saved clarification answers before approving.</p>}
      {ownQuestions && task.reviewed_by === actorId && <form className={styles.form} onSubmit={event => { event.preventDefault(); void run("approve", { taskId: task.id, version: task.version, scores, overrideReason: reason }); }}>
        <p className={styles.eyebrow}>3 · Review and approve</p><h3>Edit the recommended scores if needed</h3><fieldset disabled={!!busy || !canApprove}>
          <div className={styles.dimensions}>{pillars.map(pillar => <label key={pillar}>{pillar[0].toUpperCase() + pillar.slice(1)}<input type="number" name={pillar} min={1} max={4} step={0.1} required value={Number.isFinite(scores[pillar]) ? scores[pillar] : ""} onChange={event => setScores(current => ({ ...current, [pillar]: event.target.value === "" ? NaN : Number(event.target.value) }))} /></label>)}</div>
          {overridden && <label>Reason for score adjustment<textarea required value={reason} onChange={event => setReason(event.target.value)} maxLength={2000} rows={2} /></label>}
          <button type="submit" className={styles.primary}>{busy === "approve" ? "Approving…" : "Approve PEET Evaluation"}</button>
        </fieldset>
      </form>}
    </>}
    {error && <p role="alert" className={styles.error}>{error}</p>}
  </section>;
}


function ContributionManualReview({ task, onComplete, onBusyChange }: { task: PeetTask; onComplete: (message: string) => void; onBusyChange: (busy: boolean) => void }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const locked = useRef(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (locked.current) return;
    locked.current = true; setBusy(true); onBusyChange(true); setError("");
    const fields = new FormData(event.currentTarget);
    try {
      const { error } = await createClient().rpc("evaluate_officer_contribution", { p_task_id: task.task_id, p_officer_id: task.student_id, p_version: task.version,
        p_efficiency: Number(fields.get("efficiency")), p_effectiveness: Number(fields.get("effectiveness")), p_time: Number(fields.get("time")), p_feedback: fields.get("feedback") });
      if (error) throw new Error(error.message || "Could not save this contribution evaluation.");
      onComplete(`${task.student_name}’s individual PEET evaluation saved.`);
    } catch (error) { setError(error instanceof Error ? error.message : "Could not save evaluation."); }
    finally { locked.current = false; setBusy(false); onBusyChange(false); }
  }
  return <details className={styles.manual}><summary>Enter individual PEET scores manually</summary><form className={styles.form} onSubmit={submit}><p>Score only {task.student_name}’s contribution. Other participants are evaluated separately.</p><fieldset disabled={busy}>{pillars.map(pillar => <label key={pillar}>{pillar}<input type="number" name={pillar} required min="1" max="4" step="0.1" defaultValue={task.approved_scores?.[pillar]} /></label>)}<label>Contribution feedback<textarea name="feedback" required maxLength={10000} rows={3} /></label><button className={styles.primary}>Save this officer’s evaluation</button></fieldset>{error && <p role="alert">{error}</p>}</form></details>;
}
