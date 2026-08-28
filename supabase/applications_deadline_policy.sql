-- Replaces only the public insert policy for applications.
-- This closes applications after September 4, 2026 at 11:59 PM Pacific Time.

drop policy if exists "applications_public_insert" on applications;

create policy "applications_public_insert" on applications
  for insert with check (
    now() < timestamptz '2026-09-05 07:00:00+00'
    and
    case
      when role in ('vice-president', 'secretary', 'treasurer') then graduating_class_year <= extract(year from now())::int + 2
      when role = 'publicist' then true
      when role = 'rep-10' then graduating_class_year = extract(year from now())::int + 3
      when role = 'rep-9' then graduating_class_year = extract(year from now())::int + 4
      else false
    end
  );
