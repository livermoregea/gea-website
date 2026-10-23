"use client";
import { dispatchDiscordNotifications } from '@/lib/discord-notifications';

import WorkspaceActivity from "@/components/WorkspaceActivity";
import ActionError from "@/components/ActionError";

import GEAOneBadge from "@/components/GEAOneBadge";

import { useContext, useEffect, useRef, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { peetError, needsTaskContribution, taskCompleteFor, evaluationForOfficer, officerTaskPeople, isOfficerTaskParticipant, canEditOfficerTask, selfTaskDeadlineBounds, peetSummary, productLink, taskAverage, type TaskTeammate, type OfficerProfile, type OfficerTask, type PeetEvaluation, type TaskCancellationRequest, taskOfficers } from "@/lib/peet";
import { emptyTaskDraft, readTaskDraft, writeTaskDraft, clearTaskDraft } from "@/lib/officer-task-draft";
import { sortOfficerTasks } from "@/lib/officer-dashboard";
import Modal from "./Modal";
import PeetExplainer from "./PeetExplainer";
import styles from "./officerboard.module.css";
import TrackingPanel from "./TrackingPanel";
import OfficerRoster from "./OfficerRoster";
import OfficerTaskSubmission from "./OfficerTaskSubmission";
import OfficerTaskPeet from "./OfficerTaskPeet";
import OfficerTaskHistory from "./OfficerTaskHistory";
import TaskSection from "./TaskSection";
import TaskPeoplePicker from "./TaskPeoplePicker";
import OfficerTopicNavigation, { type OfficerTopic } from "./OfficerTopicNavigation";
import { CONTRACT_YEAR, durationLabel, schoolToday, trackingSummary, type TrackingData } from "@/lib/officer-tracking";
import AccountsPanel from "./AccountsPanel";
import AdminTabs, { type AdminSectionKey } from "@/components/admin/AdminTabs";
import { WorkspaceNavigationContext } from "@/lib/workspace-navigation-context";
import { officerRecordTarget } from "@/lib/officer-workspace-navigation";

type Action = { kind: "add" } | { kind: "edit" | "submit" | "cancel" | "review" | "end" | "people"; task: OfficerTask } | { kind: "cancellationReview"; task: OfficerTask; request: TaskCancellationRequest };
const statusLabels = { in_progress: "In progress", submitted: "Awaiting review", completed: "Completed" };
function dateLabel(value: string | null) {
  if (!value) return "No deadline";
  return new Date(value.length === 10 ? `${value}T12:00:00` : value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function OfficerBoard({ profile, profiles, tasks, evaluations, tracking, cancellationRequests = [], isSuperAdmin = false, embedded = false, unified = false, teammates = [], clarificationTaskIds = [] }: {
  unified?: boolean; embedded?: boolean; teammates?: TaskTeammate[]; clarificationTaskIds?: string[];
  profile: OfficerProfile; profiles: OfficerProfile[]; tasks: OfficerTask[]; evaluations: PeetEvaluation[]; tracking: TrackingData; isSuperAdmin?: boolean; cancellationRequests?: TaskCancellationRequest[];
}) {
  const router = useRouter();
  const workspace = useContext(WorkspaceNavigationContext);
  const section = workspace?.view;
  const [explainer, setExplainer] = useState(false);
  const [action, setAction] = useState<Action | null>(null);
  const [taskDraft, setTaskDraft] = useState(emptyTaskDraft());
  const [selectedOfficer, setSelectedOfficer] = useState(section === "accountability" ? profile.id : isSuperAdmin || profile.role === "admin" ? "all" : profile.id);
  const [rosterSearch, setRosterSearch] = useState("");
  const [taskSearch, setTaskSearch] = useState("");
  const [assignmentSearch, setAssignmentSearch] = useState("");
  const [assignees, setAssignees] = useState<string[]>([]);
  const [taskPeople, setTaskPeople] = useState<string[]>([]);
  const [createSharedTask, setCreateSharedTask] = useState(false);
  const [saving, setSaving] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [endWithScore, setEndWithScore] = useState(false);
  const [refreshing, startTransition] = useTransition();
  const [backgroundRefreshing, startBackgroundRefresh] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [localView, setView] = useState<"dashboard" | "roster" | "accounts" | "site">("dashboard");
  const [rosterDirty, setRosterDirty] = useState(false);
  const [localTopic, setTopic] = useState<OfficerTopic>("overview");
  const [academicYear, setAcademicYear] = useState(CONTRACT_YEAR);
  const linkedTaskOpened = useRef<string | null>(null);
  const studentHeading = useRef<HTMLHeadingElement>(null);
  const [siteSection, setSiteSection] = useState<AdminSectionKey>("website");
  const admin = isSuperAdmin || profile.role === "admin";
  const busy = saving || refreshing || aiBusy;
  const view = admin && (section === "attendance" || section === "volunteer") ? "roster" : section === "accounts" ? "accounts" : section === "tasks" || section === "people" || section === "accountability" || section === "conduct" ? "dashboard" : localView;
  const topic = section === "accountability" || section === "conduct" ? "accountability" : section === "tasks" ? "tasks" : !admin && (section === "attendance" || section === "volunteer") ? section : section === "people" && localTopic === "tasks" ? "overview" : localTopic;
  const editingSelfTask = action?.kind === "edit" && action.task.created_by === profile.id && action.task.assigned_to === profile.id;
  const deadlineBounds = editingSelfTask && action?.kind === "edit" ? selfTaskDeadlineBounds(action.task.original_due_date) : null;
  const today = schoolToday();
  const deadlineLocked = editingSelfTask && (!deadlineBounds || deadlineBounds.max < today);
  const minimumDueDate = deadlineBounds && deadlineBounds.min > today ? deadlineBounds.min : today;
  const officers = taskOfficers(profiles);
  const overview = selectedOfficer === "all";
  const visibleTasks = tasks.filter(task => overview ? officers.some(person => person.id === task.assigned_to) : isOfficerTaskParticipant(task, selectedOfficer));
  const matchingOfficers = (search: string) => officers.filter(person => `${person.name} ${person.email ?? ""} ${person.position ?? ""}`.toLowerCase().includes(search.toLowerCase()));
  const identity = (person: OfficerProfile) => person.email || `${person.position || "Officer"} · ${person.id.slice(0,8)}`;
  const selectedPerson = profiles.find(person => person.id === selectedOfficer);
  const pendingExplanation = tracking.strikes.find(strike => strike.officer_id === profile.id && strike.status === "notified" && !strike.responded_at);
  const recordSummary = trackingSummary(tracking, selectedOfficer, academicYear);
  const years = [...new Set([CONTRACT_YEAR,...tracking.events.map(event => event.academic_year),...tracking.strikes.map(strike => strike.academic_year)])].sort().reverse();
  const selectedRequests = cancellationRequests.filter(request => tasks.some(task => task.id === request.task_id && (overview || isOfficerTaskParticipant(task, selectedOfficer))));
  function chooseOfficer(id: string) { if (workspace && section !== "tasks" && section !== "people" && section !== "conduct") workspace.navigate("people"); setSelectedOfficer(id); setTaskSearch(""); if (id === "all" || section === "attendance" || section === "volunteer") setTopic("overview"); setView("dashboard"); setError(null); setNotice(""); }
  function chooseTopic(next: OfficerTopic) { if (workspace && (!admin || next === "tasks")) workspace.navigate(next === "overview" ? "people" : next); setTopic(next); setNotice(""); setError(null); studentHeading.current?.scrollIntoView({block:"start"}); }
  useEffect(() => {
    // Returning through the main menu opens the summary; old concern links
    // keep their explicit topic and still resolve to the officer's own record.
    if (workspace && !admin && section === "people" && !new URLSearchParams(window.location.search).get("topic")) setTopic("overview");
  }, [section, admin, workspace]);
  useEffect(() => { if (view === "dashboard" && selectedOfficer !== "all") studentHeading.current?.focus(); }, [selectedOfficer,view]);
  const summary = peetSummary(visibleTasks, evaluations, overview ? undefined : selectedOfficer);
  const evaluationFor = (task: OfficerTask) => evaluationForOfficer(evaluations, task.id, overview ? undefined : selectedOfficer);
  const ownerName = (task: OfficerTask) => { const person = profiles.find(person => person.id === task.assigned_to) ?? teammates.find(person => person.id === task.assigned_to); return person ? `${person.name}${"email" in person && person.email ? ` (${person.email})` : ""}` : "Officer"; };
  const reviewQueue = admin ? tasks.filter(task => (overview || isOfficerTaskParticipant(task, selectedOfficer)) && !task.cancelled_at && task.status === "submitted" && (!task.individual_peet || task.contributions?.some(row => row.status === "pending" && isOfficerTaskParticipant(task, row.student_id))) && !isOfficerTaskParticipant(task, profile.id)) : [];
  const canEvaluate = (task: OfficerTask) => !isOfficerTaskParticipant(task, profile.id) &&
    (isSuperAdmin || profile.reviewer_kind === "advisor" || !officerTaskPeople(task).some(id => profiles.find(person => person.id === id)?.reviewer_kind === "president"));
  const peopleNames = Object.fromEntries([...teammates, ...profiles].map(person => [person.id, person.name]));

  useEffect(() => {
    const openTarget = (force = false) => {
    const params = new URLSearchParams(window.location.search);
    const target = JSON.stringify([params.get("task"), params.get("topic"), params.get("officer"), params.get("action"), params.get("view"), params.get("event"), params.get("strike")]);
    if (!force && linkedTaskOpened.current === target) return;
    linkedTaskOpened.current = target;
    const rosterEvent = tracking.events.find(event => event.id === params.get("event"));
    if (admin && rosterEvent && ["attendance", "volunteer"].includes(params.get("view") || "")) setAcademicYear(rosterEvent.academic_year);
    const incident = tracking.strikes.find(strike => strike.id === params.get("strike") && strike.officer_id === profile.id);
    if (incident) setAcademicYear(incident.academic_year);
    const record = officerRecordTarget(params, profile.id, admin, officers.map(person => person.id));
    if (!params.get("task") && record) { setSelectedOfficer(record.officerId); setView("dashboard"); setTopic(record.topic); setTaskSearch(""); return; }
    const id = params.get("task");
    const linked = tasks.find(task => task.id === id);
    if (!linked) return;
    setSelectedOfficer(admin ? linked.assigned_to : profile.id);
    setView("dashboard"); setTopic("tasks"); setTaskSearch(linked.title);
    const requestedAction = params.get("action");
    if (!linked.cancelled_at && linked.status !== "completed") {
      if (requestedAction === "submit" && isOfficerTaskParticipant(linked, profile.id)) openAction({ kind: "submit", task: linked });
      if (requestedAction === "review" && admin && canEvaluate(linked) && linked.status === "submitted") openAction({ kind: "review", task: linked });
    }
    if (requestedAction) {
      const url = new URL(window.location.href); url.searchParams.delete("action");
      window.history.replaceState(window.history.state, "", url);
    }
    };
    openTarget();
    const openWorkspaceTarget = () => openTarget(true);
    window.addEventListener("gea:workspace-target", openWorkspaceTarget);
    return () => window.removeEventListener("gea:workspace-target", openWorkspaceTarget);
  }, [tasks, profiles, tracking.events, admin, profile.id]);

  useEffect(() => {
    if (!profile.peet_onboarding_seen_at) setExplainer(true);
  }, [profile.id, profile.peet_onboarding_seen_at]);
  useEffect(() => {
    const refresh = () => {
      // The unified workspace owns refreshing when this board is nested inside it.
      if (document.hidden || action || saving || refreshing || backgroundRefreshing || document.querySelector('[data-workspace-refresh-owner], [data-workspace-dirty="true"], [data-workspace-busy="true"], dialog[open]')) return;
      startBackgroundRefresh(() => router.refresh());
    };
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, [router, action, saving, refreshing, backgroundRefreshing]);
  async function closeExplainer() {
    setExplainer(false);
    if (!profile.peet_onboarding_seen_at) await mutate("mark_peet_onboarding_seen", {}, "PEET introduction saved.");
  }
  useEffect(() => {
    try {
      if (new URLSearchParams(window.location.search).has("task")) return;
      const restored = readTaskDraft(window.sessionStorage, profile.id);
      if (!restored) return;
      setTaskDraft(restored);
      setAssignees(restored.assignees.filter(id => officers.some(person => person.id === id)));
      setTaskPeople(Array.from(new Set([profile.id, ...restored.people.filter(id => teammates.some(person => person.id === id))])));
      setCreateSharedTask(admin && restored.shared);
      setAction({ kind: "add" });
    } catch { /* The form remains usable when browser storage is disabled. */ }
  }, [profile.id]);
  useEffect(() => {
    if (action?.kind !== "add") return;
    try { writeTaskDraft(window.sessionStorage, profile.id, { ...taskDraft, assignees, people: taskPeople, shared: createSharedTask }); } catch { /* Keep the live draft. */ }
  }, [action, taskDraft, assignees, taskPeople, createSharedTask, profile.id]);
  function discardTaskDraft() {
    try { clearTaskDraft(window.sessionStorage, profile.id); } catch { /* Storage is optional. */ }
    setTaskDraft(emptyTaskDraft());
  }
  function closeAction() { if (action?.kind === "add") discardTaskDraft(); setAction(null); }
  function captureTaskDraft(event: FormEvent<HTMLFormElement>) {
    if (action?.kind !== "add") return;
    const fields = new FormData(event.currentTarget);
    const draft = { ...taskDraft, title: String(fields.get("title") || ""), description: String(fields.get("description") || ""),
      dueDate: String(fields.get("due_date") || ""), assignees, people: taskPeople, shared: createSharedTask };
    setTaskDraft(draft);
    try { writeTaskDraft(window.sessionStorage, profile.id, draft); } catch { /* Keep the live draft. */ }
  }
  function openAction(next: Action) {
    if (next.kind === "add") {
      try {
        const restored = readTaskDraft(window.sessionStorage, profile.id);
        if (restored) {
          setTaskDraft(restored); setAssignees(restored.assignees.filter(id => officers.some(person => person.id === id)));
          setTaskPeople(Array.from(new Set([profile.id, ...restored.people.filter(id => teammates.some(person => person.id === id))])));
          setCreateSharedTask(admin && restored.shared); setError(null); setNotice(""); setAction(next); return;
        }
      } catch { /* Keep working without storage. */ }
      setTaskDraft(emptyTaskDraft());
    }
    setCreateSharedTask(false); setTaskPeople(next.kind === "edit" ? officerTaskPeople(next.task) : [profile.id]); setEndWithScore(false); setError(null); setNotice(""); setAssignmentSearch(""); setAssignees(next.kind === "edit" ? [next.task.assigned_to] : officers.some(person => person.id === selectedOfficer) ? [selectedOfficer] : []); setAction(next); }
  async function mutate(name: string, args: Record<string, unknown>, message: string) {
    setSaving(true); setError(null); setNotice("");
    try {
      const { error: rpcError } = await createClient().rpc(name, args);
      if (rpcError) { setError(peetError(rpcError)); return; }
      dispatchDiscordNotifications();
      if (action?.kind === "add") discardTaskDraft();
      setAction(null); setNotice(message);
      startTransition(() => router.refresh());
    } catch { setError(peetError(null)); }
    finally { setSaving(false); }
  }
  async function saveTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    const dueDate = deadlineLocked && action?.kind === "edit" ? action.task.due_date : String(fields.get("due_date") || "");
    const unchangedDeadline = action?.kind === "edit" && dueDate === action.task.due_date;
    if (dueDate && dueDate < schoolToday() && !unchangedDeadline) {
      setError("Choose today or a future date for the due date (Pacific time).");
      return;
    }
    if (action?.kind === "add") {
      if (admin && !createSharedTask && !assignees.length) { setError("Choose at least one officer."); return; }
      if (!admin || createSharedTask) {
        await mutate(admin && createSharedTask ? "assign_officer_collaboration" : "save_officer_shared_task", { p_title: fields.get("title"), p_description: fields.get("description"), p_due_date: fields.get("due_date") || null, p_people: taskPeople }, "Task created. One shared deliverable; each officer submits their own reflection and receives an individual evaluation.");
        return;
      }
      await mutate("assign_officer_tasks", { p_title: fields.get("title"), p_description: fields.get("description"), p_due_date: fields.get("due_date") || null, p_assignees: admin ? assignees : [profile.id] }, "Tasks assigned. Each officer has their own submission and evaluation.");
    } else if (action?.kind === "edit") {
      if (editingSelfTask) {
        await mutate("save_officer_shared_task", { p_title: action.task.title, p_description: fields.get("description"), p_due_date: deadlineLocked ? action.task.due_date : fields.get("due_date") || null, p_people: taskPeople, p_task_id: action.task.id }, "Task and people saved.");
        return;
      }
      await mutate("save_officer_task", { p_title: editingSelfTask ? action.task.title : fields.get("title"), p_description: fields.get("description"), p_due_date: deadlineLocked ? action.task.due_date : fields.get("due_date") || null, p_assigned_to: editingSelfTask ? action.task.assigned_to : admin ? assignees[0] : profile.id, p_task_id: action.task.id }, "Task saved.");
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
  const taskQuery = taskSearch.trim().toLowerCase();
  const matchingTasks = visibleTasks.filter(task => [task.title, task.description, task.submission_description, task.cancellation_reason, task.end_notes, evaluationFor(task)?.feedback_notes].some(value => value?.toLowerCase().includes(taskQuery)));
  const activeTasks = sortOfficerTasks(matchingTasks.filter(task => !task.cancelled_at && !taskCompleteFor(task, overview ? undefined : selectedOfficer) && (task.status === "in_progress" || needsTaskContribution(task, profile.id) || (admin && task.individual_peet && task.status === "submitted" && !task.contributions?.some(row => row.status === "pending" && isOfficerTaskParticipant(task, row.student_id))) || clarificationTaskIds.includes(task.id))));
  const waitingTasks = sortOfficerTasks(matchingTasks.filter(task => !task.cancelled_at && task.status === "submitted" && !needsTaskContribution(task, profile.id) && !taskCompleteFor(task, profile.id) && !clarificationTaskIds.includes(task.id) && (!admin || isOfficerTaskParticipant(task, profile.id))));
  const cancelledTasks = matchingTasks.filter(task => task.cancelled_at);
  const matchingRequests = selectedRequests.filter(request => !taskQuery || matchingTasks.some(task => task.id === request.task_id) || `${request.reason} ${request.review_notes}`.toLowerCase().includes(taskQuery));
  const pendingRequests = matchingRequests.filter(request => request.status === "pending");
  const pastRequests = matchingRequests.filter(request => request.status !== "pending");
  const matchingReviewQueue = reviewQueue.filter(task => matchingTasks.some(match => match.id === task.id));
  const disclosureScope = `${selectedOfficer}-${!!taskQuery}`;
  function requestRow(request: TaskCancellationRequest) {
    const task = tasks.find(task => task.id === request.task_id);
    return <details key={request.id} className={styles.taskDisclosure}>
      <summary className={styles.taskRowSummary}><span className={styles.disclosureChevron} aria-hidden="true" /><span className={styles.taskRowTitle}>{task?.title || "Task"}</span><span className={styles.badge}>{request.status}</span><span className={styles.rowMeta}>{dateLabel(request.created_at)}</span></summary>
      <div className={styles.taskDetails}><p>{request.reason}</p>{request.review_notes && <p>Reviewer: {request.review_notes}</p>}
        {admin && request.status === "pending" && task && (request.requested_by === profile.id || isOfficerTaskParticipant(task, profile.id) ? <span className={styles.badge}>Another reviewer required</span> : <button className={styles.secondary} disabled={busy} onClick={() => openAction({kind:"cancellationReview",task,request})}>Review request<span className="sr-only"> for {task.title}</span></button>)}
      </div>
    </details>;
  }
  function manageParticipants(task: OfficerTask) {
    return admin && !task.cancelled_at && task.status !== "completed" && officerTaskPeople(task).length > 1
      ? <button type="button" className={styles.secondary} disabled={busy} onClick={() => openAction({ kind: "people", task })}>Manage participants<span className="sr-only"> for {task.title}</span></button>
      : null;
  }
  function workLink(task: OfficerTask) {
    return <>{officerTaskPeople(task).length > 1 && <p className={styles.sharedPeople}>Shared with {officerTaskPeople(task).map(id => peopleNames[id] || "Former officer").join(", ")} · {task.individual_peet ? "Shared deliverable · Individual reflections and scores" : "Historical shared submission and evaluation"}</p>}{manageParticipants(task)}<OfficerTaskSubmission task={task} /></>;
  }

  function manualEvaluationForm(task: OfficerTask) {
    return <form onSubmit={saveEvaluation} className={styles.form}>
        <h2 className={styles.modalTitle}>{task.title}</h2><p>{ownerName(task)} · Due {dateLabel(task.due_date)} · Submitted {dateLabel(task.submitted_at)}</p>
        <p className={styles.description}>{task.description}</p>{workLink(task)}
        <fieldset disabled={busy}><legend>PEET scores · 1.0–4.0 (3.0 = Meets Expectations)</legend>
          <div className={styles.scoreInputs}>{(["efficiency", "effectiveness", "time"] as const).map(pillar => <label key={pillar}>{pillar[0].toUpperCase() + pillar.slice(1)}<input name={pillar} type="number" required min="1" max="4" step="0.1" defaultValue={evaluationFor(task)?.[pillar] ?? ""} /></label>)}</div>
          <label>Feedback notes<textarea name="feedback" rows={4} maxLength={10000} defaultValue={evaluationFor(task)?.feedback_notes ?? ""} /></label>
        </fieldset>
        <p>Saving completes the task and updates this officer’s overall PEET score. Adjustments replace the previous scores for this task.</p>
        <div className={styles.modalActions}><button type="button" className={styles.secondary} disabled={busy} onClick={() => setAction(null)}>Cancel</button><button className={styles.primary} disabled={busy}>{busy ? "Saving…" : "Save evaluation"}</button></div>
      </form>;
  }

  return <div className={`${styles.board} ${embedded ? styles.embedded : ""} ${unified ? styles.unified : ""} ${workspace && !admin ? styles.personalWorkspace : ""}`} data-workspace-dirty={rosterDirty || action?.kind === "add" || action?.kind === "edit" ? "true" : undefined} data-workspace-busy={busy ? "true" : undefined}>
    <WorkspaceActivity saving={saving} refreshing={refreshing || backgroundRefreshing} background={!busy} />
    {pendingExplanation && <p className={styles.warning} role="status">An attendance or conduct incident needs your explanation within 24 hours to avoid an automatic strike. <a href={`?view=accountability&topic=accountability&strike=${pendingExplanation.id}`}>Share your side of the story</a>.</p>}
    {(!workspace || (view !== "roster" && view !== "accounts")) && <header className={unified ? styles.workToolbar : styles.header}>
      {!embedded && !unified && <GEAOneBadge size="compact" />}
      <div>{unified ? <h2>{section === "tasks" ? admin ? "Tasks & PEET" : "My tasks" : section === "attendance" ? admin ? "Attendance" : "My attendance" : section === "volunteer" ? admin ? "Volunteer service" : "My service hours" : section === "conduct" ? "Professionalism & conduct" : section === "accountability" ? "Concerns & notes" : section === "accounts" ? "Accounts" : admin ? "Officer records" : "My progress"}</h2> : <><p className={styles.eyebrow}>Tasks, progress &amp; participation</p>{embedded ? <h2 className={styles.boardTitle}>Officer workspace</h2> : <h1>Officer workspace</h1>}</>}</div>
      <div className={styles.actions}>
        {(!workspace || section === "tasks") && <button className={unified ? styles.link : styles.secondary} onClick={() => setExplainer(true)} disabled={busy}>What is PEET?</button>}
        {view === "dashboard" && (!workspace || section === "tasks") && (section === "tasks" || overview || topic !== "tasks") && <button className={styles.primary} onClick={() => openAction({ kind: "add" })} disabled={busy}>{admin ? "Assign task" : "Add task"}</button>}
      </div>
    </header>}
    {admin && !workspace && <div className={styles.workspaceTools} aria-label="Workspace navigation"><button className={styles.secondary} disabled={rosterDirty} aria-pressed={view === "dashboard"} onClick={() => chooseOfficer("all")}>Officer directory</button><button className={styles.secondary} aria-pressed={view === "roster"} onClick={()=>{setView("roster");setNotice("");setError(null);}}>Team roster</button>{isSuperAdmin && <details className={styles.adminTools}><summary>Administration</summary><div><button disabled={rosterDirty} onClick={event => {setView("accounts"); event.currentTarget.closest("details")?.removeAttribute("open");}}>Manage GEA One accounts</button>{!embedded && <button disabled={rosterDirty} onClick={event => {setView("site"); event.currentTarget.closest("details")?.removeAttribute("open");}}>Website admin</button>}</div></details>}</div>}

    <p role="status" className={styles.notice}>{notice || (refreshing ? "Updating your board…" : "")}</p>
    {error && !action && <ActionError message={error} className={styles.error} />}
    {tracking.strikes.some(strike => strike.officer_id === profile.id && strike.status === "notified") && <p className={styles.warning} role="status">You have an accountability concern awaiting a response. <button className={styles.link} disabled={rosterDirty} onClick={() => { chooseOfficer(profile.id); chooseTopic("accountability"); }}>Review and explain your circumstances →</button></p>}
    <div className={`${styles.studentWorkspace} ${!workspace && view === "dashboard" && !overview && admin ? styles.withStudent : ""}`}>
    {admin && view === "dashboard" && section !== "tasks" && (!workspace || overview) && <aside className={styles.roster} aria-label="Officer roster">
      <div className={styles.sectionHeading}><div><h2>Officers</h2><p>{section === "conduct" ? "Choose an officer to log a conduct concern or review their strike history." : overview ? "Choose a name, then choose a topic." : "Choose another officer."}</p></div><span className={styles.badge}>{isSuperAdmin ? "Super admin" : "PEET reviewer"}</span></div>
      <label className={styles.search}>Search officers<input type="search" value={rosterSearch} onChange={event => setRosterSearch(event.target.value)} placeholder="Name, email, or position" /></label>
      <div className={styles.rosterGrid}>
      {matchingOfficers(rosterSearch).map(person => { const progress = peetSummary(tasks.filter(task => isOfficerTaskParticipant(task, person.id)), evaluations, person.id); const waiting = tasks.filter(task => isOfficerTaskParticipant(task, person.id) && !task.cancelled_at && task.status === "submitted").length + cancellationRequests.filter(request => tasks.some(task => task.id === request.task_id && isOfficerTaskParticipant(task, person.id)) && request.status === "pending").length + tracking.volunteerLogs.filter(log => log.officer_id === person.id && log.status === "pending").length; return <button className={styles.personCard} aria-pressed={selectedOfficer === person.id} key={person.id} onClick={() => chooseOfficer(person.id)}><strong>{person.name}{person.id === profile.id ? " (you)" : ""}</strong><span>{identity(person)}</span>{section === "conduct" ? <span>{tracking.strikes.filter(strike => strike.officer_id === person.id && strike.category === "conduct" && strike.status === "confirmed" && strike.academic_year === academicYear).length} confirmed conduct strikes · {tracking.strikes.filter(strike => strike.officer_id === person.id && strike.status === "notified" && !strike.responded_at && strike.academic_year === academicYear).length} awaiting explanations</span> : <><span>{person.position || "Officer"} · {progress.active} active · PEET {progress.score === null ? "—" : `${progress.score.toFixed(1)}/100`}</span>{waiting > 0 && <span>{waiting} awaiting review</span>}</>}</button>; })}</div>
      {matchingOfficers(rosterSearch).length === 0 && <p className={styles.empty}>No officers match your search.</p>}
    </aside>}
    <div className={styles.studentContent}>
    {section === "tasks" && admin && <label className={styles.workspaceOfficerFilter}>Officer<select aria-label="Filter tasks by officer" value={selectedOfficer} onChange={event => chooseOfficer(event.target.value)}><option value="all">All officers</option>{officers.map(person => <option key={person.id} value={person.id}>{person.name} · {person.position || "Officer"}</option>)}</select></label>}
    {view === "dashboard" && !overview && section !== "tasks" && <>
      <header className={`${styles.studentContext} ${workspace && !admin ? styles.personalContext : ""}`}>
        {workspace && !admin && <p className={styles.personalHint}>{section === "attendance" ? "Your meeting record and absence notices." : section === "volunteer" ? "Join events, submit your hours, and track verification." : section === "accountability" ? "Explain your circumstances and view your strike history." : "Your PEET score, participation, and completed work."}</p>}
        {admin && <label className={workspace ? styles.workspaceOfficerFilter : styles.mobileOfficerPicker}>Officer<select value={selectedOfficer} onChange={event => chooseOfficer(event.target.value)}>{officers.map(person => <option key={person.id} value={person.id}>{person.name} · {person.position || "Officer"}</option>)}</select></label>}
        {(!workspace || admin) && <div className={styles.profileBar}><div className={styles.studentIdentity}><h2 ref={studentHeading} tabIndex={-1}>{selectedPerson?.name ?? profile.name}</h2><p>{selectedPerson?.position || "Officer"}{selectedPerson?.email ? ` · ${selectedPerson.email}` : ""}</p></div>{workspace ? section === "conduct" ? null : <label className={styles.workspaceOfficerFilter}>Record details<select aria-label="Officer record details" value={topic} onChange={event => chooseTopic(event.target.value as OfficerTopic)}><option value="overview">Summary</option><option value="tasks">Tasks & PEET</option><option value="attendance">Attendance</option><option value="volunteer">Volunteer service</option><option value="accountability">Concerns & notes</option></select></label> : <OfficerTopicNavigation topic={topic} onSelect={chooseTopic} pending={{tasks:reviewQueue.length + selectedRequests.filter(request => request.status === "pending").length,volunteer:tracking.volunteerLogs.filter(log => log.officer_id === selectedOfficer && log.status === "pending" && tracking.events.some(event => event.id === log.event_id && event.academic_year === academicYear)).length,accountability:tracking.strikes.filter(strike => strike.officer_id === selectedOfficer && strike.status === "notified" && strike.academic_year === academicYear).length}} />}{admin && <button className={`${styles.secondary} ${styles.changeOfficer}`} onClick={() => chooseOfficer("all")}>Change officer</button>}</div>}
        <div className={styles.contextScope}>{topic === "tasks" ? <p>Cumulative PEET and task history · all school years</p> : <label className={styles.yearPicker}>Academic year<select aria-label="Academic year" value={academicYear} onChange={event => setAcademicYear(event.target.value)}>{years.map(year => <option key={year}>{year}</option>)}</select></label>}</div>
      </header>
      {topic === "overview" && <div className={styles.metrics}>
      {!overview && <section className={styles.scoreCard} aria-labelledby="peet-score-label">
        <h2 id="peet-score-label">Total PEET Score</h2>
        <p className={styles.score}>{summary.score === null ? "—" : summary.score.toFixed(1)}<span>/100</span></p>
        <p>{summary.score === null ? "Your first evaluation starts the picture." : summary.score >= 85 ? "Meets Expectations or above" : "Below Meets Expectations"}</p>
        <div className={styles.scoreTrack} data-status={summary.score === null ? "pending" : summary.score >= 85 ? "meets" : "below"} aria-hidden="true"><span style={{ width: `${summary.score ?? 0}%` }} /></div>
        <p className={styles.scoreNote}>{summary.evaluated} evaluated {summary.evaluated === 1 ? "task" : "tasks"} · 85 is Meets Expectations</p>
      </section>}
      <section className={styles.metric}><h2>Active Tasks</h2><p>{summary.active}</p><span>In progress or awaiting review</span></section>
      <section className={styles.metric}><h2>Completed Tasks</h2><p>{summary.completed}</p><span>Completed by review or ended by a reviewer</span></section>
    </div>}
    {topic === "overview" && <div className={styles.studentStats}>
      <article><h3>Meeting attendance</h3><strong>{recordSummary.present}</strong><p>{recordSummary.excused} excused · {recordSummary.unexcused} unexcused</p></article>
      <article><h3>Volunteer time</h3><strong>{durationLabel(recordSummary.volunteerMinutes)}</strong><p>{recordSummary.volunteerEvents}/2 approved events</p></article>
      <article><h3>Attendance strikes</h3><strong>{recordSummary.attendanceStrikes}/3</strong><p>Confirmed in {academicYear}</p></article>
      <article><h3>Conduct strikes</h3><strong>{recordSummary.conductStrikes}/3</strong><p>Confirmed in {academicYear}</p></article>
    </div>}

    </>}
    {admin && view === "roster" && <OfficerRoster profiles={profiles} data={tracking} year={academicYear} years={years} onYearChange={setAcademicYear} onOpenOfficer={chooseOfficer} onDirtyChange={setRosterDirty} initialEventId={workspace?.eventId} rosterMode={section === "attendance" || section === "volunteer" ? section : undefined} />}
    {isSuperAdmin && view === "accounts" && <AccountsPanel actorId={profile.id} />}
    {!embedded && isSuperAdmin && view === "site" && <div className="mt-8"><AdminTabs section={siteSection} onSectionChange={setSiteSection} /></div>}
    {view === "dashboard" && (!overview || section === "tasks") && topic === "tasks" && <>
    {section !== "tasks" && <div className={styles.topicHeading}><h2>Tasks & PEET</h2><button className={styles.primary} onClick={() => openAction({kind:"add"})} disabled={busy}>+ Add task</button></div>}
    <label className={styles.taskSearch}><span className="sr-only">Search this officer’s tasks and requests</span><input type="search" value={taskSearch} onChange={event => setTaskSearch(event.target.value)} placeholder="Find a task, submission, or note…" /></label>
    {taskQuery && <p className={styles.searchResultCount} role="status">{matchingTasks.length} matching {matchingTasks.length === 1 ? "task" : "tasks"} · {matchingRequests.length} matching {matchingRequests.length === 1 ? "request" : "requests"}</p>}
    {admin && matchingReviewQueue.length > 0 && <TaskSection key={`reviews-${disclosureScope}`} title="Ready for review" count={matchingReviewQueue.length} collapsible={false}>
      {matchingReviewQueue.map(task => <div className={styles.reviewRow} key={task.id}>
        <details className={styles.taskDisclosure}>
          <summary className={styles.taskRowSummary}><span className={styles.disclosureChevron} aria-hidden="true" /><span className={styles.taskRowTitle}>{task.title}</span><span className={styles.rowMeta}>Submitted {dateLabel(task.submitted_at)}</span></summary>
          <div className={styles.taskDetails}><p>{task.description}</p>{workLink(task)}</div>
        </details>
        {canEvaluate(task) ? <button className={styles.primary} disabled={busy} onClick={() => openAction({ kind: "review", task })}>Evaluate<span className="sr-only"> {task.title}</span></button> : <span className={styles.badge}>{isOfficerTaskParticipant(task, profile.id) ? "Another reviewer required" : "Advisor review required"}</span>}
      </div>)}
    </TaskSection>}
    <TaskSection key={`active-${disclosureScope}`} title={admin ? "Active tasks" : "To complete"} count={activeTasks.length} collapsible={false}>
      {activeTasks.length === 0 ? <p className={styles.compactEmpty}>{taskQuery ? "No unfinished tasks match your search." : "You’re up to date. No tasks to complete."}</p> : activeTasks.map(task => <div className={styles.taskWorkRow} key={task.id}>
        <details className={styles.taskDisclosure}>
          <summary className={styles.taskRowSummary}><span className={styles.disclosureChevron} aria-hidden="true" /><span className={styles.taskRowTitle}>{task.title}</span><span className={`${styles.rowMeta} ${clarificationTaskIds.includes(task.id) || task.due_date && task.due_date < today ? styles.taskUrgent : ""}`}>{clarificationTaskIds.includes(task.id) ? "Your answers needed" : task.due_date ? `${task.due_date < today ? "Overdue · " : task.due_date === today ? "Due today · " : "Due "}${dateLabel(task.due_date)}` : "No deadline"}{overview ? ` · ${ownerName(task)}` : ""}</span></summary>
          <div className={styles.taskDetails}>
            {task.description && <p>{task.description}</p>}{workLink(task)}
            {officerTaskPeople(task).length > 1 && <p className={styles.rowMeta}>{officerTaskPeople(task).length} people on this task</p>}
            <div className={styles.actions}>
              {task.status === "in_progress" && isOfficerTaskParticipant(task, profile.id) && <a className={styles.secondary} href={`/operations?view=blockers&task=${task.id}#task-help`}>Blocked / need help</a>}
              {canEditOfficerTask(task, profile.id, admin) && <button className={styles.secondary} disabled={busy} onClick={() => openAction({ kind: "edit", task })}>Edit<span className="sr-only"> {task.title}</span></button>}
              {admin && !isOfficerTaskParticipant(task, profile.id) && <button className={styles.secondary} disabled={busy} onClick={() => openAction({ kind: "end", task })}>End task<span className="sr-only"> {task.title}</span></button>}
              <button className={styles.secondary} disabled={busy || (isOfficerTaskParticipant(task, profile.id) && cancellationRequests.some(request => request.task_id === task.id && request.status === "pending"))} onClick={() => openAction({ kind: "cancel", task })}>{isOfficerTaskParticipant(task, profile.id) ? "Request cancellation" : "Cancel task"}<span className="sr-only"> {task.title}</span></button>
            </div>
          </div>
        </details>
        {admin && task.individual_peet && !isOfficerTaskParticipant(task, profile.id) && <button className={styles.secondary} disabled={busy} onClick={() => openAction({kind:"review",task})}>View contributions</button>}
        {isOfficerTaskParticipant(task, profile.id) && <button className={styles.primary} disabled={busy} onClick={() => openAction({ kind: "submit", task })}>{needsTaskContribution(task, profile.id) ? "Add my reflection" : clarificationTaskIds.includes(task.id) ? "Answer questions" : "Submit work"}<span className="sr-only"> for {task.title}</span></button>}
      </div>)}
    </TaskSection>
    {waitingTasks.length > 0 && <TaskSection key={`waiting-${disclosureScope}`} title="Awaiting review" count={waitingTasks.length} defaultOpen={Boolean(taskQuery)}>{waitingTasks.map(task => <div className={styles.taskWorkRow} key={task.id}><div><strong>{task.title}</strong><p className={styles.rowMeta}>Submitted {dateLabel(task.submitted_at)}</p></div><button className={styles.secondary} disabled={busy} onClick={() => openAction({ kind: "submit", task })}>View submission<span className="sr-only"> for {task.title}</span></button></div>)}</TaskSection>}
    {pendingRequests.length > 0 && <TaskSection key={`pending-${disclosureScope}`} title="Cancellation requests" count={pendingRequests.length} hint="Pending">{pendingRequests.map(requestRow)}</TaskSection>}
    <div className={styles.taskSummary} aria-label="Task summary"><article><h3>PEET /100</h3><strong>{summary.score === null ? "—" : summary.score.toFixed(1)}</strong></article><article><h3>Active</h3><strong>{summary.active}</strong></article><article><h3>Completed</h3><strong>{summary.completed}</strong></article></div>
    <OfficerTaskHistory key={`history-${disclosureScope}`} tasks={matchingTasks} evaluations={evaluations} peopleNames={peopleNames} defaultOpen={!!taskQuery} subjectId={overview ? undefined : selectedOfficer} admin={admin} actorId={profile.id} busy={busy} canEvaluate={canEvaluate} onReview={task => openAction({kind:"review",task})} onCancel={task => openAction({kind:"cancel",task})} />
    {pastRequests.length > 0 && <TaskSection key={`past-${disclosureScope}`} title="Past cancellation requests" count={pastRequests.length} defaultOpen={!!taskQuery}>{pastRequests.map(requestRow)}</TaskSection>}
    {cancelledTasks.length > 0 && <TaskSection key={`cancelled-${disclosureScope}`} title="Cancelled tasks" count={cancelledTasks.length} defaultOpen={!!taskQuery}>
      {cancelledTasks.map(task => <details className={styles.taskDisclosure} key={task.id}>
        <summary className={styles.taskRowSummary}><span className={styles.disclosureChevron} aria-hidden="true" /><span className={styles.taskRowTitle}>{task.title}</span><span className={styles.rowMeta}>Cancelled {dateLabel(task.cancelled_at ?? null)}</span></summary>
        <div className={styles.taskDetails}><p>{task.cancellation_reason}</p>{evaluationFor(task) && <p>Previous PEET average: {taskAverage(evaluationFor(task)!).toFixed(2)}/4 · {evaluationFor(task)?.feedback_notes}</p>}{workLink(task)}</div>
      </details>)}
    </TaskSection>}
    </>}
    {view === "dashboard" && !overview && topic !== "overview" && topic !== "tasks" && <section className={styles.dashboardSection} aria-labelledby="selected-topic-heading"><h2 id="selected-topic-heading">{topic === "attendance" ? "Attendance" : topic === "volunteer" ? "Volunteer service" : "Concerns & strike history"}</h2><TrackingPanel key={`${selectedOfficer}-${topic}`} mode={topic} profile={profile} profiles={profiles} officerId={selectedOfficer} data={tracking} isSuperAdmin={isSuperAdmin} embedded academicYear={academicYear} showMetrics /></section>}
    </div></div>

    {explainer && <PeetExplainer onClose={closeExplainer} />}
    {action && <Modal title={action.kind === "add" ? "Add task" : `${action.kind === "cancellationReview" ? "Review cancellation" : action.kind === "cancel" ? "Cancel" : action.kind === "people" ? "Manage participants for" : action.kind} task: ${action.task.title}`} busy={busy} onClose={closeAction}>
      {error && <ActionError message={error} className={styles.error} />}
      {(action.kind === "add" || action.kind === "edit") && <form onSubmit={saveTask} onChange={captureTaskDraft} className={styles.form}>
        <h2 className={styles.modalTitle}>{action.kind === "add" ? "Start with an idea." : "Edit task."}</h2>
        <p>{editingSelfTask ? "You can update the description, add people, and move the deadline up to three days before or after its original date." : "Log the work, set your goal, and give it a deadline."}</p>
        {action.kind === "edit" && manageParticipants(action.task)}
        <fieldset disabled={busy}>
          <label>Task title<input name="title" readOnly={editingSelfTask} required maxLength={200} defaultValue={action.kind === "edit" ? action.task.title : taskDraft.title} /></label>
          <label>Description<textarea name="description" rows={4} maxLength={10000} defaultValue={action.kind === "edit" ? action.task.description : taskDraft.description} /></label>
          <label>Due date (optional)<input name="due_date" type="date" min={minimumDueDate} max={deadlineBounds?.max} required={editingSelfTask && !deadlineLocked} disabled={deadlineLocked} defaultValue={action.kind === "edit" ? action.task.due_date ?? "" : taskDraft.dueDate} /></label>
          <p>Choose today or a future date (Pacific time).</p>
          {editingSelfTask && deadlineBounds && deadlineLocked && <p>The deadline adjustment window has passed. You can still update the description and people.</p>}
          {editingSelfTask && !deadlineBounds && <p>No original deadline was set. You can update the description and people.</p>}
          {action.kind === "add" && admin && <label className={styles.sharedTaskChoice}><input type="checkbox" checked={createSharedTask} onChange={event => { setCreateSharedTask(event.target.checked); setTaskPeople([]); }} />Shared collaborative task</label>}
          {((action.kind === "add" && (!admin || createSharedTask)) || editingSelfTask) && <TaskPeoplePicker key={action.kind === "edit" ? action.task.id : "new"} people={teammates} selected={taskPeople} creatorId={profile.id} includeCreator={!(admin && createSharedTask && action.kind === "add")} onChange={setTaskPeople} />}
          {admin && !editingSelfTask && !createSharedTask && <div><p>{action.kind === "add" ? "Assign to officers · choose one or several" : "Assigned officer"}</p><label>Find officers<input type="search" value={assignmentSearch} onChange={event => setAssignmentSearch(event.target.value)} /></label><p>{assignees.length} selected{action.kind === "add" ? " · A separate task will be created for each officer." : ""}</p>
            {action.kind === "add" && <div className={styles.actions}><button type="button" className={styles.secondary} onClick={() => setAssignees(Array.from(new Set([...assignees,...matchingOfficers(assignmentSearch).map(person => person.id)])))}>Select matching officers</button><button type="button" className={styles.secondary} onClick={() => setAssignees([])}>Clear selection</button></div>}
            <div className={styles.assignmentList}>{matchingOfficers(assignmentSearch).map(person => <label key={person.id} className={styles.assignmentPerson}><input type={action.kind === "add" ? "checkbox" : "radio"} name="officer-choice" checked={assignees.includes(person.id)} disabled={action.kind === "edit" && officerTaskPeople(action.task).length > 1} onChange={event => setAssignees(action.kind === "edit" ? [person.id] : event.target.checked ? [...assignees,person.id] : assignees.filter(id => id !== person.id))} /><span><strong>{person.name}</strong><small>{identity(person)} · {person.position || "Officer"}</small></span></label>)}</div>
            {action.kind === "edit" && officerTaskPeople(action.task).length > 1 && <p>Shared tasks keep their creator as the primary officer.</p>}
          </div>}

        </fieldset>
        <div className={styles.modalActions}><button type="button" className={styles.secondary} disabled={busy} onClick={closeAction}>Cancel</button><button className={styles.primary} disabled={busy}>{busy ? "Saving…" : "Save task"}</button></div>
      </form>}
      {action.kind === "people" && admin && <div className={styles.form}>
        <h2 className={styles.modalTitle}>Manage participants</h2>
        <p>{action.task.title}</p>
        <p>Remove someone from this task. Existing reflections and scores are kept. Removing the primary officer transfers that role to a remaining teammate.</p>
        <ul>{officerTaskPeople(action.task).map(id => <li key={id}>
          <span>{peopleNames[id] || "Former officer"}{id === action.task.assigned_to ? " · Primary officer" : ""}</span>{" "}
          <button type="button" className={styles.secondary} disabled={busy || officerTaskPeople(action.task).length < 2} onClick={() => void mutate("remove_officer_task_participant", { p_task_id: action.task.id, p_officer_id: id }, `${peopleNames[id] || "Officer"} removed from the task.`)}>Remove<span className="sr-only"> {peopleNames[id] || "officer"} from {action.task.title}</span></button>
        </li>)}</ul>
        <div className={styles.modalActions}><button type="button" className={styles.secondary} disabled={busy} onClick={closeAction}>Close</button></div>
      </div>}
      {action.kind === "submit" && <OfficerTaskPeet peopleNames={peopleNames} key={`submit-${action.task.id}`} officerTask={action.task} actorId={profile.id} mode="submit" onBusyChange={setAiBusy}
        onComplete={message => { setAction(null); setNotice(message); startTransition(() => router.refresh()); }}
        manualFallback={<form onSubmit={submitProduct} className={styles.form}>
        <h2 className={styles.modalTitle}>Ready to share your work?</h2><p>{action.task.title}</p>
        <label>Work description<textarea name="submission_description" rows={5} maxLength={10000} placeholder="Describe what you did, what you accomplished, and any details your reviewer should know." disabled={busy} /></label>
        <label>Supporting link (optional)<input type="url" name="url" maxLength={2048} placeholder="https://…" disabled={busy} /></label>
        <p>Describe your completed work, add a supporting link, or both. {officerTaskPeople(action.task).length > 1 ? "The deliverable is shared, but each participant must submit their own contribution reflection for an individual PEET score." : "After submission, you can no longer edit this task."}</p>
        <div className={styles.modalActions}><button type="button" className={styles.secondary} disabled={busy} onClick={() => setAction(null)}>Cancel</button><button className={styles.primary} disabled={busy}>{busy ? "Submitting…" : "Submit for review"}</button></div>
      </form>} />}
      {action.kind === "end" && admin && <form className={styles.form} onSubmit={event => {
        event.preventDefault();
        const fields = new FormData(event.currentTarget);
        void mutate(endWithScore ? "end_officer_task_with_evaluation" : "end_officer_task", {
          p_task_id: action.task.id, p_notes: fields.get("notes"),
          ...(endWithScore ? { p_efficiency: Number(fields.get("efficiency")), p_effectiveness: Number(fields.get("effectiveness")), p_time: Number(fields.get("time")) } : {}),
        }, endWithScore ? "Task completed and PEET scores saved." : "Task ended and moved to completed history. No PEET score was added.");
      }}>
        <h2 className={styles.modalTitle}>End this task</h2><p>{action.task.title} · {ownerName(action.task)}</p>
        <p>Complete this task with or without a PEET score. Collaborative tasks must be evaluated per participant through their contribution reviews; ending them here adds no shared score.</p>
        <fieldset disabled={busy}>
          <label>Completion option<select value={endWithScore ? "scored" : "unscored"} onChange={event => setEndWithScore(event.target.value === "scored")}>
            <option value="unscored">Complete without a PEET score</option>
            <option value="scored" disabled={action.task.individual_peet || !canEvaluate(action.task)}>Complete with PEET scores</option>
          </select></label>
          {!canEvaluate(action.task) && <p>An advisor must enter PEET scores for this officer.</p>}
          {endWithScore && <fieldset><legend>PEET scores · 1.0–4.0 (3.0 = Meets Expectations)</legend>
            <div className={styles.scoreInputs}>{(["efficiency", "effectiveness", "time"] as const).map(pillar => <label key={pillar}>{pillar[0].toUpperCase() + pillar.slice(1)}<input name={pillar} type="number" required min="1" max="4" step="0.1" /></label>)}</div>
            <p>These scores count toward the officer’s overall PEET score.</p>
          </fieldset>}
          <label>{endWithScore ? "Reason and feedback" : "Reason"}<textarea name="notes" required minLength={10} maxLength={2000} rows={4} /></label>
        </fieldset>
        <div className={styles.modalActions}><button type="button" className={styles.secondary} disabled={busy} onClick={() => setAction(null)}>Keep task active</button><button className={styles.primary} disabled={busy}>{endWithScore ? "Complete and save scores" : "Complete without a score"}</button></div>
      </form>}
      {action.kind === "cancel" && <form className={styles.form} onSubmit={event => { event.preventDefault(); const reason = new FormData(event.currentTarget).get("reason"); void mutate(isOfficerTaskParticipant(action.task, profile.id) ? "request_officer_task_cancellation" : "cancel_officer_task", { p_task_id: action.task.id, p_reason: reason }, isOfficerTaskParticipant(action.task, profile.id) ? "Cancellation requested. Continue the task until a reviewer approves." : "Task cancelled. Its history has been preserved."); }}>
        <h2 className={styles.modalTitle}>{isOfficerTaskParticipant(action.task, profile.id) ? "Request cancellation" : "Cancel this task"}</h2><p>{action.task.title}</p><p>{isOfficerTaskParticipant(action.task, profile.id) ? "Explain what changed and what support you need. Another reviewer must approve before this task closes." : "Record the reason. The task and its evaluation remain in the history, and cancelled tasks stop counting toward PEET."}</p>
        <label>Reason<textarea name="reason" required minLength={10} maxLength={2000} disabled={busy} rows={4} /></label><div className={styles.modalActions}><button type="button" className={styles.secondary} disabled={busy} onClick={() => setAction(null)}>Keep task</button><button className={styles.primary} disabled={busy}>{isOfficerTaskParticipant(action.task, profile.id) ? "Send request" : "Confirm cancellation"}</button></div>
      </form>}
      {action.kind === "cancellationReview" && <form className={styles.form} onSubmit={event => { event.preventDefault(); const fields = new FormData(event.currentTarget); void mutate("review_officer_task_cancellation", {p_request_id: action.request.id, p_status: fields.get("decision"), p_notes: fields.get("notes")}, "Cancellation request reviewed."); }}>
        <h2 className={styles.modalTitle}>Review cancellation</h2><p>{ownerName(action.task)} · {action.task.title}</p><p>{action.request.reason}</p><label>Decision<select name="decision" disabled={busy}><option value="rejected">Keep task · decline request</option><option value="approved">Approve cancellation</option></select></label><label>Review notes<textarea name="notes" required minLength={10} maxLength={2000} rows={4} disabled={busy} /></label><button className={styles.primary} disabled={busy}>Save decision</button>
      </form>}
      {action.kind === "review" && admin && (action.task.status === "completed" ? manualEvaluationForm(action.task) : <OfficerTaskPeet peopleNames={peopleNames} key={`review-${action.task.id}`} officerTask={action.task} actorId={profile.id} mode="review" onBusyChange={setAiBusy}
        onComplete={message => { setAction(null); setNotice(message); startTransition(() => router.refresh()); }}
        manualFallback={manualEvaluationForm(action.task)} />)}
    </Modal>}
  </div>;
}
