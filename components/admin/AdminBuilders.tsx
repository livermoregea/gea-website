"use client";

import controls from "@/components/workspace-controls.module.css";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import { BUILDER_RUBRIC, BUILDER_TIERS, builderError, type BuilderSubmission, type BuilderRecognition } from "@/lib/builders";
import { builderButton, builderCard, builderInput } from "@/components/builders/styles";

type Student = { id: string; full_name: string; school_email: string | null; auth_email: string };
export default function AdminBuilders() {
  const [submissions, setSubmissions] = useState<BuilderSubmission[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [recognitions, setRecognitions] = useState<BuilderRecognition[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [view, setView] = useState("review");
  const [filter, setFilter] = useState("pending");
  const load = useCallback(async () => {
    try {
      const supabase = createClient();
      const [builds, profiles, awards] = await Promise.all([
        supabase.from("builder_submissions").select("*").order("created_at", { ascending: false }),
        supabase.from("student_profiles").select("id, full_name, school_email, auth_email").order("full_name"),
        supabase.from("builder_recognitions").select("*"),
      ]);
      const failure = builds.error ?? profiles.error ?? awards.error;
      if (failure) { setError(builderError(failure)); return; }
      setSubmissions((builds.data ?? []) as BuilderSubmission[]);
      setStudents((profiles.data ?? []) as Student[]);
      setRecognitions((awards.data ?? []) as BuilderRecognition[]);
    } catch { setError("Couldn’t load GEA Builders. Check your connection and refresh."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  async function save(name: string, params: Record<string, unknown>, confirmation: string) {
    setBusy(true); setError(""); setMessage("");
    try {
      const { error: saveError } = await createClient().rpc(name, params);
      if (saveError) { setError(builderError(saveError)); return; }
      setMessage(confirmation); await load();
    } catch { setError("Couldn’t save this change. Check your connection and try again."); }
    finally { setBusy(false); }
  }
  const profile = (id: string) => students.find(s => s.id === id);
  const earned = students.map(student => ({ student, points: submissions.filter(s => s.student_id === student.id).reduce((sum, s) => sum + s.points, 0) })).filter(s => s.points >= 10);
  if (loading) return <p role="status" className="text-sm text-graphite/80">Loading builds…</p>;
  return <div className="space-y-6">
    <p className="max-w-3xl text-sm leading-relaxed text-graphite/80">Review real-world student projects, prepare stories for the public Builder Wall, and track earned certificates and meeting shout-outs. New approvals stay off the wall until you publish an edited story.</p>
    <div className="flex flex-wrap gap-2">{[["review","Project reviews"],["wall","Wall stories"],["recognition","Recognition"]].map(([key,label]) => <button key={key} type="button" aria-current={view === key ? "page" : undefined} onClick={() => setView(key)} className={`${controls.control} min-h-11 rounded-[8px] px-4 text-sm ${view === key ? "bg-forest text-paper" : "border border-forest/20 text-forest"}`}>{label}</button>)}<button type="button" disabled={busy} onClick={() => {setError(""); void load();}} className={`${controls.control} ml-auto min-h-11 text-sm text-forest underline`}>Refresh</button></div>
    {error && <p role="alert" className="rounded-[8px] bg-red-50 p-4 text-sm text-red-700">{error}</p>}
    {message && <p role="status" className="rounded-[8px] bg-forest/5 p-4 text-sm text-forest">{message}</p>}
    {view === "review" && <><label className="block max-w-xs text-sm">Show projects<select className={builderInput} value={filter} onChange={e => setFilter(e.target.value)}><option value="pending">Pending review</option><option value="needs_changes">Needs changes</option><option value="approved">Approved</option><option value="all">All submissions</option></select></label>
      {submissions.filter(s => filter === "all" || s.status === filter).length === 0 && <p className={builderCard}>No projects in this view.</p>}
      {submissions.filter(s => filter === "all" || s.status === filter).map(s => <Review key={s.id} submission={s} student={profile(s.student_id)} parent={submissions.find(p => p.id === s.parent_id)} busy={busy} save={save}/>)}
    </>}
    {view === "wall" && <><p className="text-sm text-graphite/80">Review the first name and story for public sharing. Remove personal details from the story. Emails, points, team lists, video links, and officer feedback are never included in the wall.</p>{submissions.filter(s => s.status === "approved").length === 0 && <p className={builderCard}>Approve a project to prepare its wall story.</p>}{submissions.filter(s => s.status === "approved").map(s => <Story key={`${s.id}-${s.wall_hidden}-${s.wall_title}`} submission={s} student={profile(s.student_id)} busy={busy} save={save}/>)}</>}
    {view === "recognition" && <><p className="text-sm text-graphite/80">Each earned level includes a certificate and meeting shout-out. Mark recognition when it has been given.</p>{earned.length === 0 && <p className={builderCard}>Recognition will appear when approved builds reach 10 points.</p>}<div className="grid gap-4 lg:grid-cols-2">{earned.flatMap(({student,points}) => BUILDER_TIERS.filter(t => points >= t.min).map(t => {
      const record = recognitions.find(r => r.student_id === student.id && r.threshold === t.min);
      return <form key={`${student.id}-${t.min}-${record?.certificate}-${record?.shoutout}`} className={builderCard} onSubmit={e => {e.preventDefault(); const f = new FormData(e.currentTarget); void save("set_builder_recognition", {p_student_id:student.id,p_threshold:t.min,p_certificate:f.has("certificate"),p_shoutout:f.has("shoutout")}, "Recognition updated.");}}><h3 className="font-display text-xl text-forest">{student.full_name} · {t.name}</h3><p className="mt-2 text-sm text-graphite/80">{points} points · {student.school_email ?? student.auth_email}</p><div className="my-4 space-y-2">{[["certificate","Certificate given"],["shoutout","Meeting shout-out given"]].map(([key,label]) => <label key={key} className="flex items-center gap-3 text-sm"><input name={key} type="checkbox" className="!h-5 !w-5 !min-h-5" defaultChecked={key === "certificate" ? record?.certificate : record?.shoutout}/>{label}</label>)}</div><button type="submit" disabled={busy} className={`${controls.control} ${builderButton}`}>Save recognition</button></form>;
    }))}</div></>}
  </div>;
}
type Save = (name: string, params: Record<string, unknown>, confirmation: string) => Promise<void>;
function Review({ submission: s, student, parent, busy, save }: { submission: BuilderSubmission; student?: Student; parent?: BuilderSubmission; busy: boolean; save: Save }) {
  const [criteria, setCriteria] = useState<Record<string,boolean>>(Object.fromEntries(BUILDER_RUBRIC.map(r => [r.key, false])));
  function decide(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const decision = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement;
    void save("review_builder_project", {p_id:s.id,p_status:decision.value,p_note:String(f.get("note")).trim(),p_solves_problem:criteria.solves_problem,p_helps_others:criteria.helps_others,p_gea_skills:criteria.gea_skills,p_clear_evidence:criteria.clear_evidence}, "Review saved. Student progress has been updated.");
  }
  return <article className={builderCard}><div className="flex flex-wrap justify-between gap-3"><h3 className="text-xl font-semibold text-forestdeep">{s.title}</h3><span className="text-sm text-forest">{s.status.replaceAll("_", " ")} {s.status === "approved" ? `· ${s.points} points` : ""}</span></div><p className="mt-2 text-sm text-graphite/80">{student?.full_name ?? "Student"} · {student?.school_email ?? student?.auth_email} · {s.location}</p><div className="mt-5 space-y-3 whitespace-pre-wrap text-sm leading-relaxed">{[["Problem",s.problem],["Build",s.build],["GEA skills",s.skills],["Team",s.team]].map(([label,text]) => <p key={label}><strong>{label}: </strong>{text}</p>)}</div><a href={s.evidence_url} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex min-h-11 items-center text-sm text-forest underline">Open project video ↗</a>{parent && <p className="mt-3 whitespace-pre-wrap border-l-2 border-gold pl-4 text-sm"><strong>Previous submission feedback: </strong>{parent.officer_note}</p>}
    {s.status === "pending" ? <form onSubmit={decide} className="mt-5 border-t border-forest/15 pt-5"><fieldset><legend className="font-medium text-forest">Award rubric points</legend><div className="mt-3 space-y-2">{BUILDER_RUBRIC.map(r => <label key={r.key} className="flex items-center gap-3 text-sm"><input type="checkbox" className="!h-5 !w-5 !min-h-5" checked={criteria[r.key]} onChange={e => setCriteria({...criteria,[r.key]:e.target.checked})}/>{r.label} (+{r.points})</label>)}</div><p className="mt-4 font-medium">Selected: {BUILDER_RUBRIC.reduce((sum,r) => sum + (criteria[r.key] ? r.points : 0),0)} points</p></fieldset><label className="mt-4 block text-sm">Officer feedback (required for “Needs changes”)<textarea name="note" className={builderInput} rows={3} maxLength={2000}/></label><div className="mt-4 flex flex-wrap gap-3"><button type="submit" value="approved" disabled={busy} className={`${controls.control} ${builderButton}`}>Approve</button><button type="submit" value="needs_changes" disabled={busy} className={`${controls.control} min-h-11 rounded-[8px] border border-forest/20 px-5 text-sm text-forest`}>Needs changes</button></div></form> : s.officer_note && <p className="mt-4 whitespace-pre-wrap text-sm"><strong>Officer feedback: </strong>{s.officer_note}</p>}
  </article>;
}
function Story({ submission:s, student, busy, save }: { submission: BuilderSubmission; student?: Student; busy: boolean; save: Save }) {
  return <form className={`${builderCard} grid gap-5 sm:grid-cols-2`} onSubmit={e => {e.preventDefault(); const f = new FormData(e.currentTarget); void save("edit_builder_story", {p_id:s.id,p_name:String(f.get("name")).trim(),p_title:String(f.get("title")).trim(),p_problem:String(f.get("problem")).trim(),p_build:String(f.get("build")).trim(),p_hidden:f.has("hidden")}, "Wall story saved. Student points are unchanged.");}}>
    <div className="sm:col-span-2"><h3 className="font-display text-xl text-forest">{s.title}</h3><p className="mt-2 text-sm text-graphite/80">{s.wall_opt_out ? "Student opted out — this project must stay private." : s.wall_hidden ? "Hidden from wall" : "Published on wall"}</p></div>
    <label className="text-sm">Public first name<input name="name" className={builderInput} maxLength={80} required defaultValue={s.wall_name || student?.full_name.split(/\s+/)[0] || "Builder"}/></label><label className="text-sm">Public title<input name="title" className={builderInput} maxLength={100} required defaultValue={s.wall_title || s.title}/></label>
    <label className="sm:col-span-2 text-sm">Public problem description<textarea name="problem" className={builderInput} required rows={3} maxLength={2000} defaultValue={s.wall_problem || s.problem}/></label><label className="sm:col-span-2 text-sm">Public build story<textarea name="build" className={builderInput} required rows={3} maxLength={2000} defaultValue={s.wall_build || s.build}/></label>
    <label className="sm:col-span-2 flex items-center gap-3 text-sm"><input name="hidden" className="!h-5 !w-5 !min-h-5" type="checkbox" defaultChecked={s.wall_hidden || s.wall_opt_out} disabled={s.wall_opt_out}/>Keep this story hidden</label><div className="sm:col-span-2"><button type="submit" disabled={busy} className={`${controls.control} ${builderButton}`}>Save wall story</button></div>
    {s.wall_opt_out && <input type="hidden" name="hidden" value="true"/>}
  </form>;
}
