export type AdminNotificationKind = "applications" | "students" | "profile-changes" | "builders" | "forum-questions" | "forum-answers";

const STORAGE_KEY = "gea-admin-seen-notifications";
const NOTIFICATION_EVENT = "gea-admin-notifications-changed";

type SeenNotifications = Partial<Record<AdminNotificationKind, string[]>>;

function readSeen(): SeenNotifications {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "{}");
  } catch {
    return {};
  }
}

export function isAdminNotificationSeen(kind: AdminNotificationKind, id: string) {
  return readSeen()[kind]?.includes(id) ?? false;
}

export function getUnreadAdminNotificationCount(kind: AdminNotificationKind, ids: string[]) {
  const seen = new Set(readSeen()[kind] ?? []);
  return ids.filter((id) => !seen.has(id)).length;
}

export function markAdminNotificationSeen(kind: AdminNotificationKind, id: string) {
  if (typeof window === "undefined") return;
  const seen = readSeen();
  const ids = new Set(seen[kind] ?? []);
  ids.add(id);
  seen[kind] = Array.from(ids);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(seen));
  window.dispatchEvent(new Event(NOTIFICATION_EVENT));
}

export function markAllAdminNotificationsSeen(notifications: SeenNotifications) {
  if (typeof window === "undefined") return;
  const seen = readSeen();
  for (const kind of Object.keys(notifications) as AdminNotificationKind[]) {
    seen[kind] = Array.from(new Set([...(seen[kind] ?? []), ...(notifications[kind] ?? [])]));
  }
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(seen));
  window.dispatchEvent(new Event(NOTIFICATION_EVENT));
}

// Page through IDs so clearing notifications also covers records beyond Supabase's row limit.
export async function loadAdminNotificationIds(supabase: ReturnType<typeof import("@/lib/supabase/client").createClient>) {
  const sources = [
    ["applications", "applications", false], ["students", "student_profiles", false],
    ["profile-changes", "profile_change_requests", true], ["builders", "builder_submissions", true],
    ["forum-questions", "qa_questions", true], ["forum-answers", "qa_answers", true],
  ] as const;
  const entries = await Promise.all(sources.map(async ([kind, table, pending]) => {
    const ids: string[] = [];
    for (let offset = 0; ; offset += 1000) {
      let query = supabase.from(table).select("id").order("id").range(offset, offset + 999);
      if (pending) query = query.eq("status", "pending");
      const { data, error } = await query;
      if (error) throw new Error("Could not load all notifications. Please try again.");
      ids.push(...(data ?? []).map((row: { id: string }) => row.id));
      if ((data ?? []).length < 1000) break;
    }
    return [kind, ids] as const;
  }));
  return Object.fromEntries(entries) as SeenNotifications;
}

export function subscribeToAdminNotifications(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(NOTIFICATION_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(NOTIFICATION_EVENT, onChange);
  };
}
