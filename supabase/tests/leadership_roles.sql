-- Run with psql -f against an EMPTY temporary database, never production.
\set ON_ERROR_STOP on
create function is_staff() returns boolean language sql as 'select true';
create table leadership_members (role text unique check (role in ('president','vice-president','secretary','publicist','treasurer','rep-10','rep-9')), name text);
\ir ../leadership_roles.sql
insert into leadership_roles (slug,label) values ('test-role','Test Role');
insert into leadership_members values ('test-role','Test Member');
update leadership_roles set label = 'Renamed Role' where slug = 'test-role';
do $$ begin
  if (select label from leadership_roles where slug = 'test-role') <> 'Renamed Role' then raise exception 'Rename failed'; end if;
  begin
    update leadership_roles set active = false where slug = 'test-role';
    raise exception 'Filled removal accepted';
  exception when raise_exception then
    if sqlerrm <> 'Vacate or retire the member before removing this role.' then raise; end if;
  end;
  begin
    insert into leadership_roles (slug,label) values ('duplicate',' renamed role ');
    raise exception 'Duplicate accepted';
  exception when unique_violation then null;
  end;
end $$;
delete from leadership_members where role = 'test-role';
update leadership_roles set active = false where slug = 'test-role';
do $$ begin
  begin
    insert into leadership_members values ('test-role','Should Fail');
    raise exception 'Inactive seat accepted';
  exception when raise_exception then
    if sqlerrm <> 'Choose an active leadership role.' then raise; end if;
  end;
  if not exists (select 1 from leadership_roles where slug = 'test-role' and label = 'Renamed Role' and not active) then raise exception 'Historical label lost'; end if;
end $$;
update leadership_roles set label = 'Chair' where slug = 'president';
update leadership_roles set active = false where slug = 'secretary';
\ir ../leadership_roles.sql
do $$ begin
  if (select label from leadership_roles where slug = 'president') <> 'Chair' then raise exception 'Migration reset rename'; end if;
  if (select active from leadership_roles where slug = 'secretary') then raise exception 'Migration reset removal'; end if;
end $$;
select 'All role migration checks passed' as result;
