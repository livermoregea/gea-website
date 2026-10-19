import type { OperationsData } from '@/lib/gea-operations-data';
import { isOfficerTaskParticipant, peetSummary, type OfficerProfile, type OfficerTask, type PeetEvaluation } from '@/lib/peet';
import { CONTRACT_YEAR, schoolDate } from '@/lib/officer-tracking';
import { CAGE_NAME, currentCageScore, type CageScore } from '@/lib/cage';
import s from './operations.module.css';

export default function OfficerScores({ profile, tasks, evaluations, data, cageScore = null }: {
  profile: OfficerProfile; tasks: OfficerTask[]; evaluations: PeetEvaluation[];
  data: Pick<OperationsData, 'reviewer' | 'workspaceHref'>; cageScore?: CageScore | null;
}) {
  const personalPeet = peetSummary(tasks.filter(task => isOfficerTaskParticipant(task, profile.id)), evaluations, profile.id);
  const cage = currentCageScore(cageScore, profile.id, CONTRACT_YEAR);
  const taskHref = `${data.workspaceHref}?${new URLSearchParams({view: 'tasks', topic: 'tasks', ...(data.reviewer ? {officer: profile.id} : {})})}`;
  return (
    <section className={s.personalScores} aria-labelledby="personal-scores-heading">
      <h2 id="personal-scores-heading">My scores</h2>
      <div className={s.scoreGrid}>
        <article><h3>PEET score</h3><p className={s.scoreValue}>{personalPeet.score === null ? 'N/A' : <>{personalPeet.score.toFixed(1)}<span> /100</span></>}</p><p>{personalPeet.evaluated ? `${personalPeet.evaluated} evaluated ${personalPeet.evaluated === 1 ? 'task' : 'tasks'}` : 'No evaluated tasks yet'}</p><a href={taskHref}>View my tasks →</a></article>
        <article><h3>CAGE score</h3><p className={s.scoreValue}>{cage ? cage.score!.toFixed(1) : 'N/A'}</p>{cage && <p>Calculated {schoolDate(cage.calculated_at!)}</p>}<p className={s.scoreScope}>{CONTRACT_YEAR}</p></article>
      </div>
      <p className={s.scoreExplanation}><strong>CAGE · {CAGE_NAME}.</strong> Combines attendance, confirmed strikes, and PEET. PEET includes all school years.</p>
    </section>
  );
}
