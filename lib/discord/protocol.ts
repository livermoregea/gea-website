export type Interaction = {
  id: string; application_id: string; token: string; type: number; guild_id?: string;
  member?: { user: { id: string } }; user?: { id: string };
  data?: { name?: string; custom_id?: string; values?: string[]; options?: { name: string; value: string }[]; components?: { components?: { custom_id: string; value: string }[] }[] };
};
export const actorId = (interaction: Interaction) => interaction.member?.user.id || interaction.user?.id || '';
export const button = (label: string, custom_id: string, style = 1) => ({ type: 2, label, custom_id, style });
export const row = (...components: unknown[]) => ({ type: 1, components });
export function modal(custom_id: string, title: string, fields: { id: string; label: string; long?: boolean; required?: boolean; max?: number }[]) {
  return { type: 9, data: { custom_id, title, components: fields.map(field => row({ type: 4, custom_id: field.id, label: field.label, style: field.long ? 2 : 1, required: field.required !== false, max_length: field.max || 2000 })) } };
}
export function modalResponse(i: Interaction, saved?: Record<string, string>) {
  const response = blankModalResponse(i);
  if (response && saved) for (const row of response.data.components) for (const field of row.components) {
    const input = field as { custom_id: string; value?: string };
    if (typeof saved[input.custom_id] === 'string') input.value = saved[input.custom_id];
  }
  return response;
}
function blankModalResponse(i: Interaction) {
  const id = i.data?.custom_id || '';
  if (i.type !== 3) return null;
  if (id.startsWith('submit:')) return modal(id, 'Submit your contribution', [
    { id: 'notes', label: 'Your work, outcome, timing, and assistance', long: true },
    { id: 'link', label: 'Supporting link (optional)', required: false, max: 2048 },
  ]);
  if (id.startsWith('absence:')) return modal(id, 'Planned absence or tardiness', [{ id: 'notice', label: 'Absence or tardiness: timing and reason', long: true }]);
  if (id.startsWith('assign:')) return modal(id, 'Assign a task', [{ id: 'title', label: 'Task title', max: 200 }, { id: 'description', label: 'Goals, rubric expectations, and committee', long: true }, { id: 'due', label: 'Due date (YYYY-MM-DD)', required: false, max: 10 }]);
  if (id.startsWith('clarify:') || id.startsWith('reviewanswers:')) {
    const count = Number(id.split(':')[3]);
    if (!Number.isInteger(count) || count < 1 || count > 4) return null;
    return modal(id, 'Answer the questions in the message', Array.from({ length: count }, (_, n) => ({ id: `answer${n}`, label: `Answer to question ${n + 1}`, long: true })));
  }
  if (id.startsWith('revision:') || id.startsWith('reject:')) return modal(id, 'Reviewer feedback', [{ id: 'feedback', label: 'Explain the decision and what must change', long: true }]);
  if (id.startsWith('manual:')) return modal(id, 'Assign PEET scores', [{ id: 'efficiency', label: 'Efficiency (1.0–4.0)', max: 3 }, { id: 'effectiveness', label: 'Effectiveness (1.0–4.0)', max: 3 }, { id: 'time', label: 'Time (1.0–4.0)', max: 3 }, { id: 'reason', label: 'Feedback / reason for score adjustment', long: true }]);
  return null;
}
export function safeNext(value: string | null) {
  if (!value || !value.startsWith('/') || value.startsWith('//') || /[\\\u0000-\u0020]/.test(value)) return '/operations';
  return value;
}
