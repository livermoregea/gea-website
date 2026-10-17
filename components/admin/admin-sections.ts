export const ADMIN_SECTIONS = [
  { key: "dashboard", label: "Dashboard", group: "Workspace" },
  { key: "applications", label: "Applications", group: "Workspace" },
  { key: "builders", label: "GEA Builders", group: "Workspace" },
  { key: "volunteers", label: "Public Volunteering", group: "Workspace" },
  { key: "students", label: "Students", group: "Workspace" },
  { key: "website", label: "Website", group: "Website" },
  { key: "leadership", label: "Leadership Board", group: "Website" },
  { key: "profile-changes", label: "Profile Changes", group: "Operations" },
  { key: "slots", label: "Interview Slots", group: "Operations" },
  { key: "forum", label: "Forum Activity", group: "Operations" },
  { key: "teacher-invites", label: "Teacher Invites", group: "Operations" },
] as const;

export type AdminSectionKey = (typeof ADMIN_SECTIONS)[number]["key"];
