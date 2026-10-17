import type { OperationsData } from '@/lib/gea-operations-data';
import type { OfficerProfile, OfficerTask, PeetEvaluation } from '@/lib/peet';
import { officerDashboard } from '@/lib/officer-dashboard';
import { CONTRACT_YEAR, durationLabel, schoolDate, schoolToday, type TrackingData } from '@/lib/officer-tracking';
import s from './operations.module.css';

export default function OfficerDashboard({ profile, profiles, tasks, evaluations, tracking, data }: {
  profile: OfficerProfile; profiles: OfficerProfile[]; tasks: OfficerTask[]; evaluations: PeetEvaluation[];
  tracking: TrackingData; data: OperationsData;
}) {
  const summary = officerDashboard(profile, profiles, tasks, evaluations, tracking, data.reviewer, CONTRACT_YEAR);
  const record = (topic: string, id?: string) => `${data.workspaceHref}?${new URLSearchParams({ view: 'tasks', topic, ...(id ? { officer: id } : {}) })}`;
  const now = new Date();
  const upcoming = data.calendar.filter(item => item.allDay ? item.start >= schoolToday(now) : new Date(item.end || item.start) >= now).slice(0, 5);
  return <div className={s.dashboard}>
    <div className={s.panelHeading}>
      <div><h2 className={s.dashboardTitle}>{data.reviewer ? 'Team at a glance' : 'My progress'}</h2><p className={s.muted}>Participation · {CONTRACT_YEAR}. PEET and task totals include all school years.</p></div>
      <a className={s.detailLink} href={`${data.workspaceHref}?view=${data.reviewer ? "people" : "tasks"}`}>{data.reviewer ? 'Open officer records' : 'Open my tasks'} →</a>
    </div>
    <div className={s.dashboardMetrics} aria-label={data.reviewer ? 'Team progress summary' : 'My progress summary'}>
      <a href={record('tasks')}><h3>{data.reviewer ? 'Team PEET average' : 'PEET score'}</h3><strong>{summary.score === null ? '—' : summary.score.toFixed(1)}<small> /100</small></strong><p>{data.reviewer ? `${summary.scoredOfficers} evaluated ${summary.scoredOfficers === 1 ? 'officer' : 'officers'}` : summary.score === null ? 'No evaluated tasks yet' : `${summary.work.evaluated} evaluated tasks`}</p></a>
      <a href={record('attendance')}><h3>Meetings attended</h3><strong>{summary.attended}</strong><p>{data.reviewer ? 'Officer attendances · ' : ''}{summary.excused} excused · {summary.unexcused} unexcused</p></a>
      <a href={record('volunteer')}><h3>Verified service</h3><strong>{durationLabel(summary.serviceMinutes)}</strong><p>Approved hours · {CONTRACT_YEAR}</p></a>
      <a href={record('tasks')}><h3>Active tasks</h3><strong>{summary.work.active}</strong><p>{summary.work.completed} completed · {summary.submitted} awaiting review</p></a>
    </div>
    <div className={data.reviewer ? s.dashboardColumns : s.readingColumn}>
      {data.reviewer && <section className={s.panel} aria-label="Officer progress snapshot">
        <div className={s.panelHeading}><h2>Officer progress</h2><span className={s.muted}>{summary.officers.length} officers</span></div>
        <p className={s.muted}>Choose a name for their detailed record.</p>
        <div className={s.officerSnapshot}>
          <div className={s.snapshotHeading} aria-hidden="true"><span>Officer</span><span>PEET /100</span><span>Attended</span><span>Service</span><span>Active</span></div>
          {summary.officers.map(({ person, peet, participation }) => <a className={s.snapshotRow} href={record('overview', person.id)} key={person.id}>
            <div><strong>{person.name}</strong><p className={s.muted}>{person.position || 'Officer'}</p></div>
            <div><span className={s.snapshotLabel}>PEET /100</span>{peet.score === null ? '—' : peet.score.toFixed(1)}</div>
            <div><span className={s.snapshotLabel}>Attended</span>{participation.present}</div>
            <div><span className={s.snapshotLabel}>Service</span>{durationLabel(participation.volunteerMinutes)}</div>
            <div><span className={s.snapshotLabel}>Active tasks</span>{peet.active}</div>
          </a>)}
        </div>
        {!summary.officers.length && <p className={s.muted}>No active officers are on the roster yet.</p>}
      </section>}
      <section className={s.panel} aria-label="Upcoming schedule">
        <div className={s.panelHeading}><h2>Coming up</h2><a className={s.detailLink} href={`${data.workspaceHref}?view=calendar`}>Calendar →</a></div>
        {upcoming.map(item => <a className={s.updateRow} href={item.href} key={item.id}><span className={s.badge}>{item.kind === 'task' ? 'Task deadline' : item.kind}</span><h3>{item.title}</h3><p className={s.muted}>{schoolDate(item.start, !item.allDay)}{item.location ? ` · ${item.location}` : ''}</p></a>)}
        {!upcoming.length && <p className={s.muted}>No upcoming events or task deadlines.</p>}
      </section>
    </div>
  </div>;
}
