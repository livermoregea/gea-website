"use client";

import styles from "./workspace-activity.module.css";

export default function WorkspaceActivity({ saving = false, refreshing = false, background = false, inline = false }: {
  saving?: boolean; refreshing?: boolean; background?: boolean; inline?: boolean;
}) {
  if (!saving && !refreshing) return null;
  return <div role="status" aria-live="polite" aria-atomic="true" className={inline ? styles.inline : styles.banner}>
    <span className={styles.spinner} aria-hidden="true" />
    <div><strong>{saving ? "Saving changes…" : "Updating workspace…"}</strong>
      <p>{saving ? "Please wait while your changes are saved." : background ? "Refreshing in the background. You can keep working." : "Loading your latest changes. Please wait a moment."}</p>
    </div>
  </div>;
}
