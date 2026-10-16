import type { ReactNode } from "react";
import styles from "./officerboard.module.css";

/** Native disclosure keeps section navigation usable with touch, keyboard and screen readers. */
export default function TaskSection({ title, count, hint, defaultOpen = false, children }: {
  title: string; count: number; hint?: string; defaultOpen?: boolean; children: ReactNode;
}) {
  return <details className={styles.taskSection} open={defaultOpen}>
    <summary className={styles.taskSectionSummary}>
      <span className={styles.disclosureChevron} aria-hidden="true" />
      <h3>{title}</h3>
      {hint && <span className={styles.sectionHint}>{hint}</span>}
      <span className={styles.badge}>{count}<span className="sr-only"> items</span></span>
    </summary>
    <div className={styles.taskSectionBody}>{children}</div>
  </details>;
}
