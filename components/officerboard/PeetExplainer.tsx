"use client";

import { useEffect, useRef, useState } from "react";
import Modal from "./Modal";
import styles from "./officerboard.module.css";

const titles = ["A clearer picture of your contribution.", "Three pillars. One shared standard.", "Understand your score.", "Initiative counts, too."];

export default function PeetExplainer({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState(0);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus(); }, [step]);
  return <Modal title="What is PEET?" onClose={onClose}>
    <div key={step} className={styles.slide}>
      <p className={styles.step}>What is PEET? · {step + 1} of 4</p>
      <h2 ref={heading} tabIndex={-1} className={styles.modalTitle}>{titles[step]}</h2>
      {step === 0 && <p className={styles.explainerCopy}>As part of CAGE (Competency Analysis of Green Engineering), we are implementing PEET to transparently evaluate officer performance, reliability, and competency.</p>}
      {step === 1 && <div className={styles.pillars}>
        <article><span aria-hidden="true">E</span><h3>Efficiency</h3><p>Use time and resources thoughtfully. Make steady progress with what you have.</p></article>
        <article><span aria-hidden="true">E</span><h3>Effectiveness</h3><p>Deliver quality work that meets the task’s objectives and makes a useful contribution.</p></article>
        <article><span aria-hidden="true">T</span><h3>Time</h3><p>Meet deadlines and communicate proactively when plans or timelines change.</p></article>
      </div>}
      {step === 2 && <>
        <p className={styles.explainerCopy}>Each task receives a score from 1–4 for Efficiency, Effectiveness, and Time. The three scores are averaged per task; evaluated tasks carry equal weight in your overall score.</p>
        <div className={styles.formula}>Average r ≤ 3: 85 + 20 × (r − 3); average r &gt; 3: 85 + 15 × (r − 3)</div>
        <p className={styles.explainerCopy}><strong>85/100 = Meets Expectations.</strong> A 3.0 average represents solid standard compliance; 3.5 earns 92.5/100 and 4.0 earns 100/100. Officers aren’t expected to score 4 on every task. Tasks awaiting review do not affect your score, and low scores do not automatically issue strikes.</p>
      </>}
      {step === 3 && <>
        <p className={styles.explainerCopy}>See something that needs doing? Add a self-initiated task, set a deadline, and submit a description of your completed work, a supporting link, or both.</p>
        <ol className={styles.steps}><li>Log your task and what you plan to deliver.</li><li>Submit your finished work for review.</li><li>Receive an official PEET evaluation and feedback from executive leadership or an advisor.</li></ol>
        <p className={styles.explainerCopy}>Your history keeps the scores and feedback together, so you can see how your work develops.</p>
      </>}
    </div>
    <div className={styles.modalActions}>
      <button className={styles.secondary} onClick={step ? () => setStep(step - 1) : onClose}>{step ? "Back" : "Not now"}</button>
      <button className={styles.primary} onClick={step === 3 ? onClose : () => setStep(step + 1)}>{step === 3 ? "Go to my board" : "Continue"}</button>
    </div>
  </Modal>;
}
