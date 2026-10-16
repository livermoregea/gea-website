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
export type ManagedPerson = {
  userId: string;
  name: string;
  email: string;
  profiles: ManagedAccount[];
};

export function groupManagedAccounts(accounts: ManagedAccount[]): ManagedPerson[] {
  const people = new Map<string, ManagedPerson>();
  for (const account of accounts) {
    const person = people.get(account.userId);
    if (person) {
      person.profiles.push(account);
    } else {
      people.set(account.userId, {
        userId: account.userId,
        name: account.name,
        email: account.email,
        profiles: [account],
      });
    }
  }
  return Array.from(people.values());
}

export function accountRoleLabel(account: ManagedAccount): string {
  if (account.kind !== 'officer') return account.kind === 'student' ? 'Student' : 'Teacher';
  if (account.portalEnabled === false) return 'Inactive officer access';
  if (account.reviewerKind === 'advisor') return 'Academy Advisor';
  if (account.reviewerKind === 'president') return 'President / reviewer';
  return 'Officer';
}

export function validAccountEmail(value: string) {
  return /^[^\s@]+@lvjusd\.org$/i.test(value) && value.length <= 254;
}
