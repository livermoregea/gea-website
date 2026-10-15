import { productLink, type OfficerTask } from "@/lib/peet";
import styles from "./officerboard.module.css";

export default function OfficerTaskSubmission({ task }: { task: OfficerTask }) {
  const url = productLink(task.final_product_url);
  if (!task.submission_description && !url) return null;
  return <div className={styles.submission}>
    <h4>Submitted work</h4>
    {task.submission_description && <p className={styles.description}>{task.submission_description}</p>}
    {url && <a href={url} target="_blank" rel="noopener noreferrer" className={styles.link}>
      View supporting link<span className="sr-only"> for {task.title} (opens in a new tab)</span> ↗
    </a>}
  </div>;
}
