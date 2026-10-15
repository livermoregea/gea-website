"use client";

import Link from "next/link";
import { builderInput, builderButton, builderCard } from "@/components/builders/styles";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import { BUILDER_TIERS, BUILDER_RUBRIC, builderProgress, builderError, type BuilderStory, type BuilderSubmission } from "@/lib/builders";

import { createBuilderDraft, readBuilderDraft, hasBuilderDraftChanges, type BuilderDraft } from "@/lib/builder-drafts";

const views = [{ key: "home", label: "Overview" }, { key: "submit", label: "Submit a build" }, { key: "progress", label: "My progress" }, { key: "wall", label: "Builder Wall" }, { key: "philosophy", label: "Build philosophy" }, { key: "ideas", label: "Find your next build" }];
const values = [
  ["Listen first", "People before projects.", "Ask who faces the problem and what they need. A useful build starts with understanding someone’s day.", "What’s one thing that keeps getting in your way?"],
  ["Think green", "Make more of less.", "Look for materials you can reuse, things you can repair, and ways to reduce waste. A clever solution doesn’t need a shopping trip.", "What do I already have that could work?"],
  ["Try, test, improve", "Your first version is a start.", "Build a small prototype, test it safely, and learn what needs to change. Keep track of what each attempt teaches you.", "What did this test teach me?"],
  ["Build together", "Share skills. Give credit.", "Invite a different perspective, explain your choices, and recognize everyone’s contribution. Helping a teammate learn is part of the work.", "Who sees this differently than I do?"],
  ["Take responsibility", "Safe is part of good design.", "Think about how someone will build, use, and maintain your solution. Get guidance before working with unfamiliar tools or materials.", "What could go wrong, and how can I prevent it?"],
  ["Show the learning", "Be honest about the impact.", "Show what works, what doesn’t yet, and what you would change. A clear explanation helps the next person learn from your build.", "What changed for the person using this?"],
];
const ideas = [
  ["At home", "Make a daily task easier.", "Look for things that are hard to reach, easy to lose, or awkward to use.", "A stable phone stand for a family member; a reused-material drawer organizer; a reminder for a task someone forgets.", "Watch someone do the task and ask what’s frustrating."],
  ["At school", "Help a shared space work.", "Outside your class assignments, notice what slows down your club, team, or school day.", "A labeled club supply organizer; a reusable recycling guide; a system for finding shared equipment.", "Ask the person responsible for the space what would help."],
  ["In your community", "Start with a neighbor’s need.", "Listen for small challenges in the places where you volunteer or spend time.", "Reusable garden labels; a tool organizer from leftover materials; a low-voltage plant-watering reminder.", "Talk with someone who would actually use your solution."],
];
const examples = [
  ["Reuse + design", "A phone stand for family calls", "A grandparent’s phone kept slipping during video calls. A student tried folded cardboard shapes, widened the base, and added a notch for the charging cable.", "Clean scrap cardboard, a ruler, and tape.", "Does it stay steady when the screen is tapped? Can the user see the screen comfortably?"],
  ["Code + everyday routines", "A reminder that fits real life", "A student missed deadlines after practice. They built a small Python program that reads a list of tasks and shows what is due next.", "A short list of tasks and a basic Python script.", "Try a task due today, an empty list, and an incorrectly entered date."],
  ["Observation + shared spaces", "Cardboard with a second job", "A club wasted time finding supplies. A student measured the items and turned a shipping box into a labeled organizer with removable dividers.", "A clean box, scrap cardboard, tape, and clear labels.", "Can another club member find and return each item without instructions?"],
];
function Heading({ eyebrow, title, children }: { eyebrow: string; title: string; children?: React.ReactNode }) {
  return <div className="mb-8 max-w-3xl"><p className="font-mono text-xs uppercase tracking-[0.2em] text-forest/80">{eyebrow}</p><h2 className="mt-3 font-display text-3xl text-forestdeep sm:text-4xl">{title}</h2>{children && <p className="mt-4 leading-relaxed text-graphite/80">{children}</p>}</div>;
}
export default function Builders({ stories, submissions, student, signedIn, ready, initialView }: {
  stories: BuilderStory[]; submissions: BuilderSubmission[]; student: { id: string; name: string } | null;
  signedIn: boolean; ready: boolean; initialView?: string;
}) {
  const router = useRouter();
  const navRef = useRef<HTMLElement>(null);
  const [view, setView] = useState(views.some(v => v.key === initialView) ? initialView! : "home");
  const [revision, setRevision] = useState<BuilderSubmission | null>(null);
  const [drafts, setDrafts] = useState<Record<string, BuilderDraft>>({});
  const draftKey = revision?.id ?? "new";
  const draft = drafts[draftKey] ?? createBuilderDraft(revision);
  const hasUnsavedDrafts = Object.entries(drafts).some(([key, savedDraft]) =>
    hasBuilderDraftChanges(savedDraft, createBuilderDraft(submissions.find(s => s.id === key)))
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const total = submissions.reduce((sum, s) => sum + s.points, 0);
  const progress = builderProgress(total);
  useEffect(() => {
    if (!hasUnsavedDrafts) return;
    function warnBeforeLeaving(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }
    function warnBeforeFollowingLink(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>("a[href]") : null;
      if (!link || link.target === "_blank" || link.hasAttribute("download")) return;
      const destination = new URL(link.href, window.location.href);
      if (!["http:", "https:"].includes(destination.protocol)) return;
      if (destination.origin === window.location.origin && destination.pathname === window.location.pathname && destination.search === window.location.search && destination.hash) return;
      if (!window.confirm("Leave GEA Builders? Your unfinished builds will be discarded. Stay here to keep working.")) {
        event.preventDefault();
        event.stopPropagation();
      }
    }
    window.addEventListener("beforeunload", warnBeforeLeaving);
    document.addEventListener("click", warnBeforeFollowingLink, true);
    return () => {
      window.removeEventListener("beforeunload", warnBeforeLeaving);
      document.removeEventListener("click", warnBeforeFollowingLink, true);
    };
  }, [hasUnsavedDrafts]);

  function rememberDraft(event: FormEvent<HTMLFormElement>) {
    const updated = readBuilderDraft(new FormData(event.currentTarget));
    setDrafts(previous => ({ ...previous, [draftKey]: updated }));
  }
  function go(next: string) {
    setView(next); setError("");
    navRef.current?.scrollIntoView({ block: "start" });
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); setMessage("");
    const form = event.currentTarget;
    const fields = new FormData(form);
    try {
      const { error: saveError } = await createClient().rpc("submit_builder_project", {
        p_title: String(fields.get("title")).trim(), p_location: fields.get("location"),
        p_problem: String(fields.get("problem")).trim(), p_build: String(fields.get("build")).trim(),
        p_skills: String(fields.get("skills")).trim(), p_team: String(fields.get("team")).trim(),
        p_evidence_url: String(fields.get("evidence")).trim(), p_wall_opt_out: fields.has("optOut"), p_parent_id: revision?.id ?? null,
      });
      if (saveError) { setError(builderError(saveError)); return; }
      setDrafts(previous => {
        const remaining = { ...previous };
        delete remaining[draftKey];
        return remaining;
      });
      setRevision(null); go("progress");
      setMessage("Build received! Your project is waiting for officer review. Every build is a step forward.");
      router.refresh();
    } catch { setError("We couldn’t send your build. Check your connection and try again."); }
    finally { setBusy(false); }
  }
  async function privacy(s: BuilderSubmission) {
    setBusy(true); setError("");
    try {
      const { error: saveError } = await createClient().rpc("set_builder_privacy", { p_id: s.id, p_opt_out: !s.wall_opt_out });
      if (saveError) setError(builderError(saveError));
      else { setMessage(s.wall_opt_out ? "Sharing allowed. Officers will review the story before publishing it." : "Your build is kept off the public wall. Your points are unchanged."); router.refresh(); }
    } catch { setError("We couldn’t update your sharing preference. Try again."); }
    finally { setBusy(false); }
  }
  const accountPrompt = !ready ? <p className={builderCard}>Submissions and progress will open when GEA Builders is set up. You can explore the program, philosophy, and build ideas now.</p> : !student ? <div className={builderCard}><p>{signedIn ? "A GEA One account with student access is needed to submit builds and view progress." : "Sign in with your GEA One account to submit builds and see your private progress."}</p><Link href={signedIn ? "/contact" : "/login"} className={`${builderButton} mt-4`}>{signedIn ? "Contact GEA" : "Sign in to GEA One"}</Link></div> : null;
  return <div className="builders-page bg-paper">
    <section className="builders-dark-surface border-b border-gold/25 bg-forestdeep bg-blueprintgrid bg-grid text-paper">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 sm:py-20 lg:grid-cols-[1.4fr_1fr]">
        <div><Link href="/community" className="inline-flex min-h-11 items-center text-sm text-paper/85 hover:text-goldlight">← Community in action</Link><p className="mt-5 font-mono text-xs uppercase tracking-[0.22em] text-goldlight">GEA Builders · Real problems. Real solutions.</p><h1 className="mt-4 font-display text-5xl leading-tight sm:text-6xl">Small builds.<br/><span className="text-goldlight">Real impact.</span></h1><p className="mt-5 max-w-xl leading-relaxed text-paper/85">Notice something that could work better? Build a solution beyond your class assignments—at home, at school, or in your community. Submit it, get officer feedback, and earn points toward your next level.</p><button type="button" onClick={() => go("submit")} className="mt-7 min-h-11 rounded-sm bg-gold px-6 py-3 font-medium text-forestdeep hover:bg-goldlight">Submit your build ↗</button><p className="mt-3 text-sm text-paper/85">Your progress. Your pace.</p></div>
        <div aria-label="The builder loop" className="self-center rounded-sm border border-gold/30 bg-forestdeep/70 p-7"><p className="font-mono text-xs uppercase tracking-[0.2em] text-goldlight">The builder loop</p>{["Notice a problem", "Build a solution", "Share your impact"].map((step, i) => <div key={step} className="mt-6 border-t border-paper/15 pt-5"><span className="mr-4 font-mono text-sm text-goldlight">0{i+1}</span><span className="font-display text-xl">{step}</span></div>)}<p className="mt-7 font-mono text-xs uppercase tracking-widest text-paper/85">Curiosity → Care → Create</p></div>
      </div>
    </section>
    <div className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
      <nav ref={navRef} aria-label="GEA Builders" className="scroll-mt-24 mb-10 flex flex-wrap gap-2 border-b border-forest/15 py-5">{views.map(v => <button key={v.key} type="button" aria-current={view === v.key ? "page" : undefined} onClick={() => go(v.key)} className={`min-h-11 rounded-sm px-4 py-2 text-sm transition ${view === v.key ? "bg-forest text-paper" : "text-forest hover:bg-forest/5"}`}>{v.label}</button>)}</nav>
      {message && <p role="status" className="mb-6 rounded-sm border border-forest/20 bg-forest/5 p-4 text-forest">{message}</p>}
      {error && <p role="alert" className="mb-6 rounded-sm border border-red-200 bg-red-50 p-4 text-red-800">{error}</p>}
      {view === "home" && <>
        <Heading eyebrow="The mission" title="Build with purpose.">Bring classroom skills into everyday life. Four simple rules guide every build.</Heading>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[
          ["Real", "Start with a problem.", "Solve a real problem you noticed outside the classroom—not a class assignment."],
          ["Yours", "Do the building.", "Build it yourself or with a team. Give your teammates credit."],
          ["Safe", "Keep it safe.", "Your solution must be safe to build and use."],
          ["Show it", "Share the evidence.", "Share a Google Drive video link and explain what your project does."],
        ].map(([label,title,copy], i) => <article key={label} className={builderCard}><p className="font-mono text-xs uppercase text-forest/80">0{i+1} / {label}</p><h3 className="mt-4 font-display text-xl text-forestdeep">{title}</h3><p className="mt-3 text-sm leading-relaxed text-graphite/80">{copy}</p></article>)}</div>
        <div className="mt-14"><Heading eyebrow="Level up through impact" title="Every build moves you forward."/><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{BUILDER_TIERS.map((tier, i) => <article key={tier.min} className={builderCard}><span className="font-mono text-xs text-forest/80">LEVEL 0{i+1}</span><h3 className="mt-3 font-display text-2xl text-forestdeep">{tier.name}</h3><p className="mt-2 text-2xl font-medium text-forest">{tier.min} <span className="text-sm">points</span></p><p className="mt-4 text-sm leading-relaxed text-graphite/80">Earn your {tier.name} certificate and a shout-out at a GEA meeting.</p></article>)}</div></div>
        <div className={`${builderCard} mt-8`}><h3 className="font-display text-2xl text-forestdeep">Up to 25 points per build.</h3><ul className="mt-4 grid gap-3 sm:grid-cols-2">{BUILDER_RUBRIC.map(r => <li key={r.key} className="text-sm text-graphite/80"><strong className="mr-2 text-forest">+{r.points}</strong>{r.label}</li>)}</ul></div>
      </>}
      {view === "submit" && <><Heading eyebrow="Turn an idea into impact" title={revision ? "Improve your build." : "Share your build."}>All project details are required. Working alone? Enter “Solo” for team members. Officers review your project and award up to 25 points.</Heading>{accountPrompt ?? <form key={draftKey} onChange={rememberDraft} onSubmit={submit} className={`${builderCard} grid gap-6 sm:grid-cols-2`}>
        <fieldset disabled={busy} className="contents">
        <p className="sm:col-span-2 text-sm text-forest">Submitting as <strong>{student?.name}</strong>. Your GEA One account keeps your progress private.</p>
        {revision && <div className="sm:col-span-2 border-l-2 border-gold bg-gold/10 p-4"><p className="font-medium">Officer feedback</p><p className="mt-2 whitespace-pre-wrap">{revision.officer_note}</p><p className="mt-2 text-sm">Your earlier submission and feedback will be preserved.</p></div>}
        <label>Project title<input className={builderInput} name="title" maxLength={100} required defaultValue={draft.title}/></label>
        <label>Where does it help?<select name="location" className={builderInput} defaultValue={draft.location}><option value="home">At home</option><option value="school">At school</option><option value="community">In the community</option></select></label>
        {([{name:"problem", label:"What problem did you notice?", max:2000}, {name:"build", label:"What did you build, and how does it help?", max:2000}, {name:"skills", label:"What GEA skills did you use?", max:1000}] as const).map(f => <label key={f.name} className="sm:col-span-2">{f.label}<textarea name={f.name} className={builderInput} rows={4} required maxLength={f.max} defaultValue={draft[f.name]}/></label>)}
        <label className="sm:col-span-2">Team members<input name="team" className={builderInput} required maxLength={200} placeholder="Team members’ names, or Solo" defaultValue={draft.team}/></label>
        <div className="sm:col-span-2 rounded-sm bg-forest/5 p-4 text-sm leading-relaxed"><h3 className="font-medium text-forest">Before you submit your video link</h3><p id="builder-video-help" className="mt-2">Upload your project video to Google Drive and grant reviewing GEA officers viewing access using your school’s approved sharing settings. Test access with an officer or teacher. The link will stay off the public Builder Wall.</p></div>
        <label className="sm:col-span-2">Google Drive video link<input name="evidence" className={builderInput} type="url" pattern="https://drive\.google\.com/.*" required maxLength={2000} aria-describedby="builder-video-help" placeholder="https://drive.google.com/file/d/…/view" defaultValue={draft.evidence}/></label>
        <label className="sm:col-span-2 flex items-start gap-3 text-sm"><input className="!min-h-5 !h-5 !w-5 shrink-0" name="optOut" type="checkbox" defaultChecked={draft.optOut}/><span>Keep my build off the Builder Wall. I can still earn points. If I allow sharing, officers may publish my first name and edited project story. I can change this preference in My progress.</span></label>
        <div className="sm:col-span-2 flex flex-wrap gap-4"><button className={builderButton} disabled={busy} type="submit">{busy ? "Sending…" : revision ? "Resubmit for review ↗" : "Send for review ↗"}</button>{revision && <button type="button" disabled={busy} className="text-sm text-forest underline" onClick={() => setRevision(null)}>Cancel revision</button>}</div>
        </fieldset>
      </form>}</>}
      {view === "progress" && <><Heading eyebrow="Your progress. Your pace." title="Your builder journey.">Only approved projects earn points. Your submissions and officer feedback are visible to you and approved officers.</Heading>{accountPrompt ?? <>
        <div className="builders-dark-surface mb-8 rounded-sm bg-forestdeep p-6 text-paper sm:p-8"><p className="font-mono text-xs uppercase tracking-widest text-goldlight">{progress.tier?.name ?? "Your first build starts here"}</p><p className="mt-3 font-display text-5xl">{total} <span className="text-base text-paper/85">total points</span></p><progress className="mt-5 h-3 w-full accent-gold" value={Math.min(total,progress.next?.min ?? 100)} max={progress.next?.min ?? 100} aria-label="Progress toward your next milestone"/><p className="mt-3 text-sm text-paper/85">{progress.next ? `${progress.next.min - total} points to ${progress.next.name}` : "GEA Builder unlocked! Keep building solutions that help people around you."}</p></div>
        {submissions.length === 0 && <p className={builderCard}>No builds yet. Notice one problem, try one solution, and share what you learned.</p>}
        <div className="space-y-4">{submissions.map(s => <article key={s.id} className={builderCard}><div className="flex flex-wrap items-center justify-between gap-3"><p className="font-mono text-xs uppercase text-forest/80">{s.location} · {s.parent_id ? "Revised build" : "Original build"}</p><span className="rounded-full bg-forest/5 px-3 py-1 text-sm text-forest">{s.status === "needs_changes" ? "Needs changes" : s.status === "approved" ? `Approved · +${s.points} points` : "Pending review"}</span></div><h3 className="mt-3 font-display text-2xl text-forestdeep">{s.title}</h3><p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-graphite/80">{s.problem}</p>{s.officer_note && <p className="mt-4 whitespace-pre-wrap border-l-2 border-gold pl-4 text-sm"><strong>Officer feedback: </strong>{s.officer_note}</p>}
          <div className="mt-5 flex flex-wrap items-center gap-4">{s.status === "needs_changes" && !submissions.some(child => child.parent_id === s.id) && <button type="button" className={builderButton} onClick={() => {setRevision(s); go("submit");}}>Revise and resubmit</button>}<button type="button" disabled={busy} onClick={() => privacy(s)} className="min-h-11 text-sm text-forest underline">{s.wall_opt_out ? "Allow sharing on the wall" : "Keep off the public wall"}</button><span className="text-xs text-graphite/80">{s.wall_opt_out ? "Private build" : s.wall_hidden ? "Story awaiting publication" : "Shared on the wall"}</span></div>
        </article>)}</div>
      </>}</>}
      {view === "wall" && <><Heading eyebrow="Built by students. Made for real life." title="The Builder Wall.">A celebration of approved projects, newest first. Every build has a story.</Heading>{!ready ? <p className={builderCard}>The Builder Wall is unavailable right now. Please check back soon.</p> : stories.length === 0 ? <p className={builderCard}>Approved stories will appear here. Your next build could be one of them!</p> : <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">{stories.map(s => <article key={s.id} className={builderCard}><p className="font-mono text-xs uppercase tracking-wider text-forest/80">{s.first_name} · {s.location}</p><h3 className="mt-3 font-display text-2xl text-forestdeep">{s.title}</h3><p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-graphite/80">{s.problem}</p><details className="mt-5"><summary className="min-h-11 cursor-pointer py-2 text-sm font-medium text-forest">Read the story ↗</summary><h4 className="mt-3 font-medium">What I built</h4><p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-graphite/80">{s.build}</p></details></article>)}</div>}</>}
      {view === "philosophy" && <><Heading eyebrow="The GEA Builders mindset" title="Build a little better. Leave things a little better.">Engineering begins with paying attention. Bring classroom skills into everyday life: help people, use resources thoughtfully, and learn from every attempt.</Heading><div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">{values.map(([label,title,copy,prompt],i) => <article key={label} className={builderCard}><p className="font-mono text-xs uppercase text-forest/80">0{i+1} / {label}</p><h3 className="mt-3 font-display text-2xl text-forestdeep">{title}</h3><p className="mt-4 text-sm leading-relaxed text-graphite/80">{copy}</p><p className="mt-4 border-t border-forest/10 pt-4 text-sm text-forest">Ask: “{prompt}”</p></article>)}</div><div className="mt-8 rounded-sm bg-forest/5 p-6"><h3 className="font-display text-2xl text-forest">You don’t need a world-changing idea to start.</h3><p className="mt-3">Make one everyday thing work better for one person. Start there.</p><button onClick={() => go("ideas")} type="button" className={`${builderButton} mt-5`}>Find a starting point ↗</button></div></>}
      {view === "ideas" && <><Heading eyebrow="Look closer. There’s a build waiting." title="Big curiosity. Small first steps.">These are starting points, not assignments. Notice a real need, ask the people involved, and make the solution your own.</Heading><div className="grid gap-5 lg:grid-cols-3">{ideas.map(([label,title,copy,list,step]) => <article key={label} className={builderCard}><p className="font-mono text-xs uppercase text-forest/80">{label}</p><h3 className="mt-3 font-display text-2xl text-forestdeep">{title}</h3><p className="mt-4 text-sm leading-relaxed">{copy}</p><p className="mt-3 text-sm leading-relaxed text-graphite/80">{list}</p><p className="mt-4 border-t border-forest/10 pt-4 text-sm text-forest"><strong>First step:</strong> {step}</p></article>)}</div><div className="mt-12"><Heading eyebrow="Inspiration, not a checklist" title="What a small build can look like.">These fictional examples show how an everyday observation can become a useful project.</Heading><div className="grid gap-5 lg:grid-cols-3">{examples.map(([label,title,copy,materials,test]) => <article key={title} className={builderCard}><p className="font-mono text-xs uppercase text-forest/80">{label}</p><h3 className="mt-3 font-display text-2xl text-forestdeep">{title}</h3><p className="mt-4 text-sm leading-relaxed text-graphite/80">{copy}</p><details className="mt-4"><summary className="min-h-11 cursor-pointer py-2 text-sm text-forest">Explore the build</summary><p className="mt-2 text-sm"><strong>Start with:</strong> {materials}</p><p className="mt-3 text-sm"><strong>Test:</strong> {test}</p></details></article>)}</div></div><button type="button" onClick={() => {setRevision(null); go("submit");}} className={`${builderButton} mt-8`}>I have a build to share ↗</button></>}
    </div>
  </div>;
}
