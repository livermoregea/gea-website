import type { OperationsData } from '@/lib/gea-operations-data';
import { isOfficerTaskParticipant, type OfficerProfile, type OfficerTask, type PeetEvaluation } from '@/lib/peet';
import { officerDashboard, officerWorkQueue, sortOfficerTasks } from '@/lib/officer-dashboard';
import { CONTRACT_YEAR, durationLabel, schoolDate, schoolToday, type TrackingData } from '@/lib/officer-tracking';
import s from './operations.module.css';

export default function OfficerDashboard({ profile, profiles, tasks, evaluations, tracking, data, clarificationTaskIds = [] }: {
  profile: OfficerProfile; profiles: OfficerProfile[]; tasks: OfficerTask[]; evaluations: PeetEvaluation[];
  tracking: TrackingData; data: OperationsData; clarificationTaskIds?: string[];
}) {
  const summary = officerDashboard(profile, profiles, tasks, evaluations, tracking, data.reviewer, CONTRACT_YEAR);
  const own = officerWorkQueue(tasks, profile.id, clarificationTaskIds);
  const record = (topic: string, id?: string) => `${data.workspaceHref}?${new URLSearchParams({ view: topic === 'tasks' ? 'tasks' : 'people', topic, ...(id ? { officer: id } : {}) })}`;
  const taskHref = (task: OfficerTask, action?: string) => `${data.workspaceHref}?${new URLSearchParams({ view: 'tasks', task: task.id, ...(action ? { action } : {}) })}`;
  const now = new Date(), today = schoolToday(now);
  const upcoming = data.calendar.filter(item => item.kind !== 'task' && (item.allDay ? item.start >= today : new Date(item.end || item.start) >= now)).slice(0, 3);
  const overdue = own.toComplete.filter(task => task.status === 'in_progress' && task.due_date && task.due_date < today).length;
  const reviews = sortOfficerTasks(tasks.filter(task => !task.cancelled_at && task.status === 'submitted' && !isOfficerTaskParticipant(task, profile.id)));
  return <div className={s.dashboard}>
    <div className={s.workOverview}>
      <div className={s.workMain}>
        {(!data.reviewer || own.toComplete.length > 0 || own.awaitingReview.length > 0) && <section className={s.workCard} aria-label="Your assigned tasks">
          <div className={s.workHeading}><div><h2>My tasks <span className={s.workCount}>{own.toComplete.length}</span></h2><p>{own.toComplete.length ? `${own.toComplete.length} to complete${overdue ? ` · ${overdue} overdue` : ''}` : 'No tasks to complete right now.'}</p></div><a className={s.detailLink} href={record('tasks', data.reviewer ? profile.id : undefined)}>All my tasks →</a></div>
          {own.toComplete.slice(0, 6).map(task => {
            const answersNeeded = clarificationTaskIds.includes(task.id);
            const late = !answersNeeded && task.due_date && task.due_date < today;
            return <div className={s.workRow} key={task.id}><div><h3>{task.title}</h3><p className={late || answersNeeded ? s.workUrgent : s.muted}>{answersNeeded ? 'Your clarification answers are needed' : !task.due_date ? 'No deadline set' : `${late ? 'Overdue · ' : task.due_date === today ? 'Due today · ' : 'Due '}${schoolDate(task.due_date, false)}`}</p></div><a className={s.workAction} href={taskHref(task, 'submit')}>{answersNeeded ? 'Answer questions' : 'Submit work'}<span className="sr-only"> for {task.title}</span><span aria-hidden="true"> →</span></a></div>;
          })}
          {own.toComplete.length > 6 && <a className={s.detailLink} href={record('tasks', data.reviewer ? profile.id : undefined)}>View {own.toComplete.length - 6} more tasks →</a>}
          {own.awaitingReview.length > 0 && <details className={s.quietDisclosure}><summary>{own.awaitingReview.length} {own.awaitingReview.length === 1 ? 'submission' : 'submissions'} awaiting review</summary>{own.awaitingReview.map(task => <a className={s.waitingRow} href={taskHref(task, 'submit')} key={task.id}><span>{task.title}</span><span>View submission →</span></a>)}</details>}
        </section>}
        {data.reviewer && <section className={s.workCard} aria-label="Tasks ready for review"><div className={s.workHeading}><div><h2>Ready for review <span className={s.workCount}>{reviews.length}</span></h2><p>{reviews.length ? 'Submitted work waiting for a decision.' : 'No task submissions waiting for review.'}</p></div><a className={s.detailLink} href={record('tasks')}>All team tasks →</a></div>
          {reviews.slice(0, 5).map(task => <div className={s.workRow} key={task.id}><div><h3>{task.title}</h3><p className={s.muted}>{profiles.find(person => person.id === task.assigned_to)?.name || 'Officer'}{task.submitted_at ? ` · Submitted ${schoolDate(task.submitted_at, false)}` : ''}</p></div><a className={s.workAction} href={taskHref(task, 'review')}>Open review<span className="sr-only"> for {task.title}</span><span aria-hidden="true"> →</span></a></div>)}
        </section>}
      </div>
      <aside className={s.scheduleCard} aria-label="Upcoming schedule"><div className={s.workHeading}><h2>Coming up</h2><a className={s.detailLink} href={`${data.workspaceHref}?view=calendar`}>Calendar →</a></div>
        {upcoming.map(item => <a className={s.scheduleRow} href={item.href} key={item.id}><span>{schoolDate(item.start, !item.allDay)}</span><h3>{item.title}</h3>{item.location && <p>{item.location}</p>}</a>)}
        {!upcoming.length && <p className={s.muted}>No upcoming meetings or events.</p>}
      </aside>
    </div>
    <details className={s.progressDetails}><summary>{data.reviewer ? 'Team progress & officer records' : 'My progress'}<span>PEET · attendance · service</span></summary>
      <div className={s.dashboardMetrics} aria-label={data.reviewer ? 'Team progress summary' : 'My progress summary'}>
        <a href={record('tasks')}><h3>{data.reviewer ? 'Team PEET average' : 'PEET score'}</h3><strong>{summary.score === null ? '—' : summary.score.toFixed(1)}<small> /100</small></strong><p>{data.reviewer ? `${summary.scoredOfficers} evaluated officers` : `${summary.work.evaluated} evaluated tasks`}</p></a>
        <a href={record('attendance')}><h3>Meetings attended</h3><strong>{summary.attended}</strong><p>{summary.excused} excused · {summary.unexcused} unexcused</p></a>
        <a href={record('volunteer')}><h3>Verified service</h3><strong>{durationLabel(summary.serviceMinutes)}</strong><p>{CONTRACT_YEAR}</p></a>
        <a href={record('tasks')}><h3>Active tasks</h3><strong>{summary.work.active}</strong><p>{summary.work.completed} completed · {summary.submitted} awaiting review</p></a>
      </div>
      <p className={s.muted}>Participation · {CONTRACT_YEAR}. PEET and task totals include all school years.</p>
      {data.reviewer && <section aria-label="Officer progress snapshot"><div className={s.panelHeading}><h2>Officer progress</h2><a className={s.detailLink} href={`${data.workspaceHref}?view=people`}>Open officer records →</a></div>
        <div className={s.officerSnapshot}><div className={s.snapshotHeading} aria-hidden="true"><span>Officer</span><span>PEET /100</span><span>Attended</span><span>Service</span><span>Active</span></div>
          {summary.officers.map(({ person, peet, participation }) => <a className={s.snapshotRow} href={record('overview', person.id)} key={person.id}><div><strong>{person.name}</strong><p className={s.muted}>{person.position || 'Officer'}</p></div><div><span className={s.snapshotLabel}>PEET /100</span>{peet.score === null ? '—' : peet.score.toFixed(1)}</div><div><span className={s.snapshotLabel}>Attended</span>{participation.present}</div><div><span className={s.snapshotLabel}>Service</span>{durationLabel(participation.volunteerMinutes)}</div><div><span className={s.snapshotLabel}>Active tasks</span>{peet.active}</div></a>)}
        </div>{!summary.officers.length && <p className={s.muted}>No active officers are on the roster yet.</p>}
      </section>}
    </details>
  </div>;
}
