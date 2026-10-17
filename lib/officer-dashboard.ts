import { isOfficerTaskParticipant, peetSummary, taskOfficers, type OfficerProfile, type OfficerTask, type PeetEvaluation } from './peet';
import { trackingSummary, type TrackingData } from './officer-tracking';

/** Uses the same PEET and participation rules as the detailed officer records. */
export function officerDashboard(profile: OfficerProfile, profiles: OfficerProfile[], tasks: OfficerTask[], evaluations: PeetEvaluation[], tracking: TrackingData, reviewer: boolean, year: string) {
  const people = reviewer ? taskOfficers(profiles) : [profiles.find(person => person.id === profile.id) ?? profile];
  const officers = people.map(person => ({
    person,
    peet: peetSummary(tasks.filter(task => isOfficerTaskParticipant(task, person.id)), evaluations),
    participation: trackingSummary(tracking, person.id, year),
  }));
  const visibleTasks = tasks.filter(task => people.some(person => isOfficerTaskParticipant(task, person.id)));
  const work = peetSummary(visibleTasks, evaluations);
  const scored = officers.filter(row => row.peet.score !== null);
  return {
    officers, work,
    score: scored.length ? scored.reduce((total, row) => total + row.peet.score!, 0) / scored.length : null,
    scoredOfficers: scored.length,
    attended: officers.reduce((total, row) => total + row.participation.present, 0),
    excused: officers.reduce((total, row) => total + row.participation.excused, 0),
    unexcused: officers.reduce((total, row) => total + row.participation.unexcused, 0),
    serviceMinutes: officers.reduce((total, row) => total + row.participation.volunteerMinutes, 0),
    submitted: visibleTasks.filter(task => !task.cancelled_at && task.status === 'submitted').length,
  };
}
