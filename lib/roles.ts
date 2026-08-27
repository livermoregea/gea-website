// Canonical list of GEA leadership roles, in display order.
// "president" is always shown as filled/not-open-to-application per club rules.
export const ROLES = [
  { slug: "president", label: "President", open: false },
  { slug: "vice-president", label: "Vice President", open: true, eligibility: "upperclassmen" },
  { slug: "secretary", label: "Secretary", open: true, eligibility: "upperclassmen" },
  { slug: "publicist", label: "Publicist", open: true, requiresProof: true, eligibility: "upperclassmen" },
  { slug: "treasurer", label: "Treasurer", open: true, eligibility: "upperclassmen" },
  { slug: "rep-11", label: "11th Grade Representative", open: true, eligibility: "grade-11" },
  { slug: "rep-10", label: "10th Grade Representative", open: true, eligibility: "grade-10" },
  { slug: "rep-9", label: "9th Grade Representative", open: true, eligibility: "grade-9" },
] as const;

export const PUBLIC_ROLES = ROLES;

export type RoleSlug = (typeof ROLES)[number]["slug"];
export type RoleEligibility = (typeof ROLES)[number] extends { eligibility: infer T } ? T : never;

export function getRole(slug: string) {
  return ROLES.find((r) => r.slug === slug);
}

export function getRoleEligibilityLabel(roleSlug: RoleSlug) {
  const role = getRole(roleSlug);
  const eligibility = role && "eligibility" in role ? role.eligibility : undefined;

  switch (eligibility) {
    case "upperclassmen":
      return "Juniors and seniors only";
    case "grade-11":
      return "11th grade only";
    case "grade-10":
      return "10th grade only";
    case "grade-9":
      return "9th grade only";
    default:
      return null;
  }
}

export function isEligibleForRole(roleSlug: RoleSlug, graduatingClassYear: number) {
  const role = getRole(roleSlug);
  const currentYear = new Date().getFullYear();
  const eligibility = role && "eligibility" in role ? role.eligibility : undefined;

  switch (eligibility) {
    case "upperclassmen":
      return graduatingClassYear <= currentYear + 2;
    case "grade-11":
      return graduatingClassYear === currentYear + 2;
    case "grade-10":
      return graduatingClassYear === currentYear + 3;
    case "grade-9":
      return graduatingClassYear === currentYear + 4;
    default:
      return true;
  }
}

// Update this to match the real school email domain(s) students use.
export const ALLOWED_EMAIL_DOMAINS = ["@mail.lvjusd.org", "@lvjusd.org"];

export function isSchoolEmail(email: string) {
  const lower = email.trim().toLowerCase();
  return ALLOWED_EMAIL_DOMAINS.some((d) => lower.endsWith(d));
}
