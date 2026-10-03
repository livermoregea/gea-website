"use client";

import { useEffect, useRef, useState } from "react";
import SSPLabReport from "@/components/SSPLabReport";

const BUILD_TIME = 10 * 60 * 1000;
const TIMER_KEY = "ssp-build-timer-v1";
const steps = [
  {
    title: "Gather your materials",
    text: "Gather 12 spaghetti noodles, tape, and 24 mini marshmallows. Your challenge is to build a structure that stays standing when shaken.",
    tip: "Use marshmallows to connect the noodles and form the base of your structure.",
  },
  {
    title: "Plan your structure",
    text: "Decide what shape you want to build. Think about how wide the bottom should be and how you will connect the sides. Talk through your idea with your team before building.",
    tip: "A wide base and triangular supports can help your structure stay steady.",
  },
  {
    title: "Start the timer and build",
    text: "Press Start timer when you are ready. You have 10 minutes for building and strengthening your structure. Begin with the base, connect noodles with marshmallows, and build upward. Use tape where you need extra support.",
    tip: "Work on a flat surface and check that your structure can stand on its own.",
  },
  {
    title: "Strengthen and check",
    text: "Use the rest of your building time to check the connections and reinforce any wobbly parts. Try adding diagonal noodles to form triangles. Let go of your structure to see whether it stands by itself.",
    tip: "The same 10-minute timer covers both building steps. When time is up, stop building and move on to the shake test.",
  },
  {
    title: "Try the shake table",
    text: "Place your structure directly on the shake table—a skateboard. Let the activity leader shake the table, and watch what happens to your structure.",
    tip: "Does it stay standing? Watch which connections hold together and which parts move the most.",
  },
  {
    title: "Fill out your lab report",
    text: "Look back at your shake test and fill in the blanks below. Talk with your team about what happened, why it happened, and what you would try next.",
    tip: "This is a reflection, not a quiz. Your observations matter more than a perfect answer!",
  },
];

export default function SSPChallenge() {
  const [step, setStep] = useState(0);
  const [remaining, setRemaining] = useState(BUILD_TIME);
  const [deadline, setDeadline] = useState<number | null>(null);
  const [started, setStarted] = useState(false);
  const [ready, setReady] = useState(false);
  const [staffControls, setStaffControls] = useState(false);
  const holdRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const previousStep = useRef(0);

  useEffect(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(TIMER_KEY) || "null");
      if (saved && typeof saved.started === "boolean" &&
          typeof saved.remaining === "number" && Number.isFinite(saved.remaining) &&
          saved.remaining >= 0 && saved.remaining <= BUILD_TIME &&
          (saved.deadline === null || (typeof saved.deadline === "number" && Number.isFinite(saved.deadline)))) {
        const timeLeft = saved.deadline === null ? saved.remaining : Math.max(0, Math.min(BUILD_TIME, saved.deadline - Date.now()));
        setRemaining(timeLeft);
        setDeadline(timeLeft > 0 ? saved.deadline : null);
        setStarted(saved.started);
      }
    } catch {
      // The timer still works when browser storage is unavailable.
    }
    setReady(true);
    return () => { if (holdRef.current !== null) clearTimeout(holdRef.current); };
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      sessionStorage.setItem(TIMER_KEY, JSON.stringify({ remaining, deadline, started }));
    } catch {
      // Storage restrictions should not interrupt the activity.
    }
  }, [ready, remaining, deadline, started]);

  function cancelHold() {
    if (holdRef.current !== null) clearTimeout(holdRef.current);
    holdRef.current = null;
  }

  function beginHold() {
    cancelHold();
    holdRef.current = setTimeout(() => {
      holdRef.current = null;
      setStaffControls(true);
    }, 3000);
  }

  function startTimer() {
    setStarted(true);
    setDeadline(Date.now() + remaining);
    setStaffControls(false);
  }

  useEffect(() => {
    if (previousStep.current !== step) {
      headingRef.current?.focus();
      previousStep.current = step;
    }
  }, [step]);

  useEffect(() => {
    if (deadline === null) return;
    function update() {
      const next = Math.max(0, deadline! - Date.now());
      setRemaining(next);
      if (next === 0) setDeadline(null);
    }
    update();
    const interval = window.setInterval(update, 250);
    document.addEventListener("visibilitychange", update);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", update);
    };
  }, [deadline]);

  function pauseTimer() {
    if (deadline !== null) setRemaining(Math.max(0, deadline - Date.now()));
    setDeadline(null);
    setStaffControls(false);
  }

  function resetTimer() {
    setDeadline(null);
    setRemaining(BUILD_TIME);
    setStarted(false);
    setStaffControls(false);
  }

  function nextStep() {
    setStep((current) => Math.min(current + 1, steps.length - 1));
  }

  const seconds = Math.ceil(remaining / 1000);
  const display = `${Math.floor(seconds / 60).toString().padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;
  const buttonClass = "inline-flex min-h-11 items-center justify-center rounded-sm border border-forest/25 px-4 py-3 text-sm font-medium text-forestdeep transition hover:bg-forest/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-forest disabled:cursor-not-allowed disabled:opacity-40";

  return (
    <div className="mt-8 grid items-start gap-6 lg:grid-cols-[1fr_20rem]">
      <section aria-label="Step-by-step challenge" className="min-w-0 rounded-sm border border-forest/15 bg-white/70 p-4 sm:p-8">
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-forest">Step {step + 1} of {steps.length}</p>
        <div className="mt-4 flex gap-2" aria-hidden="true">
          {steps.map((item, index) => <span key={item.title} className={`h-1 flex-1 rounded-full ${index <= step ? "bg-forest" : "bg-forest/15"}`} />)}
        </div>
        <h3 ref={headingRef} tabIndex={-1} className="mt-6 rounded-sm font-display text-2xl text-forestdeep focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-forest">{steps[step].title}</h3>
        <p className="mt-4 leading-relaxed text-graphite/85">{steps[step].text}</p>
        <p className="mt-6 border-l-2 border-gold pl-4 text-sm leading-relaxed text-graphite/80">{steps[step].tip}</p>
        <div hidden={step !== steps.length - 1}>
          <SSPLabReport />
        </div>
        <div className="mt-8 grid grid-cols-2 gap-3 sm:flex sm:flex-wrap sm:justify-between">
          <button type="button" className={buttonClass} disabled={step === 0} onClick={() => setStep((current) => current - 1)}>Previous step</button>
          {step < steps.length - 1 ? (
            <button type="button" className={`${buttonClass} border-gold bg-gold hover:bg-goldlight`} onClick={nextStep}>Next step →</button>
          ) : (
            <button type="button" className={buttonClass} onClick={() => setStep(0)}>Review steps</button>
          )}
        </div>
      </section>

      <aside aria-labelledby="build-timer-heading" className="order-first min-w-0 rounded-sm border border-gold/30 bg-gold/10 p-4 text-center sm:p-6 lg:order-last">
        <h3 id="build-timer-heading" className="font-display text-xl text-forestdeep">10-minute build timer</h3>
        <p className="mt-2 text-sm leading-relaxed text-graphite/80">Have your materials ready before starting in step 3. Once started, your 10 minutes run continuously.</p>
        <button
          type="button"
          aria-label="Build time. Hold for three seconds for GEA controls."
          aria-expanded={staffControls}
          aria-controls="ssp-staff-controls"
          disabled={!ready}
          onPointerDown={(event) => { if (event.button === 0) beginHold(); }}
          onPointerUp={cancelHold}
          onPointerLeave={cancelHold}
          onPointerCancel={cancelHold}
          onBlur={cancelHold}
          onContextMenu={(event) => event.preventDefault()}
          onKeyDown={(event) => {
            if (event.key === " " || event.key === "Enter") {
              event.preventDefault();
              if (!event.repeat) beginHold();
            }
            if (event.key === "Escape") { cancelHold(); setStaffControls(false); }
          }}
          onKeyUp={(event) => { if (event.key === " " || event.key === "Enter") cancelHold(); }}
          className="my-3 touch-none select-none rounded-sm font-mono text-5xl tabular-nums text-forestdeep [-webkit-touch-callout:none] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-forest"
        >
          <span role="timer" aria-label={`${Math.floor(seconds / 60)} minutes and ${seconds % 60} seconds remaining`}>{display}</span>
        </button>
        {!started && (
          <div><button type="button" className={`${buttonClass} border-gold bg-gold hover:bg-goldlight`} disabled={!ready} onClick={startTimer}>Start timer</button></div>
        )}
        <div id="ssp-staff-controls" hidden={!staffControls} className="rounded-sm border border-forest/20 bg-paper p-4">
          <h4 className="font-display text-lg text-forestdeep">GEA controls</h4>
          <p className="mt-2 text-xs leading-relaxed text-graphite/80">For equipment problems or interruptions outside the team’s control.</p>
          <div className="mt-4 flex flex-wrap justify-center gap-3">
            {started && remaining > 0 && <button type="button" className={buttonClass} onClick={deadline !== null ? pauseTimer : startTimer}>{deadline !== null ? "Pause timer" : "Resume timer"}</button>}
            <button type="button" className={buttonClass} onClick={resetTimer}>Reset timer</button>
            <button type="button" className={buttonClass} onClick={() => setStaffControls(false)}>Close controls</button>
          </div>
        </div>
        <p role="status" className="mt-4 text-sm leading-relaxed text-forestdeep">
          {!ready ? "Loading timer…" : remaining === 0 ? "Time’s up! Stop building and move on to the shake test in step 5." : deadline !== null ? "Building time is running." : started ? "Paused by GEA. Wait for your activity leader to resume." : "Ready when you are."}
        </p>
        <p className="mt-3 text-xs leading-relaxed text-graphite/70">Changing steps does not stop or reset the timer. If the activity is interrupted, ask a GEA team member for help.</p>
      </aside>
    </div>
  );
}
