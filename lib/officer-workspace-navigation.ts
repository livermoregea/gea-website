/** One entry point for officer work; old planning links keep their destinations. */
const recordTopics = ['overview', 'tasks', 'attendance', 'volunteer', 'accountability'] as const;
type RecordTopic = typeof recordTopics[number];
export function officerRecordTarget(params: URLSearchParams, actorId: string, reviewer: boolean, officerIds: readonly string[]) {
  const topic = params.get('topic');
  if (!topic || !recordTopics.includes(topic as RecordTopic)) return null;
  const requested = params.get('officer');
  if (reviewer && requested && requested !== actorId && !officerIds.includes(requested)) return null;
  return { officerId: reviewer ? requested || (topic === 'accountability' ? actorId : 'all') : actorId, topic: topic as RecordTopic };
}
export function officerWorkspaceHref(staff: boolean) {
  return staff ? '/admin-portal-x7k9/officers' : '/officerboard';
}
export function workspaceView(view?: string, task?: string, topic?: string, officer?: string) {
  if (task || view === 'blockers') return 'tasks';
  if (recordTopics.includes(topic as RecordTopic)) return topic === 'tasks' ? 'tasks' : !officer && ['attendance', 'volunteer', 'accountability'].includes(topic ?? '') ? topic! : 'people';
  if (['tasks', 'people', 'attendance', 'volunteer', 'accountability', 'accounts'].includes(view ?? '')) return view!;
  if (view === 'inbox' || view === 'today' || view === 'overview') return 'overview';
  return ['calendar', 'meetings', 'events', 'reports'].includes(view ?? '') ? view! : 'overview';
}
export function legacyPlanningHref(staff: boolean, params: Record<string, string | undefined>) {
  const query = new URLSearchParams();
  query.set('view', workspaceView(params.view, params.task, params.topic, params.officer));
  for (const key of ['event', 'task', 'topic', 'officer']) if (params[key]) query.set(key, params[key]!);
  return `${officerWorkspaceHref(staff)}?${query}`;
}
