"use client";

import ActionError from "@/components/ActionError";

import GEAOneBadge from "@/components/GEAOneBadge";

import { useEffect, useRef, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { peetError, canEditOfficerTask, selfTaskDeadlineBounds, peetSummary, productLink, taskAverage, type OfficerProfile, type OfficerTask, type PeetEvaluation, type TaskCancellationRequest, taskOfficers } from "@/lib/peet";
import Modal from "./Modal";
import PeetExplainer from "./PeetExplainer";
import styles from "./officerboard.module.css";
import TrackingPanel from "./TrackingPanel";
import OfficerRoster from "./OfficerRoster";
import OfficerTaskSubmission from "./OfficerTaskSubmission";
import OfficerTaskHistory from "./OfficerTaskHistory";
import OfficerTopicNavigation, { type OfficerTopic } from "./OfficerTopicNavigation";
import { CONTRACT_YEAR, durationLabel, trackingSummary, type TrackingData } from "@/lib/officer-tracking";
import AccountsPanel from "./AccountsPanel";
import AdminTabs, { type AdminSectionKey } from "@/components/admin/AdminTabs";

type Action = { kind: "add" } | { kind: "edit" | "submit" | "cancel" | "review"; task: OfficerTask } | { kind: "cancellationReview"; task: OfficerTask; request: TaskCancellationRequest };
const statusLabels = { in_progress: "In progress", submitted: "Awaiting review", completed: "Completed" };
function dateLabel(value: string | null) {
  if (!value) return "No deadline";
  return new Date(value.length === 10 ? `${value}T12:00:00` : value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function OfficerBoard({ profile, profiles, tasks, evaluations, tracking, cancellationRequests = [], isSuperAdmin = false, embedded = false }: {
  embedded?: boolean;
  profile: OfficerProfile; profiles: OfficerProfile[]; tasks: OfficerTask[]; evaluations: PeetEvaluation[]; tracking: TrackingData; isSuperAdmin?: boolean; cancellationRequests?: TaskCancellationRequest[];
}) {
  const router = useRouter();
  const [explainer, setExplainer] = useState(false);
  const [action, setAction] = useState<Action | null>(null);
  const [selectedOfficer, setSelectedOfficer] = useState(isSuperAdmin || profile.role === "admin" ? "all" : profile.id);
  const [rosterSearch, setRosterSearch] = useState("");
  const [assignmentSearch, setAssignmentSearch] = useState("");
  const [assignees, setAssignees] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [refreshing, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [view, setView] = useState<"dashboard" | "roster" | "accounts" | "site">("dashboard");
  const [rosterDirty, setRosterDirty] = useState(false);
  const [topic, setTopic] = useState<OfficerTopic>("overview");
  const [academicYear, setAcademicYear] = useState(CONTRACT_YEAR);
  const studentHeading = useRef<HTMLHeadingElement>(null);
  const [siteSection, setSiteSection] = useState<AdminSectionKey>("website");
  const admin = isSuperAdmin || profile.role === "admin";
  const busy = saving || refreshing;
  const editingSelfTask = action?.kind === "edit" && action.task.created_by === profile.id && action.task.assigned_to === profile.id;
  const deadlineBounds = editingSelfTask && action?.kind === "edit" ? selfTaskDeadlineBounds(action.task.original_due_date) : null;
  const officers = taskOfficers(profiles);
  const overview = selectedOfficer === "all";
  const visibleTasks = tasks.filter(task => overview ? officers.some(person => person.id === task.assigned_to) : task.assigned_to === selectedOfficer);
  const matchingOfficers = (search: string) => officers.filter(person => `${person.name} ${person.email ?? ""} ${person.position ?? ""}`.toLowerCase().includes(search.toLowerCase()));
  const identity = (person: OfficerProfile) => person.email || `${person.position || "Officer"} · ${person.id.slice(0,8)}`;
  const selectedPerson = profiles.find(person => person.id === selectedOfficer);
  const recordSummary = trackingSummary(tracking, selectedOfficer, academicYear);
  const years = [...new Set([CONTRACT_YEAR,...tracking.events.map(event => event.academic_year),...tracking.strikes.map(strike => strike.academic_year)])].sort().reverse();
  const selectedRequests = cancellationRequests.filter(request => request.requested_by === selectedOfficer);
  function chooseOfficer(id: string) { setSelectedOfficer(id); if (id === "all") setTopic("overview"); setView("dashboard"); setError(null); setNotice(""); }
  function chooseTopic(next: OfficerTopic) { setTopic(next); setNotice(""); setError(null); studentHeading.current?.scrollIntoView({block:"start"}); }
  useEffect(() => { if (view === "dashboard" && selectedOfficer !== "all") studentHeading.current?.focus(); }, [selectedOfficer,view]);
  const summary = peetSummary(visibleTasks, evaluations);
  const evaluationFor = (task: OfficerTask) => evaluations.find(evaluation => evaluation.task_id === task.id);
  const ownerName = (task: OfficerTask) => { const person = profiles.find(person => person.id === task.assigned_to); return person ? `${person.name}${person.email ? ` (${person.email})` : ""}` : "Officer"; };
  const reviewQueue = admin ? tasks.filter(task => task.assigned_to === selectedOfficer && !task.cancelled_at && task.status === "submitted") : [];
  const canEvaluate = (task: OfficerTask) => isSuperAdmin || profile.reviewer_kind === "advisor" || profiles.find(person => person.id === task.assigned_to)?.reviewer_kind !== "president";

  useEffect(() => {
    if (!profile.peet_onboarding_seen_at) setExplainer(true);
  }, [profile.id, profile.peet_onboarding_seen_at]);
  useEffect(() => {
    const refresh = () => { if (!document.hidden) startTransition(() => router.refresh()); };
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, [router]);
  async function closeExplainer() {
    setExplainer(false);
    if (!profile.peet_onboarding_seen_at) await mutate("mark_peet_onboarding_seen", {}, "PEET introduction saved.");
  }
  function openAction(next: Action) { setError(null); setNotice(""); setAssignmentSearch(""); setAssignees(next.kind === "edit" ? [next.task.assigned_to] : officers.some(person => person.id === selectedOfficer) ? [selectedOfficer] : []); setAction(next); }
  async function mutate(name: string, args: Record<string, unknown>, message: string) {
    setSaving(true); setError(null); setNotice("");
    try {
      const { error: rpcError } = await createClient().rpc(name, args);
      if (rpcError) { setError(peetError(rpcError)); return; }
      setAction(null); setNotice(message);
      startTransition(() => router.refresh());
    } catch { setError(peetError(null)); }
    finally { setSaving(false); }
  }
  async function saveTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    if (action?.kind === "add") {
      if (admin && !assignees.length) { setError("Choose at least one officer."); return; }
      await mutate("assign_officer_tasks", { p_title: fields.get("title"), p_description: fields.get("description"), p_due_date: fields.get("due_date") || null, p_assignees: admin ? assignees : [profile.id] }, "Tasks assigned. Each officer has their own submission and evaluation.");
    } else if (action?.kind === "edit") {
      await mutate("save_officer_task", { p_title: editingSelfTask ? action.task.title : fields.get("title"), p_description: fields.get("description"), p_due_date: editingSelfTask && !deadlineBounds ? action.task.due_date : fields.get("due_date") || null, p_assigned_to: editingSelfTask ? action.task.assigned_to : admin ? assignees[0] : profile.id, p_task_id: action.task.id }, "Task saved.");
    }
  }
  async function submitProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (action?.kind !== "submit") return;
    const fields = new FormData(event.currentTarget);
    const description = String(fields.get("submission_description") ?? "").trim();
    const rawUrl = String(fields.get("url") ?? "").trim();
    const url = productLink(rawUrl);
    if (rawUrl && !url) { setError("Enter a valid HTTP or HTTPS link, or leave the link blank."); return; }
    if (!description && !url) { setError("Describe the completed work or add a link."); return; }
    await mutate("submit_officer_task", { p_task_id: action.task.id, p_url: url, p_description: description }, "Work submitted for review.");
  }
  async function saveEvaluation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (action?.kind !== "review") return;
    const fields = new FormData(event.currentTarget);
    await mutate("evaluate_officer_task", {
      p_task_id: action.task.id, p_efficiency: Number(fields.get("efficiency")),
      p_effectiveness: Number(fields.get("effectiveness")), p_time: Number(fields.get("time")),
      p_feedback: fields.get("feedback"),
    }, "Evaluation saved. The officer’s PEET score has been updated.");
  }
  function workLink(task: OfficerTask) {
    return <OfficerTaskSubmission task={task} />;
  }

  return <div className={`${styles.board} ${embedded ? styles.embedded : ""}`}>
    <header className={styles.header}>
      {!embedded && <GEAOneBadge size="compact" />}
      <div><p className={styles.eyebrow}>Tasks, progress &amp; participation</p>{embedded ? <h2 className={styles.boardTitle}>Officer accountability</h2> : <h1>Officer Board</h1>}</div>
      <div className={styles.actions}>
        <button className={styles.secondary} onClick={() => setExplainer(true)} disabled={busy}>What is PEET?</button>
        {view === "dashboard" && <button className={styles.primary} onClick={() => openAction({ kind: "add" })} disabled={busy}>{admin ? "Assign task" : "Add task"}</button>}
      </div>
    </header>
    {admin && <div className={styles.workspaceTools} aria-label="Workspace navigation"><button className={styles.secondary} disabled={rosterDirty} aria-pressed={view === "dashboard"} onClick={() => chooseOfficer("all")}>Officer directory</button><button className={styles.secondary} aria-pressed={view === "roster"} onClick={()=>{setView("roster");setNotice("");setError(null);}}>Team roster</button>{isSuperAdmin && <details className={styles.adminTools}><summary>Administration</summary><div><button disabled={rosterDirty} onClick={event => {setView("accounts"); event.currentTarget.closest("details")?.removeAttribute("open");}}>Manage GEA One accounts</button>{!embedded && <button disabled={rosterDirty} onClick={event => {setView("site"); event.currentTarget.closest("details")?.removeAttribute("open");}}>Website admin</button>}</div></details>}</div>}

    <p role="status" className={styles.notice}>{notice || (refreshing ? "Updating your board…" : "")}</p>
    {error && !action && <ActionError message={error} className={styles.error} />}
    {tracking.strikes.some(strike => strike.officer_id === profile.id && strike.status === "notified") && <p className={styles.warning} role="status">You have an accountability concern awaiting a response. <button className={styles.link} disabled={rosterDirty} onClick={() => { chooseOfficer(profile.id); setTopic("accountability"); }}>Review and explain your circumstances →</button></p>}
    <div className={`${styles.studentWorkspace} ${view === "dashboard" && !overview && admin ? styles.withStudent : ""}`}>
    {admin && view === "dashboard" && <aside className={styles.roster} aria-label="Officer roster">
      <div className={styles.sectionHeading}><div><h2>Officers</h2><p>{overview ? "Choose a name, then choose a topic." : "Choose another officer."}</p></div><span className={styles.badge}>{isSuperAdmin ? "Super admin" : "PEET reviewer"}</span></div>
      <label className={styles.search}>Search officers<input type="search" value={rosterSearch} onChange={event => setRosterSearch(event.target.value)} placeholder="Name, email, or position" /></label>
      <div className={styles.rosterGrid}>
      {matchingOfficers(rosterSearch).map(person => { const progress = peetSummary(tasks.filter(task => task.assigned_to === person.id), evaluations); const waiting = tasks.filter(task => task.assigned_to === person.id && !task.cancelled_at && task.status === "submitted").length + cancellationRequests.filter(request => request.requested_by === person.id && request.status === "pending").length + tracking.volunteerLogs.filter(log => log.officer_id === person.id && log.status === "pending").length; return <button className={styles.personCard} aria-pressed={selectedOfficer === person.id} key={person.id} onClick={() => chooseOfficer(person.id)}><strong>{person.name}{person.id === profile.id ? " (you)" : ""}</strong><span>{identity(person)}</span><span>{person.position || "Officer"} · {progress.active} active · PEET {progress.score === null ? "—" : `${progress.score.toFixed(1)}/100`}</span>{waiting > 0 && <span>{waiting} awaiting review</span>}</button>; })}</div>
      {matchingOfficers(rosterSearch).length === 0 && <p className={styles.empty}>No officers match your search.</p>}
    </aside>}
    <div className={styles.studentContent}>
    {view === "dashboard" && !overview && <>
      <header className={styles.studentContext}>
        <div className={styles.profileBar}><div className={styles.studentIdentity}><h2 ref={studentHeading} tabIndex={-1}>{selectedPerson?.name ?? profile.name}</h2><p>{selectedPerson?.position || "Officer"}{selectedPerson?.email ? ` · ${selectedPerson.email}` : ""}</p></div><OfficerTopicNavigation topic={topic} onSelect={chooseTopic} pending={{tasks:reviewQueue.length + selectedRequests.filter(request => request.status === "pending").length,volunteer:tracking.volunteerLogs.filter(log => log.officer_id === selectedOfficer && log.status === "pending" && tracking.events.some(event => event.id === log.event_id && event.academic_year === academicYear)).length,accountability:tracking.strikes.filter(strike => strike.officer_id === selectedOfficer && strike.status === "notified" && strike.academic_year === academicYear).length}} />{admin && <button className={`${styles.secondary} ${styles.changeOfficer}`} onClick={() => chooseOfficer("all")}>Change officer</button>}</div>
        <div className={styles.contextScope}>{topic === "tasks" ? <p>Cumulative PEET and task history · all school years</p> : <label className={styles.yearPicker}>Academic year<select aria-label="Academic year" value={academicYear} onChange={event => setAcademicYear(event.target.value)}>{years.map(year => <option key={year}>{year}</option>)}</select></label>}</div>
      </header>
      {topic === "overview" && <div className={styles.metrics}>
      {!overview && <section className={styles.scoreCard} aria-labelledby="peet-score-label">
        <h2 id="peet-score-label">Total PEET Score</h2>
        <p className={styles.score}>{summary.score === null ? "—" : summary.score.toFixed(1)}<span>/100</span></p>
        <p>{summary.score === null ? "Your first evaluation starts the picture." : summary.score >= 75 ? "Meets Expectations or above" : "Below Meets Expectations"}</p>
        <div className={styles.scoreTrack} data-status={summary.score === null ? "pending" : summary.score >= 75 ? "meets" : "below"} aria-hidden="true"><span style={{ width: `${summary.score ?? 0}%` }} /></div>
        <p className={styles.scoreNote}>{summary.evaluated} evaluated {summary.evaluated === 1 ? "task" : "tasks"} · 75 is Meets Expectations</p>
      </section>}
      <section className={styles.metric}><h2>Active Tasks</h2><p>{summary.active}</p><span>In progress or awaiting review</span></section>
      <section className={styles.metric}><h2>Completed Tasks</h2><p>{summary.completed}</p><span>Work reviewed and evaluated</span></section>
    </div>}
    {topic === "overview" && <div className={styles.studentStats}>
      <article><h3>Meeting attendance</h3><strong>{recordSummary.present}</strong><p>{recordSummary.excused} excused · {recordSummary.unexcused} unexcused</p></article>
      <article><h3>Volunteer time</h3><strong>{durationLabel(recordSummary.volunteerMinutes)}</strong><p>{recordSummary.volunteerEvents}/2 approved events</p></article>
      <article><h3>Attendance strikes</h3><strong>{recordSummary.attendanceStrikes}/3</strong><p>Confirmed in {academicYear}</p></article>
      <article><h3>Conduct strikes</h3><strong>{recordSummary.conductStrikes}/3</strong><p>Confirmed in {academicYear}</p></article>
    </div>}

    </>}
    {admin && view === "roster" && <OfficerRoster profiles={profiles} data={tracking} year={academicYear} years={years} onYearChange={setAcademicYear} onOpenOfficer={chooseOfficer} onDirtyChange={setRosterDirty} />}
    {isSuperAdmin && view === "accounts" && <AccountsPanel actorId={profile.id} />}
    {!embedded && isSuperAdmin && view === "site" && <div className="mt-8"><AdminTabs section={siteSection} onSectionChange={setSiteSection} /></div>}
    {view === "dashboard" && !overview && topic === "tasks" && <>
    <div className={styles.taskSummary} aria-label="Task summary"><article><h3>PEET /100</h3><strong>{summary.score === null ? "—" : summary.score.toFixed(1)}</strong></article><article><h3>Active</h3><strong>{summary.active}</strong></article><article><h3>Completed</h3><strong>{summary.completed}</strong></article></div>
    <div className={styles.topicHeading}><div><h2>Tasks & PEET</h2><p>Manage assignments, submissions, and evaluations.</p></div><button className={styles.primary} onClick={() => openAction({kind:"add"})} disabled={busy}>+ Add Task</button></div>
    {selectedRequests.length > 0 && <section className={styles.section} aria-labelledby="cancellation-heading"><div className={styles.sectionHeading}><div><h2 id="cancellation-heading">Cancellation requests</h2><p>Tasks stay active while a request is pending. A different reviewer must approve cancellation.</p></div></div>
      {selectedRequests.length === 0 ? <p className={styles.empty}>No cancellation requests.</p> : <div className={styles.taskList}>{selectedRequests.map(request => { const task = tasks.find(task => task.id === request.task_id); return <article key={request.id} className={styles.taskRow}><div><span className={styles.badge}>{request.status}</span><h3>{task?.title || "Task"}</h3><p>{task && ownerName(task)} · {dateLabel(request.created_at)}</p><p>{request.reason}</p>{request.review_notes && <p>Reviewer: {request.review_notes}</p>}</div>{admin && request.status === "pending" && task && (request.requested_by === profile.id || task.assigned_to === profile.id ? <span className={styles.badge}>Another reviewer required</span> : <button className={styles.secondary} disabled={busy} onClick={() => openAction({kind:"cancellationReview",task,request})}>Review request<span className="sr-only"> for {task.title}</span></button>)}</article>; })}</div>}
    </section>}
    {admin && reviewQueue.length > 0 && <section className={styles.section} aria-labelledby="peet-review-heading">
      <div className={styles.sectionHeading}><div><p className={styles.eyebrow}>Executive leadership & advisors</p><h2 id="peet-review-heading">Ready for review</h2></div><span className={styles.badge}>{reviewQueue.length} submitted</span></div>
      {reviewQueue.length === 0 ? <p className={styles.empty}>You’re all caught up. Submitted work from this officer will appear here.</p> : <div className={styles.taskList}>
        {reviewQueue.map(task => <article className={styles.taskRow} key={task.id}>
          <div><h3>{task.title}</h3><p>{ownerName(task)} · Submitted {dateLabel(task.submitted_at)}</p>{workLink(task)}</div>
          {canEvaluate(task) ? <button className={styles.primary} disabled={busy} onClick={() => openAction({ kind: "review", task })}>Evaluate<span className="sr-only"> {task.title}</span></button> : <span className={styles.badge}>Advisor review required</span>}
        </article>)}
      </div>}
    </section>}

    <section className={styles.section} aria-labelledby="peet-active-heading">
      <div className={styles.sectionHeading}><div><h2 id="peet-active-heading">Active tasks</h2><p>Keep your work moving, then share the finished product.</p></div></div>
      {summary.active === 0 ? <div className={styles.empty}><h3>A little initiative goes a long way.</h3><p>Add a task to log what you’re working on.</p></div> : <div className={styles.taskList}>
        {visibleTasks.filter(task => !task.cancelled_at && task.status !== "completed").map(task => <article className={styles.taskRow} key={task.id}>
          <div className={styles.taskCopy}><span className={styles.badge}>{statusLabels[task.status]}</span><h3>{task.title}</h3><p>{task.description}</p><p className={styles.taskMeta}>{overview ? `${ownerName(task)} · ` : ""}Due: {dateLabel(task.due_date)}</p>{workLink(task)}</div>
          <div className={styles.actions}>
            {task.status === "in_progress" && task.assigned_to === profile.id && <button className={styles.primary} disabled={busy} onClick={() => openAction({ kind: "submit", task })}>Submit work<span className="sr-only"> for {task.title}</span></button>}
            {canEditOfficerTask(task, profile.id) && <>
              <button className={styles.secondary} disabled={busy} onClick={() => openAction({ kind: "edit", task })}>Edit<span className="sr-only"> {task.title}</span></button>
            </>}
              <button className={styles.secondary} disabled={busy || cancellationRequests.some(request => request.task_id === task.id && request.status === "pending")} onClick={() => openAction({ kind: "cancel", task })}>{task.assigned_to === profile.id ? "Request cancellation" : "Cancel task"}<span className="sr-only"> {task.title}</span></button>
          </div>
        </article>)}
      </div>}
    </section>

    <OfficerTaskHistory tasks={visibleTasks} evaluations={evaluations} admin={admin} actorId={profile.id} busy={busy} canEvaluate={canEvaluate} onReview={task => openAction({kind:"review",task})} onCancel={task => openAction({kind:"cancel",task})} />
    {visibleTasks.some(task => task.cancelled_at) && <section className={styles.section}><div className={styles.sectionHeading}><div><h2>Cancelled tasks</h2><p>Preserved for accountability; excluded from active tasks and PEET totals.</p></div></div><div className={styles.taskList}>{visibleTasks.filter(task => task.cancelled_at).map(task => <article className={styles.taskRow} key={task.id}><div><h3>{task.title}</h3><p>{ownerName(task)} · Cancelled {dateLabel(task.cancelled_at ?? null)}</p><p>{task.cancellation_reason}</p>{evaluationFor(task) && <p>Previous PEET average: {taskAverage(evaluationFor(task)!).toFixed(2)}/4 · {evaluationFor(task)?.feedback_notes}</p>}{workLink(task)}</div></article>)}</div></section>}
    </>}
    {view === "dashboard" && !overview && topic !== "overview" && topic !== "tasks" && <section className={styles.dashboardSection} aria-labelledby="selected-topic-heading"><h2 id="selected-topic-heading">{topic === "attendance" ? "Attendance" : topic === "volunteer" ? "Volunteer service" : "Accountability & notes"}</h2><TrackingPanel key={`${selectedOfficer}-${topic}`} mode={topic} profile={profile} profiles={profiles} officerId={selectedOfficer} data={tracking} isSuperAdmin={isSuperAdmin} embedded academicYear={academicYear} showMetrics /></section>}
    </div></div>

    {explainer && <PeetExplainer onClose={closeExplainer} />}
    {action && <Modal title={action.kind === "add" ? "Add task" : `${action.kind === "cancellationReview" ? "Review cancellation" : action.kind === "cancel" ? "Cancel" : action.kind} task: ${action.task.title}`} busy={busy} onClose={() => setAction(null)}>
      {error && <ActionError message={error} className={styles.error} />}
      {(action.kind === "add" || action.kind === "edit") && <form onSubmit={saveTask} className={styles.form}>
        <h2 className={styles.modalTitle}>{action.kind === "add" ? "Start with an idea." : "Edit task."}</h2>
        <p>{editingSelfTask ? "You can update the description and move the deadline up to three days before or after its original date." : "Log the work, set your goal, and give it a deadline."}</p>
        <fieldset disabled={busy}>
          <label>Task title<input name="title" readOnly={editingSelfTask} required maxLength={200} defaultValue={action.kind === "edit" ? action.task.title : ""} /></label>
          <label>Description<textarea name="description" rows={4} maxLength={10000} defaultValue={action.kind === "edit" ? action.task.description : ""} /></label>
          <label>Due date (optional)<input name="due_date" type="date" min={deadlineBounds?.min} max={deadlineBounds?.max} required={editingSelfTask && !!deadlineBounds} disabled={editingSelfTask && !deadlineBounds} defaultValue={action.kind === "edit" ? action.task.due_date ?? "" : ""} /></label>
          {editingSelfTask && !deadlineBounds && <p>No original deadline was set; only the description can be changed.</p>}
          {admin && !editingSelfTask && <div><p>{action.kind === "add" ? "Assign to officers · choose one or several" : "Assigned officer"}</p><label>Find officers<input type="search" value={assignmentSearch} onChange={event => setAssignmentSearch(event.target.value)} /></label><p>{assignees.length} selected{action.kind === "add" ? " · A separate task will be created for each officer." : ""}</p>
            {action.kind === "add" && <div className={styles.actions}><button type="button" className={styles.secondary} onClick={() => setAssignees(Array.from(new Set([...assignees,...matchingOfficers(assignmentSearch).map(person => person.id)])))}>Select matching officers</button><button type="button" className={styles.secondary} onClick={() => setAssignees([])}>Clear selection</button></div>}
            <div className={styles.assignmentList}>{matchingOfficers(assignmentSearch).map(person => <label key={person.id} className={styles.assignmentPerson}><input type={action.kind === "add" ? "checkbox" : "radio"} name="officer-choice" checked={assignees.includes(person.id)} onChange={event => setAssignees(action.kind === "edit" ? [person.id] : event.target.checked ? [...assignees,person.id] : assignees.filter(id => id !== person.id))} /><span><strong>{person.name}</strong><small>{identity(person)} · {person.position || "Officer"}</small></span></label>)}</div>
          </div>}

        </fieldset>
        <div className={styles.modalActions}><button type="button" className={styles.secondary} disabled={busy} onClick={() => setAction(null)}>Cancel</button><button className={styles.primary} disabled={busy}>{busy ? "Saving…" : "Save task"}</button></div>
      </form>}
      {action.kind === "submit" && <form onSubmit={submitProduct} className={styles.form}>
        <h2 className={styles.modalTitle}>Ready to share your work?</h2><p>{action.task.title}</p>
        <label>Work description<textarea name="submission_description" rows={5} maxLength={10000} placeholder="Describe what you did, what you accomplished, and any details your reviewer should know." disabled={busy} /></label>
        <label>Supporting link (optional)<input type="url" name="url" maxLength={2048} placeholder="https://…" disabled={busy} /></label>
        <p>Describe your completed work, add a supporting link, or both. After submission, you can no longer edit this task.</p>
        <div className={styles.modalActions}><button type="button" className={styles.secondary} disabled={busy} onClick={() => setAction(null)}>Cancel</button><button className={styles.primary} disabled={busy}>{busy ? "Submitting…" : "Submit for review"}</button></div>
      </form>}
      {action.kind === "cancel" && <form className={styles.form} onSubmit={event => { event.preventDefault(); const reason = new FormData(event.currentTarget).get("reason"); void mutate(action.task.assigned_to === profile.id ? "request_officer_task_cancellation" : "cancel_officer_task", { p_task_id: action.task.id, p_reason: reason }, action.task.assigned_to === profile.id ? "Cancellation requested. Continue the task until a reviewer approves." : "Task cancelled. Its history has been preserved."); }}>
        <h2 className={styles.modalTitle}>{action.task.assigned_to === profile.id ? "Request cancellation" : "Cancel this task"}</h2><p>{action.task.title}</p><p>{action.task.assigned_to === profile.id ? "Explain what changed and what support you need. Another reviewer must approve before this task closes." : "Record the reason. The task and its evaluation remain in the history, and cancelled tasks stop counting toward PEET."}</p>
        <label>Reason<textarea name="reason" required minLength={10} maxLength={2000} disabled={busy} rows={4} /></label><div className={styles.modalActions}><button type="button" className={styles.secondary} disabled={busy} onClick={() => setAction(null)}>Keep task</button><button className={styles.primary} disabled={busy}>{action.task.assigned_to === profile.id ? "Send request" : "Confirm cancellation"}</button></div>
      </form>}
      {action.kind === "cancellationReview" && <form className={styles.form} onSubmit={event => { event.preventDefault(); const fields = new FormData(event.currentTarget); void mutate("review_officer_task_cancellation", {p_request_id: action.request.id, p_status: fields.get("decision"), p_notes: fields.get("notes")}, "Cancellation request reviewed."); }}>
        <h2 className={styles.modalTitle}>Review cancellation</h2><p>{ownerName(action.task)} · {action.task.title}</p><p>{action.request.reason}</p><label>Decision<select name="decision" disabled={busy}><option value="rejected">Keep task · decline request</option><option value="approved">Approve cancellation</option></select></label><label>Review notes<textarea name="notes" required minLength={10} maxLength={2000} rows={4} disabled={busy} /></label><button className={styles.primary} disabled={busy}>Save decision</button>
      </form>}
      {action.kind === "review" && admin && <form onSubmit={saveEvaluation} className={styles.form}>
        <h2 className={styles.modalTitle}>{action.task.title}</h2><p>{ownerName(action.task)} · Due {dateLabel(action.task.due_date)} · Submitted {dateLabel(action.task.submitted_at)}</p>
        <p className={styles.description}>{action.task.description}</p>{workLink(action.task)}
        <fieldset disabled={busy}><legend>PEET scores · 1.0–4.0 (3.0 = Meets Expectations)</legend>
          <div className={styles.scoreInputs}>{(["efficiency", "effectiveness", "time"] as const).map(pillar => <label key={pillar}>{pillar[0].toUpperCase() + pillar.slice(1)}<input name={pillar} type="number" required min="1" max="4" step="0.1" defaultValue={evaluationFor(action.task)?.[pillar] ?? ""} /></label>)}</div>
          <label>Feedback notes<textarea name="feedback" rows={4} maxLength={10000} defaultValue={evaluationFor(action.task)?.feedback_notes ?? ""} /></label>
        </fieldset>
        <p>Saving completes the task and updates this officer’s overall PEET score. Adjustments replace the previous scores for this task.</p>
        <div className={styles.modalActions}><button type="button" className={styles.secondary} disabled={busy} onClick={() => setAction(null)}>Cancel</button><button className={styles.primary} disabled={busy}>{busy ? "Saving…" : "Save evaluation"}</button></div>
      </form>}
    </Modal>}
  </div>;
}
