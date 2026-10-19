import type { OfficerTask } from './peet';
import { schoolToday } from './officer-tracking';
export type AttentionItem = {
    key: string;
    title: string;
    detail: string;
    href: string;
    date?: string;
    category: string;
};
export type CalendarItem = {
    id: string;
    title: string;
    start: string;
    end?: string;
    allDay?: boolean;
    kind: string;
    location?: string;
    href: string;
};
export type MeetingNotes = {
    agenda_doc_url?: string | null;
    notes_doc_url?: string | null;
    event_id: string;
    minutes: string;
    decisions: string;
    version: number;
    updated_at: string;
};
export type AgendaItem = {
    id: string;
    event_id: string;
    author_id: string;
    title: string;
    details: string;
    task_id: string | null;
};
export type EventPlan = {
    event_id: string;
    organizer_id: string | null;
    planning_doc_url?: string | null;
    version: number;
};
export type Blocker = {
    task_id: string;
    officer_id: string;
    helper_id: string | null;
    reason: string;
    resolved_at: string | null;
    updated_at: string;
};
export type Digest = {
    id: string;
    week_of: string;
    items: AttentionItem[];
};
export function taskAttention(tasks: OfficerTask[], reviewer: boolean, taskHref: string, today = schoolToday()): AttentionItem[] {
    const soon = new Date(`${today}T12:00:00Z`);
    soon.setUTCDate(soon.getUTCDate() + 7);
    const last = soon.toISOString().slice(0, 10);
    return tasks.filter(t => !t.cancelled_at && t.status !== 'completed').flatMap(t => {
        if (reviewer && t.status === 'submitted' && (!t.individual_peet || t.contributions?.some(row => row.status === 'pending')))
            return [{ key: `task-review:${t.id}:${t.submitted_at}`, title: t.title, detail: 'Submission awaiting review', href: `${taskHref}?task=${encodeURIComponent(t.id)}`, date: t.submitted_at ?? undefined, category: 'Review' }];
        if (t.status === 'in_progress' && t.due_date && t.due_date <= last)
            return [{ key: `task-due:${t.id}:${t.due_date}`, title: t.title, detail: t.due_date < today ? 'Overdue task' : 'Due in the next seven days', href: `${taskHref}?task=${encodeURIComponent(t.id)}`, date: t.due_date, category: 'Tasks' }];
        return [];
    });
}
function escapeIcs(value: string) { return value.replace(/\\/g, '\\\\').replace(/\r\n|\r|\n/g, '\\n').replace(/;/g, '\\;').replace(/,/g, '\\,'); }
function stamp(value: string) { return new Date(value).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, ''); }
export function calendarIcs(items: CalendarItem[], now = new Date()): string {
    const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//GEA One//Calendar//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH'];
    for (const item of items) {
        lines.push('BEGIN:VEVENT', `UID:${escapeIcs(item.id)}@gea-one`, `DTSTAMP:${stamp(now.toISOString())}`, `SUMMARY:${escapeIcs(item.title)}`);
        if (item.allDay) {
            const next = new Date(`${item.start}T12:00:00Z`);
            next.setUTCDate(next.getUTCDate() + 1);
            lines.push(`DTSTART;VALUE=DATE:${item.start.replace(/-/g, '')}`, `DTEND;VALUE=DATE:${next.toISOString().slice(0, 10).replace(/-/g, '')}`);
        }
        else {
            lines.push(`DTSTART:${stamp(item.start)}`);
            if (item.end)
                lines.push(`DTEND:${stamp(item.end)}`);
        }
        if (item.location)
            lines.push(`LOCATION:${escapeIcs(item.location)}`);
        lines.push('END:VEVENT');
    }
    lines.push('END:VCALENDAR');
    // RFC 5545 folds content at 75 octets, without splitting UTF-8 characters.
    return lines.map(line => { let out = '', chunk = '', bytes = 0; for (const char of line) {
        const size = new TextEncoder().encode(char).length;
        if (bytes + size > 75) {
            out += chunk + '\r\n';
            chunk = ' ';
            bytes = 1;
        }
        chunk += char;
        bytes += size;
    } return out + chunk; }).join('\r\n') + '\r\n';
}
export function downloadFile(name: string, content: string, type: string) {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}
