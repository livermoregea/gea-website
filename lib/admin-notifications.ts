export type AdminNotificationKind = "applications" | "students" | "profile-changes" | "builders" | "forum-questions" | "forum-answers";

const STORAGE_KEY = "gea-admin-seen-notifications";
const NOTIFICATION_EVENT = "gea-admin-notifications-changed";

let remoteSeen: SeenNotifications = {};
export async function hydrateAdminNotifications() {
  if (typeof fetch === "undefined") return;
  const response = await fetch("/api/operations/notifications", { cache: "no-store" });
  if (!response.ok) throw new Error("Could not load saved notification read status.");
  const { keys } = await response.json();
  const next: SeenNotifications = {};
  for (const key of keys as string[]) {
    const [, kind, id] = key.split(":");
    (next[kind as AdminNotificationKind] ??= []).push(id);
  }
  remoteSeen = next;
}
async function persistSeen(notifications: SeenNotifications) {
  if (typeof fetch === "undefined") return true;
  const keys = Object.entries(notifications).flatMap(([kind, ids]) => (ids ?? []).map(id => `admin:${kind}:${id}`));
  try {
    for (let from = 0; from < keys.length; from += 1000) {
      const response = await fetch("/api/operations/notifications", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ keys: keys.slice(from, from + 1000) }) });
      if (!response.ok) throw new Error();
    }
    window.dispatchEvent(new Event(NOTIFICATION_EVENT));
    return true;
  } catch {
    window.dispatchEvent(new CustomEvent("gea-notification-save-failed"));
    return false;
  }
}

type SeenNotifications = Partial<Record<AdminNotificationKind, string[]>>;

function readSeen(): SeenNotifications {
  if (typeof window === "undefined") return {};
  if (typeof fetch !== "undefined") return remoteSeen;
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
  if (typeof fetch !== "undefined") remoteSeen = seen;
  else window.localStorage.setItem(STORAGE_KEY, JSON.stringify(seen));
  window.dispatchEvent(new Event(NOTIFICATION_EVENT));
  return persistSeen(seen);
}

export function markAllAdminNotificationsSeen(notifications: SeenNotifications) {
  if (typeof window === "undefined") return;
  const seen = readSeen();
  for (const kind of Object.keys(notifications) as AdminNotificationKind[]) {
    seen[kind] = Array.from(new Set([...(seen[kind] ?? []), ...(notifications[kind] ?? [])]));
  }
  if (typeof fetch !== "undefined") remoteSeen = seen;
  else window.localStorage.setItem(STORAGE_KEY, JSON.stringify(seen));
  window.dispatchEvent(new Event(NOTIFICATION_EVENT));
  return persistSeen(seen);
}

// Page through IDs so clearing notifications also covers records beyond Supabase's row limit.
export async function loadAdminNotificationIds(supabase: ReturnType<typeof import("@/lib/supabase/client").createClient>, includeBuilders = true) {
  const sources = [
    ["applications", "applications", false], ["students", "student_profiles", false],
    ["profile-changes", "profile_change_requests", true], ["builders", "builder_submissions", true],
    ["forum-questions", "qa_questions", true], ["forum-answers", "qa_answers", true],
  ] as const;
  const entries = await Promise.all(sources.filter(([kind]) => kind !== "builders" || includeBuilders).map(async ([kind, table, pending]) => {
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
