export type PublicVolunteerEvent = {
  id: string; title: string; description: string; location: string;
  starts_at: string; ends_at: string; status: 'draft' | 'published' | 'cancelled';
  signup_open: boolean; capacity: number | null; version: number;
};
export type PublicVolunteerSignup = {
  id: string; event_id: string; user_id: string; name: string; email: string;
  status: 'registered' | 'withdrawn'; attendance: 'unmarked' | 'present' | 'absent';
  verified_minutes: number; attendance_note: string; version: number;
};
export const PUBLIC_EVENT_COLUMNS = 'id,title,description,location,starts_at,ends_at,status,signup_open,capacity,version';
export const PUBLIC_SIGNUP_COLUMNS = 'id,event_id,user_id,name,email,status,attendance,verified_minutes,attendance_note,version';
export function publicSignupOpen(event: PublicVolunteerEvent, now = Date.now()) {
  return event.status === 'published' && event.signup_open && Date.parse(event.starts_at) > now;
}
export function publicVolunteerError(error: { code?: string; message?: string }) {
  if (error.code === 'P0001') return error.message ?? 'Could not save this volunteer record.';
  if (['42P01','42703','42883','PGRST202','PGRST204','PGRST205'].includes(error.code ?? '')) return 'Public volunteering is awaiting database setup. Please contact a coordinator.';
  return 'Could not save your changes. Check your connection and try again.';
}
export async function volunteerRows<T>(query: (from: number, to: number) => PromiseLike<{data: T[] | null; error: {code?: string; message?: string} | null}>) {
  const rows: T[] = [];
  for (let from = 0;; from += 100) {
    const result = await query(from, from + 99);
    if (result.error) throw new Error(publicVolunteerError(result.error));
    rows.push(...result.data ?? []);
    if ((result.data?.length ?? 0) < 100) return rows;
  }
}
