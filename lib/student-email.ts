// Student signup accepts the district's existing @lvjusd.org account domain.
// This checks email format and domain, not current enrollment or mailbox ownership.
export function isLvjusdStudentEmail(email: string): boolean {
  return /^[^\s@]+@lvjusd\.org$/i.test(email.trim());
}
