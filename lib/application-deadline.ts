const DEADLINE_TIME_ZONE = "America/Los_Angeles";

// September 4, 2026 at 11:59 PM PT.
export const APPLICATION_DEADLINE = new Date("2026-09-05T07:00:00Z");

export function isApplicationsOpen(now = new Date()) {
  return now < APPLICATION_DEADLINE;
}

export function formatApplicationDeadline() {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: DEADLINE_TIME_ZONE,
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZoneName: "short",
  }).format(APPLICATION_DEADLINE);
}
