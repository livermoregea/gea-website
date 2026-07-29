// Canonical list of GEA leadership roles, in display order.
// "president" is always shown as filled/not-open-to-application per club rules.
export const ROLES = [
  { slug: "president", label: "President", open: false },
  { slug: "vice-president", label: "Vice President", open: true },
  { slug: "secretary", label: "Secretary", open: true },
  { slug: "publicist", label: "Publicist", open: true, requiresProof: true },
  { slug: "treasurer", label: "Treasurer", open: true },
  { slug: "rep-11", label: "11th Grade Representative", open: true },
  { slug: "rep-10", label: "10th Grade Representative", open: true },
  { slug: "rep-9", label: "9th Grade Representative", open: true },
] as const;

export type RoleSlug = (typeof ROLES)[number]["slug"];

export function getRole(slug: string) {
  return ROLES.find((r) => r.slug === slug);
}

// Update this to match the real school email domain(s) students use.
export const ALLOWED_EMAIL_DOMAINS = ["@mail.lvjusd.org", "@lvjusd.org"];

export function isSchoolEmail(email: string) {
  const lower = email.trim().toLowerCase();
  return ALLOWED_EMAIL_DOMAINS.some((d) => lower.endsWith(d));
}
