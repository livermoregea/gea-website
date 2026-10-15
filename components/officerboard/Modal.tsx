"use client";

import { useEffect, useRef, type ReactNode } from "react";
import styles from "./officerboard.module.css";

export default function Modal({ title, children, onClose, busy = false }: {
  title: string; children: ReactNode; onClose: () => void; busy?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current!;
    const focused = document.activeElement as HTMLElement | null;
    dialog.showModal();
    const heading = dialog.querySelector<HTMLElement>("h2");
    if (heading) { heading.tabIndex = -1; heading.focus(); }
    return () => { dialog.close(); if (focused?.isConnected) focused.focus(); };
  }, []);
  return <dialog ref={ref} className={styles.modal} aria-label={title}
    onCancel={event => { event.preventDefault(); if (!busy) onClose(); }}>
    <div className={styles.modalHeader}>
      <span className={styles.eyebrow}>GEA Officer Board</span>
      <button type="button" className={styles.secondary} onClick={onClose} disabled={busy}>Close</button>
    </div>
    {children}
  </dialog>;
}
