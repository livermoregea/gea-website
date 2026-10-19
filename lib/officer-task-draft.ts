export type OfficerTaskDraft = {
  version: 1;
  title: string;
  description: string;
  dueDate: string;
  assignees: string[];
  people: string[];
  shared: boolean;
};

export const taskDraftKey = (officerId: string) => `gea:task-draft:v1:${officerId}`;
export const emptyTaskDraft = (): OfficerTaskDraft => ({ version: 1, title: '', description: '', dueDate: '', assignees: [], people: [], shared: false });

export function readTaskDraft(storage: Pick<Storage, 'getItem'>, officerId: string): OfficerTaskDraft | null {
  try {
    const raw = storage.getItem(taskDraftKey(officerId));
    if (!raw || raw.length > 50000) return null;
    const draft = JSON.parse(raw);
    if (draft?.version !== 1 || typeof draft.title !== 'string' || draft.title.length > 200
      || typeof draft.description !== 'string' || draft.description.length > 10000
      || typeof draft.dueDate !== 'string' || (draft.dueDate !== '' && !/^\d{4}-\d{2}-\d{2}$/.test(draft.dueDate))
      || typeof draft.shared !== 'boolean') return null;
    for (const ids of [draft.assignees, draft.people]) {
      if (!Array.isArray(ids) || ids.length > 500 || ids.some(id => typeof id !== 'string' || id.length > 100)) return null;
    }
    return { version: 1, title: draft.title, description: draft.description, dueDate: draft.dueDate,
      assignees: [...new Set<string>(draft.assignees)], people: [...new Set<string>(draft.people)], shared: draft.shared };
  } catch { return null; }
}

export function writeTaskDraft(storage: Pick<Storage, 'setItem'>, officerId: string, draft: OfficerTaskDraft) {
  try { storage.setItem(taskDraftKey(officerId), JSON.stringify(draft)); } catch { /* Storage may be unavailable; keep the live form usable. */ }
}

export function clearTaskDraft(storage: Pick<Storage, 'removeItem'>, officerId: string) {
  try { storage.removeItem(taskDraftKey(officerId)); } catch { /* No stored draft to clear. */ }
}
