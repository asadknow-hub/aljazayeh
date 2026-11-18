-- Row Level Security for AlJazayeh multi-org tenancy.
-- Tenant key: organization_id (UUID). Session GUC: app.user_id.
-- App connects as non-owner role `aljazayeh` so RLS applies.
-- Migrations/seed use admin/superuser connection.

create or replace function app_current_user_id()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('app.user_id', true), '')::uuid;
$$;

create or replace function app_user_is_org_member(org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from memberships m
    where m.organization_id = org_id
      and m.user_id = app_current_user_id()
  );
$$;

revoke all on function app_user_is_org_member(uuid) from public;
grant execute on function app_user_is_org_member(uuid) to aljazayeh;
grant execute on function app_current_user_id() to aljazayeh;

-- Safe peer display name: only when caller and target share an organization.
create or replace function app_member_display_name(target_user_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case
    when target_user_id is null then ''
    when target_user_id = app_current_user_id() then coalesce(
      nullif(trim(u.full_name), ''),
      u.username,
      ''
    )
    when exists (
      select 1
      from memberships me
      inner join memberships them
        on them.organization_id = me.organization_id
      where me.user_id = app_current_user_id()
        and them.user_id = target_user_id
    ) then coalesce(nullif(trim(u.full_name), ''), u.username, '')
    else ''
  end
  from users u
  where u.id = target_user_id;
$$;

revoke all on function app_member_display_name(uuid) from public;
grant execute on function app_member_display_name(uuid) to aljazayeh;

-- First membership for a brand-new org (or add self when already a member).
create or replace function app_insert_org_membership(
  p_membership_id uuid,
  p_organization_id uuid,
  p_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_user_id is distinct from app_current_user_id() then
    raise exception 'Not allowed to create membership for another user.';
  end if;

  if not exists (
    select 1 from organizations o where o.id = p_organization_id
  ) then
    raise exception 'Organization not found.';
  end if;

  if exists (
    select 1 from memberships m where m.organization_id = p_organization_id
  ) and not app_user_is_org_member(p_organization_id) then
    raise exception 'Not allowed to join this organization.';
  end if;

  insert into memberships (id, user_id, organization_id)
  values (p_membership_id, p_user_id, p_organization_id);
end;
$$;

revoke all on function app_insert_org_membership(uuid, uuid, uuid) from public;
grant execute on function app_insert_org_membership(uuid, uuid, uuid) to aljazayeh;

alter table users enable row level security;
alter table user_login_events enable row level security;
alter table user_salary enable row level security;
alter table user_contracts enable row level security;
alter table organizations enable row level security;
alter table organization_settings enable row level security;
alter table memberships enable row level security;
alter table permissions enable row level security;
alter table roles enable row level security;
alter table role_permissions enable row level security;
alter table membership_roles enable row level security;
alter table user_preferences enable row level security;
alter table staff_members enable row level security;
alter table staff_department_assignments enable row level security;
alter table vacation_requests enable row level security;
alter table visitor_logs enable row level security;
alter table staff_activity_logs enable row level security;
alter table inquiry_workflow_settings enable row level security;
alter table inquiries enable row level security;
alter table inquiry_line_items enable row level security;
alter table inquiry_stage_events enable row level security;
alter table inquiry_comments enable row level security;
alter table inquiry_stage_approvals enable row level security;

drop policy if exists users_self_select on users;
create policy users_self_select on users
  for select
  using (id = app_current_user_id());

drop policy if exists users_self_update on users;
create policy users_self_update on users
  for update
  using (id = app_current_user_id())
  with check (id = app_current_user_id());

drop policy if exists user_login_events_self_select on user_login_events;
create policy user_login_events_self_select on user_login_events
  for select
  using (user_id = app_current_user_id());

drop policy if exists user_login_events_self_insert on user_login_events;
create policy user_login_events_self_insert on user_login_events
  for insert
  with check (user_id = app_current_user_id());

drop policy if exists user_salary_self on user_salary;
create policy user_salary_self on user_salary
  for all
  using (user_id = app_current_user_id())
  with check (user_id = app_current_user_id());

drop policy if exists user_contracts_self on user_contracts;
create policy user_contracts_self on user_contracts
  for all
  using (user_id = app_current_user_id())
  with check (user_id = app_current_user_id());

drop policy if exists permissions_read_authenticated on permissions;
create policy permissions_read_authenticated on permissions
  for select
  using (app_current_user_id() is not null);

drop policy if exists organizations_member_select on organizations;
create policy organizations_member_select on organizations
  for select
  using (app_user_is_org_member(id));

drop policy if exists organizations_member_update on organizations;
create policy organizations_member_update on organizations
  for update
  using (app_user_is_org_member(id))
  with check (app_user_is_org_member(id));

drop policy if exists organizations_authenticated_insert on organizations;
create policy organizations_authenticated_insert on organizations
  for insert
  with check (app_current_user_id() is not null);

drop policy if exists organization_settings_member_select on organization_settings;
create policy organization_settings_member_select on organization_settings
  for select
  using (app_user_is_org_member(organization_id));

drop policy if exists organization_settings_member_insert on organization_settings;
create policy organization_settings_member_insert on organization_settings
  for insert
  with check (app_user_is_org_member(organization_id));

drop policy if exists organization_settings_member_update on organization_settings;
create policy organization_settings_member_update on organization_settings
  for update
  using (app_user_is_org_member(organization_id))
  with check (app_user_is_org_member(organization_id));

drop policy if exists organization_settings_member_delete on organization_settings;
create policy organization_settings_member_delete on organization_settings
  for delete
  using (app_user_is_org_member(organization_id));

drop policy if exists memberships_member_select on memberships;
create policy memberships_member_select on memberships
  for select
  using (app_user_is_org_member(organization_id) or user_id = app_current_user_id());

drop policy if exists memberships_self_or_member_insert on memberships;
drop policy if exists memberships_member_insert on memberships;
-- Direct inserts only for existing members (e.g. inviting others later).
-- First membership uses app_insert_org_membership (security definer).
create policy memberships_member_insert on memberships
  for insert
  with check (app_user_is_org_member(organization_id));

drop policy if exists memberships_member_update on memberships;
create policy memberships_member_update on memberships
  for update
  using (app_user_is_org_member(organization_id))
  with check (app_user_is_org_member(organization_id));

drop policy if exists memberships_member_delete on memberships;
create policy memberships_member_delete on memberships
  for delete
  using (app_user_is_org_member(organization_id));

drop policy if exists roles_member_select on roles;
create policy roles_member_select on roles
  for select
  using (app_user_is_org_member(organization_id));

drop policy if exists roles_member_insert on roles;
create policy roles_member_insert on roles
  for insert
  with check (app_user_is_org_member(organization_id));

drop policy if exists roles_member_update on roles;
create policy roles_member_update on roles
  for update
  using (app_user_is_org_member(organization_id))
  with check (app_user_is_org_member(organization_id));

drop policy if exists roles_member_delete on roles;
create policy roles_member_delete on roles
  for delete
  using (app_user_is_org_member(organization_id));

drop policy if exists role_permissions_member_select on role_permissions;
create policy role_permissions_member_select on role_permissions
  for select
  using (
    exists (
      select 1 from roles r
      where r.id = role_id and app_user_is_org_member(r.organization_id)
    )
  );

drop policy if exists role_permissions_member_write on role_permissions;
create policy role_permissions_member_write on role_permissions
  for all
  using (
    exists (
      select 1 from roles r
      where r.id = role_id and app_user_is_org_member(r.organization_id)
    )
  )
  with check (
    exists (
      select 1 from roles r
      where r.id = role_id and app_user_is_org_member(r.organization_id)
    )
  );

drop policy if exists membership_roles_member_select on membership_roles;
create policy membership_roles_member_select on membership_roles
  for select
  using (
    exists (
      select 1 from memberships m
      where m.id = membership_id and app_user_is_org_member(m.organization_id)
    )
  );

drop policy if exists membership_roles_member_write on membership_roles;
create policy membership_roles_member_write on membership_roles
  for all
  using (
    exists (
      select 1 from memberships m
      where m.id = membership_id and app_user_is_org_member(m.organization_id)
    )
  )
  with check (
    exists (
      select 1 from memberships m
      where m.id = membership_id and app_user_is_org_member(m.organization_id)
    )
  );

drop policy if exists user_preferences_self on user_preferences;
create policy user_preferences_self on user_preferences
  for all
  using (user_id = app_current_user_id())
  with check (user_id = app_current_user_id());

drop policy if exists staff_members_member_select on staff_members;
create policy staff_members_member_select on staff_members
  for select
  using (app_user_is_org_member(organization_id));

drop policy if exists staff_members_member_insert on staff_members;
create policy staff_members_member_insert on staff_members
  for insert
  with check (app_user_is_org_member(organization_id));

drop policy if exists staff_members_member_update on staff_members;
create policy staff_members_member_update on staff_members
  for update
  using (app_user_is_org_member(organization_id))
  with check (app_user_is_org_member(organization_id));

drop policy if exists staff_members_member_delete on staff_members;
create policy staff_members_member_delete on staff_members
  for delete
  using (app_user_is_org_member(organization_id));

drop policy if exists staff_department_assignments_member_select on staff_department_assignments;
create policy staff_department_assignments_member_select on staff_department_assignments
  for select
  using (
    exists (
      select 1 from staff_members s
      where s.id = staff_id and app_user_is_org_member(s.organization_id)
    )
  );

drop policy if exists staff_department_assignments_member_write on staff_department_assignments;
create policy staff_department_assignments_member_write on staff_department_assignments
  for all
  using (
    exists (
      select 1 from staff_members s
      where s.id = staff_id and app_user_is_org_member(s.organization_id)
    )
  )
  with check (
    exists (
      select 1 from staff_members s
      where s.id = staff_id and app_user_is_org_member(s.organization_id)
    )
  );

drop policy if exists vacation_requests_member_select on vacation_requests;
create policy vacation_requests_member_select on vacation_requests
  for select
  using (app_user_is_org_member(organization_id));

drop policy if exists vacation_requests_member_insert on vacation_requests;
create policy vacation_requests_member_insert on vacation_requests
  for insert
  with check (app_user_is_org_member(organization_id));

drop policy if exists vacation_requests_member_update on vacation_requests;
create policy vacation_requests_member_update on vacation_requests
  for update
  using (app_user_is_org_member(organization_id))
  with check (app_user_is_org_member(organization_id));

drop policy if exists vacation_requests_member_delete on vacation_requests;
create policy vacation_requests_member_delete on vacation_requests
  for delete
  using (app_user_is_org_member(organization_id));

drop policy if exists visitor_logs_member_select on visitor_logs;
create policy visitor_logs_member_select on visitor_logs
  for select
  using (app_user_is_org_member(organization_id));

drop policy if exists visitor_logs_member_insert on visitor_logs;
create policy visitor_logs_member_insert on visitor_logs
  for insert
  with check (app_user_is_org_member(organization_id));

drop policy if exists visitor_logs_member_update on visitor_logs;
create policy visitor_logs_member_update on visitor_logs
  for update
  using (app_user_is_org_member(organization_id))
  with check (app_user_is_org_member(organization_id));

drop policy if exists visitor_logs_member_delete on visitor_logs;
create policy visitor_logs_member_delete on visitor_logs
  for delete
  using (app_user_is_org_member(organization_id));

drop policy if exists staff_activity_logs_member_select on staff_activity_logs;
create policy staff_activity_logs_member_select on staff_activity_logs
  for select
  using (app_user_is_org_member(organization_id));

drop policy if exists staff_activity_logs_member_insert on staff_activity_logs;
create policy staff_activity_logs_member_insert on staff_activity_logs
  for insert
  with check (app_user_is_org_member(organization_id));

drop policy if exists staff_activity_logs_member_update on staff_activity_logs;
create policy staff_activity_logs_member_update on staff_activity_logs
  for update
  using (app_user_is_org_member(organization_id))
  with check (app_user_is_org_member(organization_id));

drop policy if exists staff_activity_logs_member_delete on staff_activity_logs;
create policy staff_activity_logs_member_delete on staff_activity_logs
  for delete
  using (app_user_is_org_member(organization_id));

drop policy if exists inquiry_workflow_settings_member_select on inquiry_workflow_settings;
create policy inquiry_workflow_settings_member_select on inquiry_workflow_settings
  for select
  using (app_user_is_org_member(organization_id));

drop policy if exists inquiry_workflow_settings_member_write on inquiry_workflow_settings;
create policy inquiry_workflow_settings_member_write on inquiry_workflow_settings
  for all
  using (app_user_is_org_member(organization_id))
  with check (app_user_is_org_member(organization_id));

drop policy if exists inquiries_member_select on inquiries;
create policy inquiries_member_select on inquiries
  for select
  using (app_user_is_org_member(organization_id));

drop policy if exists inquiries_member_insert on inquiries;
create policy inquiries_member_insert on inquiries
  for insert
  with check (app_user_is_org_member(organization_id));

drop policy if exists inquiries_member_update on inquiries;
create policy inquiries_member_update on inquiries
  for update
  using (app_user_is_org_member(organization_id))
  with check (app_user_is_org_member(organization_id));

drop policy if exists inquiries_member_delete on inquiries;
create policy inquiries_member_delete on inquiries
  for delete
  using (app_user_is_org_member(organization_id));

drop policy if exists inquiry_line_items_member_select on inquiry_line_items;
create policy inquiry_line_items_member_select on inquiry_line_items
  for select
  using (
    exists (
      select 1 from inquiries i
      where i.id = inquiry_id and app_user_is_org_member(i.organization_id)
    )
  );

drop policy if exists inquiry_line_items_member_write on inquiry_line_items;
create policy inquiry_line_items_member_write on inquiry_line_items
  for all
  using (
    exists (
      select 1 from inquiries i
      where i.id = inquiry_id and app_user_is_org_member(i.organization_id)
    )
  )
  with check (
    exists (
      select 1 from inquiries i
      where i.id = inquiry_id and app_user_is_org_member(i.organization_id)
    )
  );

drop policy if exists inquiry_stage_events_member_select on inquiry_stage_events;
create policy inquiry_stage_events_member_select on inquiry_stage_events
  for select
  using (app_user_is_org_member(organization_id));

drop policy if exists inquiry_stage_events_member_insert on inquiry_stage_events;
create policy inquiry_stage_events_member_insert on inquiry_stage_events
  for insert
  with check (app_user_is_org_member(organization_id));

drop policy if exists inquiry_comments_member_select on inquiry_comments;
create policy inquiry_comments_member_select on inquiry_comments
  for select
  using (app_user_is_org_member(organization_id));

drop policy if exists inquiry_comments_member_insert on inquiry_comments;
create policy inquiry_comments_member_insert on inquiry_comments
  for insert
  with check (app_user_is_org_member(organization_id));

drop policy if exists inquiry_stage_approvals_member_select on inquiry_stage_approvals;
create policy inquiry_stage_approvals_member_select on inquiry_stage_approvals
  for select
  using (app_user_is_org_member(organization_id));

drop policy if exists inquiry_stage_approvals_member_insert on inquiry_stage_approvals;
create policy inquiry_stage_approvals_member_insert on inquiry_stage_approvals
  for insert
  with check (app_user_is_org_member(organization_id));

drop policy if exists inquiry_stage_approvals_member_delete on inquiry_stage_approvals;
create policy inquiry_stage_approvals_member_delete on inquiry_stage_approvals
  for delete
  using (app_user_is_org_member(organization_id));

-- Grants for app role
grant usage on schema public to aljazayeh;
grant select, insert, update, delete on all tables in schema public to aljazayeh;
grant usage, select on all sequences in schema public to aljazayeh;
alter default privileges in schema public grant select, insert, update, delete on tables to aljazayeh;
alter default privileges in schema public grant usage, select on sequences to aljazayeh;
