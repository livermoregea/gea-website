"use client";

import controls from "@/components/workspace-controls.module.css";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import { downloadArchiveCsv, printArchivePdf, type ApplicationArchive } from "@/lib/application-export";
import { markAllAdminNotificationsSeen } from "@/lib/admin-notifications";

type ArchiveSummary = Pick<ApplicationArchive, "id" | "created_at" | "application_count" | "cleared_at">;

export default function AdminApplicationArchive({ onCleared }: { onCleared: (count: number) => void }) {
  const [archive, setArchive] = useState<ApplicationArchive | null>(null);
  const [history, setHistory] = useState<ArchiveSummary[]>([]);
  const [busy, setBusy] = useState(false);
  const [exported, setExported] = useState(false);
  const [saved, setSaved] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function loadHistory() {
    if (!hasSupabaseConfig()) return;
    const { data, error } = await createClient().from("application_archives")
      .select("id, created_at, application_count, cleared_at").order("created_at", { ascending: false }).limit(20);
    if (!error) setHistory(data ?? []);
  }
  useEffect(() => { loadHistory(); }, []);

  async function prepare() {
    setBusy(true);
    setMessage(null);
    try {
      const { data, error } = await createClient().rpc("prepare_application_archive");
      if (error) throw new Error(error.message.includes("function") ? "Archive setup is required. Run the application-archives.sql migration in Supabase." : error.message);
      setArchive(data as ApplicationArchive);
      setExported(false);
      setSaved(false);
      await loadHistory();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not create the archive. No applications were deleted."); }
    finally { setBusy(false); }
  }

  function exportArchive(value: ApplicationArchive, format: "csv" | "pdf") {
    try {
      if (format === "csv") downloadArchiveCsv(value); else printArchivePdf(value);
      if (value.id === archive?.id) { setExported(true); setSaved(false); }
      setMessage(format === "pdf" ? "Choose Save as PDF in the print dialog, then confirm you saved the file." : "CSV download started. Confirm you saved the file before clearing applications.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Export failed. No applications were deleted."); }
  }

  async function exportPrevious(id: string, format: "csv" | "pdf") {
    setBusy(true);
    try {
      const { data, error } = await createClient().from("application_archives").select("*").eq("id", id).single();
      if (error) throw new Error("Could not load this archive.");
      exportArchive(data as ApplicationArchive, format);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not export archive."); }
    finally { setBusy(false); }
  }

  async function clear() {
    if (!archive || !exported || !saved || busy) return;
    if (!window.confirm(`Delete the ${archive.application_count} exported applications from the active queue and release their interview slots? A saved archive will remain available. This cannot be undone from this page.`)) return;
    setBusy(true);
    try {
      const { data, error } = await createClient().rpc("clear_archived_applications", { p_archive_id: archive.id });
      if (error) throw new Error(error.message);
      markAllAdminNotificationsSeen({ applications: archive.applications.map((app) => String(app.id)) });
      setArchive(null);
      setMessage(`${data} applications cleared. The archive is saved; applications received after the export remain in the queue.`);
      await loadHistory();
      onCleared(Number(data));
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not clear applications. Please try again."); }
    finally { setBusy(false); }
  }

  return <section className="rounded-[8px] border border-forest/15 bg-paper p-5">
    <h3 className="font-display text-xl text-forest">Prepare for next year</h3>
    <p className="mt-2 text-sm text-graphite/80">Archive all applications, export a copy as CSV or PDF, then clear the active queue. Student accounts stay in place.</p>
    <button type="button" onClick={prepare} disabled={busy || !hasSupabaseConfig()} className={`${controls.control} mt-4 rounded-[8px] bg-forest px-4 py-2 text-sm text-white disabled:opacity-50`}>{busy ? "Working…" : "Archive all applications"}</button>
    {archive && <div className="mt-4 space-y-3 rounded-[8px] border border-forest/15 p-4">
      <p className="text-sm text-forest">Archive saved: {archive.application_count} applications. Export your copy before deleting.</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={busy} onClick={() => exportArchive(archive, "csv")} className={`${controls.control} rounded-[8px] border border-forest/20 px-4 py-2 text-sm text-forest`}>Export CSV</button>
        <button type="button" disabled={busy} onClick={() => exportArchive(archive, "pdf")} className={`${controls.control} rounded-[8px] border border-forest/20 px-4 py-2 text-sm text-forest`}>Export PDF</button>
      </div>
      <label className="flex items-center gap-2 text-sm text-graphite/80"><input type="checkbox" checked={saved} disabled={!exported || busy} onChange={(event) => setSaved(event.target.checked)} />I have saved the exported file.</label>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={clear} disabled={!exported || !saved || busy} className={`${controls.control} rounded-[8px] bg-red-700 px-4 py-2 text-sm text-white disabled:opacity-50`}>Delete exported applications</button>
        <button type="button" disabled={busy} onClick={() => setArchive(null)} className={`${controls.control} rounded-[8px] border border-forest/20 px-4 py-2 text-sm text-forest`}>Cancel</button>
      </div>
    </div>}
    {message && <p role="status" className="mt-3 text-sm text-graphite/80">{message}</p>}
    {history.length > 0 && <details className="mt-5 text-sm text-forest"><summary className="cursor-pointer">Recent saved archives</summary><ul className="mt-3 space-y-3">{history.map((item) => <li key={item.id} className="flex flex-wrap items-center gap-3">
      <span>{new Date(item.created_at).toLocaleString()} · {item.application_count} applications · {item.cleared_at ? "Queue cleared" : "Saved only"}</span>
      <button type="button" disabled={busy} onClick={() => exportPrevious(item.id, "csv")} className={`${controls.control} underline`}>CSV</button>
      <button type="button" disabled={busy} onClick={() => exportPrevious(item.id, "pdf")} className={`${controls.control} underline`}>PDF</button>
    </li>)}</ul></details>}
  </section>;
}
