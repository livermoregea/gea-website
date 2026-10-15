export type ApplicationArchive = {
  id: string;
  created_at: string;
  application_count: number;
  applications: Record<string, unknown>[];
  interview_slots: Record<string, unknown>[];
  cleared_at: string | null;
};

export function archiveRows(archive: ApplicationArchive): Record<string, unknown>[] {
  return archive.applications.map((app) => {
    const slot = archive.interview_slots.find((slot) => slot.id === app.booked_slot_id);
    return { ...app, booked_slot_label: slot?.label ?? "", booked_slot_time: slot?.slot_time ?? "" };
  });
}

export function applicationsCsv(rows: Record<string, unknown>[]) {
  const headers = Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
  const escape = (value: unknown) => {
    let text = value == null ? "" : String(value);
    // Neutralize spreadsheet formulas in applicant-controlled fields.
    if (/^[\s]*[=+@-]/.test(text)) text = "'" + text;
    return `"${text.replaceAll('"', '""')}"`;
  };
  return "\uFEFF" + [headers.map(escape).join(","), ...rows.map((row) => headers.map((key) => escape(row[key])).join(","))].join("\r\n");
}

export function downloadArchiveCsv(archive: ApplicationArchive) {
  const url = URL.createObjectURL(new Blob([applicationsCsv(archiveRows(archive))], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `applications-archive-${archive.created_at.slice(0, 10)}-${archive.id.slice(0, 8)}.csv`;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function archivePrintHtml(archive: ApplicationArchive) {
  const escape = (value: unknown) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]!));
  return `<!doctype html><html><head><title>GEA application archive ${escape(archive.created_at.slice(0, 10))}</title><style>
    body{font:14px system-ui;color:#123524;margin:32px}h1{font-size:24px}h2{font-size:20px}dt{font-weight:bold;margin-top:12px}dd{margin:4px 0;white-space:pre-wrap;overflow-wrap:anywhere}section{break-before:page}section:first-of-type{break-before:auto}dt{break-after:avoid}@page{margin:18mm}
    </style></head><body><h1>GEA application archive</h1><p>${archive.application_count} applications · ${escape(archive.created_at)}</p>
    ${archiveRows(archive).map((row) => `<section><h2>${escape(row.name)}</h2><dl>${Object.entries(row).map(([key, value]) => `<dt>${escape(key.replaceAll("_", " "))}</dt><dd>${escape(value)}</dd>`).join("")}</dl></section>`).join("")}</body></html>`;
}

export function printArchivePdf(archive: ApplicationArchive) {
  const popup = window.open("", "_blank");
  if (!popup) throw new Error("Allow popups to export PDF, then try again.");
  popup.document.write(archivePrintHtml(archive));
  popup.document.close();
  popup.focus();
  popup.setTimeout(() => popup.print(), 250);
}
