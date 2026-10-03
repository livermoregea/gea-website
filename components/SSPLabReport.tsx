"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

const prompts = [
  { id: "design", before: "We built a structure with", after: ".", hint: "Describe its shape, base, or supports." },
  { id: "observation", before: "When the table shook, our structure", after: ".", hint: "What did you see? Did it stand, wobble, bend, or fall?" },
  { id: "reason", before: "We think this happened because", after: ".", hint: "Think about the base, noodle supports, and marshmallow connections." },
  { id: "improvement", before: "Next time, we would change", after: ".", hint: "Choose one change you could test in another build." },
  { id: "learning", before: "We learned that a structure can resist shaking better when", after: ".", hint: "Connect your idea to something you noticed during the test." },
];

export default function SSPLabReport() {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [complete, setComplete] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadStatus, setDownloadStatus] = useState("");
  const reportRef = useRef<HTMLElement>(null);
  const filled = prompts.filter(({ id }) => answers[id]?.trim()).length;

  useEffect(() => {
    if (complete) {
      reportRef.current?.focus({ preventScroll: true });
      reportRef.current?.scrollIntoView({ block: "start" });
    }
  }, [complete]);

  async function downloadReport() {
    setDownloading(true);
    setDownloadStatus("");
    try {
      const { createReportImage } = await import("@/lib/ssp-report-image");
      const blob = await createReportImage(prompts.map((prompt) => ({ before: prompt.before, answer: answers[prompt.id] })));
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "science-at-stockmens-park-report.png";
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 60000);
      setDownloadStatus("Your report is ready to save. Check your browser’s downloads, or save the image if it opens in a new view.");
    } catch {
      setDownloadStatus("We couldn’t create the download. Please try again—your answers are still here.");
    } finally {
      setDownloading(false);
    }
  }

  if (complete) {
    return (
      <div className="mt-8">
        <p role="status" className="mb-4 text-sm leading-relaxed text-forest">Your report is ready! Download a neatly formatted image to save or share what you learned.</p>
        <article
          ref={reportRef}
          tabIndex={-1}
          aria-labelledby="finished-report-heading"
          className="scroll-mt-28 overflow-hidden rounded-sm border border-forest/20 bg-paper text-forestdeep shadow-sm focus:outline-none"
        >
          <header className="border-b-4 border-gold bg-forestdeep px-3 py-4 text-paper sm:px-7 sm:py-5">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-goldlight">Green Engineering Academy</p>
            <h4 id="finished-report-heading" className="mt-2 font-display text-2xl font-medium sm:text-3xl">Our shake-test report</h4>
            <p className="mt-2 text-sm text-paper/85">Science at Stockmens Park</p>
          </header>
          <div className="px-3 sm:px-7">
            <p className="border-b border-forest/15 py-3 font-mono text-[10px] uppercase leading-relaxed tracking-[0.12em] text-forest/75">Spaghetti + marshmallows + tape · 10-minute build</p>
            <ol className="divide-y divide-forest/15">
              {prompts.map((prompt, index) => {
                const answer = answers[prompt.id].trim();
                const punctuation = /[.!?]$/.test(answer) ? "" : prompt.after;
                return (
                  <li key={prompt.id} className="flex gap-2 py-3 sm:gap-3 sm:py-4">
                    <span aria-hidden="true" className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-forest text-xs text-paper">{index + 1}</span>
                    <p className="min-w-0 whitespace-pre-wrap break-words text-sm leading-relaxed sm:text-base">{prompt.before} <strong className="font-semibold">{answer}</strong>{punctuation}</p>
                  </li>
                );
              })}
            </ol>
          </div>
          <footer className="border-t border-forest/15 bg-forest/5 px-3 py-3 sm:px-7 sm:py-4">
            <p className="font-display text-sm font-medium">Build. Test. Learn. Improve.</p>
            <p className="mt-1 font-mono text-[10px] text-forest/75">livermoregea.org</p>
          </footer>
        </article>
        <div className="mt-5">
        <button type="button" disabled={downloading} onClick={downloadReport} className="mb-5 inline-flex min-h-11 w-full items-center justify-center rounded-sm bg-gold px-5 py-3 text-sm font-medium text-forestdeep hover:bg-goldlight focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-forest disabled:cursor-wait disabled:opacity-60 sm:w-auto">{downloading ? "Preparing report…" : "Download report (PNG)"}</button>
        <p role="status" className="mb-4 text-sm leading-relaxed text-forest">{downloadStatus}</p>
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-4">
          <button type="button" onClick={() => { setComplete(false); setDownloadStatus(""); }} className="inline-flex min-h-11 items-center justify-center rounded-sm border border-forest/25 px-5 py-3 text-sm font-medium text-forestdeep hover:bg-forest/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-forest">Edit answers</button>
          <Link href="/" className="inline-flex min-h-11 items-center justify-center rounded-sm bg-gold px-5 py-3 text-sm font-medium text-forestdeep hover:bg-goldlight focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-forest">Return to homepage</Link>
          <p className="text-sm leading-relaxed text-graphite/75">Share your discoveries with a GEA team member!</p>
        </div>
      </div>
    );
  }

  return (
    <form
      className="mt-8 border-t border-forest/15 pt-6"
      aria-labelledby="lab-report-heading"
      onSubmit={(event) => {
        event.preventDefault();
        if (filled === prompts.length) setComplete(true);
      }}
    >
      <h4 id="lab-report-heading" className="font-display text-xl text-forestdeep">Our shake-test report</h4>
      <p className="mt-2 text-sm leading-relaxed text-graphite/80">Finish each sentence with your team. A few words are enough—use your own observations. There’s something to learn whether your structure stood or fell.</p>
      <p className="mt-3 font-mono text-xs text-forest">{filled} of {prompts.length} blanks filled</p>
      <div className="mt-6 space-y-6">
        {prompts.map((prompt, index) => (
          <div key={prompt.id}>
            <label htmlFor={`ssp-report-${prompt.id}`} className="block font-medium leading-relaxed text-forestdeep">
              <span className="mr-2 font-mono text-sm text-forest/65">{index + 1}.</span>
              {prompt.before} <span aria-hidden="true">____{prompt.after}</span>
            </label>
            <input
              id={`ssp-report-${prompt.id}`}
              name={prompt.id}
              type="text"
              required
              pattern={".*\\S.*"}
              title="Add a few words to finish the sentence."
              maxLength={300}
              value={answers[prompt.id] || ""}
              onChange={(event) => {
                setAnswers((current) => ({ ...current, [prompt.id]: event.target.value }));
                setComplete(false);
              }}
              aria-describedby={`ssp-report-${prompt.id}-hint`}
              className="mt-2 w-full rounded-sm border-0 border-b-2 border-forest/30 bg-paper px-3 py-3 text-base text-forestdeep focus:border-forest focus:outline-none focus:ring-2 focus:ring-gold/60"
            />
            <p id={`ssp-report-${prompt.id}-hint`} className="mt-2 text-sm leading-relaxed text-graphite/70">{prompt.hint}</p>
          </div>
        ))}
      </div>
      <p className="mt-6 text-xs leading-relaxed text-graphite/70">This is for your team to discuss, not to turn in. Your answers stay here as you review the steps; refreshing the page clears them.</p>
      <button type="submit" className="mt-4 inline-flex min-h-11 items-center justify-center rounded-sm bg-gold px-5 py-3 text-sm font-medium text-forestdeep hover:bg-goldlight focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-forest">Create our report</button>
    </form>
  );
}
