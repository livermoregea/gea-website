import type { OperationsData } from '@/lib/gea-operations-data';
import { isOfficerTaskParticipant, peetSummary, type OfficerProfile, type OfficerTask, type PeetEvaluation } from '@/lib/peet';
import { CONTRACT_YEAR, trackingSummary, type TrackingData } from '@/lib/officer-tracking';
import { CAGE_NAME, CAGE_MAX_SCORE, calculateCageScore } from '@/lib/cage';
import s from './operations.module.css';

export default function OfficerScores({ profile, tasks, evaluations, data, tracking }: {
  profile: OfficerProfile; tasks: OfficerTask[]; evaluations: PeetEvaluation[];
  data: Pick<OperationsData, 'reviewer' | 'workspaceHref'>; tracking: TrackingData;
}) {
  const personalPeet = peetSummary(tasks.filter(task => isOfficerTaskParticipant(task, profile.id)), evaluations, profile.id);
  const strikes = trackingSummary(tracking, profile.id, CONTRACT_YEAR);
  const cage = calculateCageScore(personalPeet.score, strikes.attendanceStrikes, strikes.conductStrikes);
  const taskHref = `${data.workspaceHref}?${new URLSearchParams({view: 'tasks', topic: 'tasks', ...(data.reviewer ? {officer: profile.id} : {})})}`;
  return (
    <section className={s.personalScores} aria-labelledby="personal-scores-heading">
      <h2 id="personal-scores-heading">My scores</h2>
      <div className={s.scoreGrid}>
        <article><h3>PEET score</h3><p className={s.scoreValue}>{personalPeet.score === null ? 'N/A' : <>{personalPeet.score.toFixed(1)}<span> /100</span></>}</p>{personalPeet.score !== null && <p>{personalPeet.score.toFixed(1)}% grade</p>}<p>{personalPeet.evaluated ? `${personalPeet.evaluated} evaluated ${personalPeet.evaluated === 1 ? 'task' : 'tasks'}` : 'No evaluated tasks yet'}</p><a href={taskHref}>View my tasks →</a></article>
        <article><h3>CAGE score</h3><p className={s.scoreValue}>{cage === null ? 'N/A' : <>{cage.toFixed(1)}<span> /{CAGE_MAX_SCORE}</span></>}</p>{cage !== null && <p>{(cage / CAGE_MAX_SCORE * 100).toFixed(1)}% grade</p>}<p>{strikes.attendanceStrikes} attendance {strikes.attendanceStrikes === 1 ? 'strike' : 'strikes'} · {strikes.conductStrikes} conduct {strikes.conductStrikes === 1 ? 'strike' : 'strikes'}</p>{cage === null && <p>Available after your first PEET evaluation</p>}<p className={s.scoreScope}>{CONTRACT_YEAR}</p></article>
      </div>
      <p className={s.scoreExplanation}><strong>CAGE · {CAGE_NAME}.</strong> 50 + (0.4 × PEET) − (10 × attendance strikes) − (10 × conduct strikes). PEET includes all school years; confirmed strikes count for {CONTRACT_YEAR}.</p>
    </section>
  );
}
