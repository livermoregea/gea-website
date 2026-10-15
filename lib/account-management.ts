export type ManagedAccount = {
  userId: string; email: string; name: string; kind: 'student' | 'teacher' | 'officer';
  username?: string; classYear?: number; portalRole?: 'officer' | 'admin';
  reviewerKind?: 'president' | 'advisor' | null; position?: string;
  portalEnabled?: boolean;
};
export type AccountDirectory = {
  accounts: ManagedAccount[];
  authAccounts: { id: string; email: string; name: string }[];
};
export function validAccountEmail(value: string) {
  return /^[^\s@]+@lvjusd\.org$/i.test(value) && value.length <= 254;
}
