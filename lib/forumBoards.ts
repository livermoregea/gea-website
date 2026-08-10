export type ForumBoard = "general" | "academics" | "projects" | "events" | "advice" | "life";

export const FORUM_BOARDS: Array<{ value: ForumBoard; label: string; description: string }> = [
  { value: "general", label: "General", description: "All-school discussion and updates." },
  { value: "academics", label: "Academics", description: "Classes, homework, and school support." },
  { value: "projects", label: "Projects", description: "Builds, labs, and engineering work." },
  { value: "events", label: "Events", description: "Trips, deadlines, and academy events." },
  { value: "advice", label: "Advice", description: "Tips for incoming and current students." },
  { value: "life", label: "Student Life", description: "Campus, clubs, and day-to-day questions." },
];

export function isForumBoard(value: string): value is ForumBoard {
  return FORUM_BOARDS.some((board) => board.value === value);
}

export function getForumBoardLabel(value: string) {
  return FORUM_BOARDS.find((board) => board.value === value)?.label ?? "General";
}
