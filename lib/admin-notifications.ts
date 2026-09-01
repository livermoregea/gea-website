export type AdminNotificationKind = "applications" | "students" | "profile-changes";

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

export function subscribeToAdminNotifications(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(NOTIFICATION_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(NOTIFICATION_EVENT, onChange);
  };
}
