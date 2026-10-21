import type { DiscordMessage } from '@/lib/discord';
import { button, row, type Interaction } from './protocol';
import { schoolDate } from '@/lib/officer-tracking';

type RollRow = { officer_id: string; name: string; position: string; status: string; original_status: string };
export type RollCall = { id: string; event_title: string; starts_at: string; started: boolean; version: number; page: number; selected: string[]; rows: RollRow[]; saved: boolean; discarded: boolean };
type Events = { events: { id: string; title: string; starts_at: string; kind: string }[]; page: number; has_more: boolean };
type Perform = (action: string, args: Record<string, unknown>, key?: string) => Promise<any>;
const labels: Record<string, string> = { unmarked: 'Not recorded', present: 'Present', late: 'Tardy', excused: 'Excused', unexcused: 'Unexcused' };
const control = (label: string, id: string, disabled = false, style = 1) => ({ ...button(label, id, style), disabled });
export function rollCallMessage(state: RollCall): DiscordMessage {
  const changed = state.rows.filter(r => r.status !== r.original_status).length;
  if (state.saved || state.discarded) return { content: state.saved ? `Attendance saved for **${state.event_title}** (${changed} updated).` : `Roll call discarded for **${state.event_title}**. No attendance was saved.`, components: [] };
  const page = state.rows.slice(state.page * 25, (state.page + 1) * 25);
  const selected = new Set(state.selected);
  const id = (action: string, value = '') => `roll:${action}:${state.id}:${state.version}${value ? ':' + value : ''}`;
  const components: unknown[] = [];
  if (page.length) components.push(row({ type: 3, custom_id: id('select'), placeholder: 'Select officers to update', min_values: 1, max_values: page.length,
    options: page.map(r => ({ label: r.name.slice(0, 100), value: r.officer_id, description: `${r.position || 'Officer'} · ${labels[r.status]}`.slice(0, 100), default: selected.has(r.officer_id) })),
  }));
  if (page.length) components.push(row(...['present', 'late', 'excused', 'unexcused', 'unmarked'].map(status => control(labels[status], id('status', status), !selected.size || (!state.started && ['present', 'late', 'unexcused'].includes(status)), 2))));
  components.push(row(control('Mark all present', id('all'), !state.started || !state.rows.some(r => r.status === 'unmarked'), 2), control('Save attendance', id('save'), !changed, 3), control('Discard', id('discard'), false, 4)));
  if (state.rows.length > 25) components.push(row(control('Previous officers', id('page', String(state.page - 1)), state.page === 0, 2), control('Next officers', id('page', String(state.page + 1)), (state.page + 1) * 25 >= state.rows.length, 2)));
  return { content: [`**${state.event_title}** · ${schoolDate(state.starts_at)}`,
    'Select officers, choose a status, then **Save attendance**. Mark all present fills unmarked officers only.',
    `${changed} unsaved changes · ${selected.size} selected · Page ${state.page + 1}/${Math.max(1, Math.ceil(state.rows.length / 25))}`,
    ...page.map(r => `${r.status !== r.original_status ? '* ' : ''}${r.name.slice(0, 36)} — ${labels[r.status]}`),
    ...(!state.started ? ['Actual attendance can be marked after the event starts.'] : []),
  ].join('\n').slice(0, 1950), components };
}
function eventMessage(data: Events): DiscordMessage {
  const components: unknown[] = [];
  if (data.events.length) components.push(row({ type: 3, custom_id: 'roll:open', placeholder: 'Choose a meeting or event', options: data.events.map(event => ({ label: event.title.slice(0, 100), value: event.id, description: schoolDate(event.starts_at).slice(0, 100) })) }));
  if (data.page || data.has_more) components.push(row(control('Previous events', `roll:events:${data.page - 1}`, !data.page, 2), control('More events', `roll:events:${data.page + 1}`, !data.has_more, 2)));
  return { content: data.events.length ? 'Choose a meeting or event to take roll. Events nearest to today appear first.' : 'No available meetings or events. Ask a reviewer to schedule one.', components };
}
export async function rollCallResponse(i: Interaction, perform: Perform): Promise<DiscordMessage> {
  const [, action, session, version, value] = (i.data?.custom_id || '').split(':');
  if (i.type === 2 || action === 'events') return eventMessage(await perform('events', { page: action === 'events' ? Number(session) : 0 }));
  if (action === 'open') return rollCallMessage(await perform('open', { event: i.data?.values?.[0] }, i.id));
  const args: Record<string, unknown> = { session, version: Number(version) };
  if (action === 'select') args.officers = i.data?.values;
  if (action === 'status') args.status = value;
  if (action === 'page') args.page = Number(value);
  return rollCallMessage(await perform(action, args, i.id));
}
