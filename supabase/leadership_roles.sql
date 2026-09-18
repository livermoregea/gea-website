-- Run after schema.sql (and leadership_history.sql for older installations).
-- Removed roles remain available for historical labels and applications.
create table if not exists leadership_roles (
  slug text primary key,
  label text not null check (length(btrim(label)) between 1 and 100),
  open boolean not null default true,
  "requiresProof" boolean not null default false,
  display_order integer not null default 0,
  active boolean not null default true
);
create unique index if not exists leadership_roles_active_label_idx
  on leadership_roles (lower(btrim(label))) where active;

insert into leadership_roles (slug, label, open, "requiresProof", display_order) values
  ('president', 'President', false, false, 0),
  ('vice-president', 'Vice President', true, false, 1),
  ('secretary', 'Secretary', true, false, 2),
  ('publicist', 'Publicist', true, true, 3),
  ('treasurer', 'Treasurer', true, false, 4),
  ('rep-10', '10th Grade Representative', true, false, 5),
  ('rep-9', '9th Grade Representative', true, false, 6)
on conflict (slug) do nothing;

alter table leadership_members drop constraint if exists leadership_members_role_check;
alter table leadership_roles enable row level security;
drop policy if exists leadership_roles_public_read on leadership_roles;
create policy leadership_roles_public_read on leadership_roles for select using (true);
drop policy if exists leadership_roles_staff_insert on leadership_roles;
create policy leadership_roles_staff_insert on leadership_roles for insert with check (is_staff());
drop policy if exists leadership_roles_staff_update on leadership_roles;
create policy leadership_roles_staff_update on leadership_roles for update using (is_staff()) with check (is_staff());

-- Serialize role removal against filling a seat, so a filled role cannot disappear.
create or replace function check_leadership_role_removal() returns trigger
language plpgsql set search_path = public as $$
begin
  if not new.active and exists (select 1 from leadership_members where role = old.slug) then
    raise exception 'Vacate or retire the member before removing this role.';
  end if;
  return new;
end;
$$;
drop trigger if exists leadership_role_removal on leadership_roles;
create trigger leadership_role_removal before update on leadership_roles
  for each row execute function check_leadership_role_removal();

create or replace function check_leadership_member_role() returns trigger
language plpgsql set search_path = public as $$
begin
  perform 1 from leadership_roles where slug = new.role and active for update;
  if not found then raise exception 'Choose an active leadership role.'; end if;
  return new;
end;
$$;
drop trigger if exists leadership_member_active_role on leadership_members;
create trigger leadership_member_active_role before insert or update on leadership_members
  for each row execute function check_leadership_member_role();
