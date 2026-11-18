-- Access-control primitives. Runs before any table exists, so SQL function
-- bodies that reference tables are not validated at creation time.
SET LOCAL check_function_bodies = off;
--> statement-breakpoint

-- Privileges are granted to this group role; the login role the application
-- connects with is made a member of it by `npm run db:migrate`. It owns no
-- tables, so Row Level Security always applies to it.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'aljazayeh_app') THEN
    CREATE ROLE aljazayeh_app NOLOGIN;
  END IF;
END $$;
--> statement-breakpoint
GRANT USAGE ON SCHEMA public TO aljazayeh_app;
--> statement-breakpoint

-- The signed-in user for the current transaction (set by withTenantContext).
CREATE FUNCTION app_current_user_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT nullif(current_setting('app.user_id', true), '')::uuid;
$$;
--> statement-breakpoint

CREATE FUNCTION app_user_is_org_member(org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM memberships m
    WHERE m.organization_id = org_id
      AND m.user_id = app_current_user_id()
  );
$$;
--> statement-breakpoint

-- Display name of another user, only when the caller shares a company with them.
CREATE FUNCTION app_member_display_name(target_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN target_user_id = app_current_user_id()
      OR EXISTS (
        SELECT 1
        FROM memberships me
        INNER JOIN memberships them
          ON them.organization_id = me.organization_id
        WHERE me.user_id = app_current_user_id()
          AND them.user_id = target_user_id
      )
    THEN coalesce(nullif(trim(u.full_name), ''), u.username, '')
    ELSE ''
  END
  FROM users u
  WHERE u.id = target_user_id;
$$;
--> statement-breakpoint

-- First membership of a brand-new company. Joining a company that already has
-- members is refused unless the caller is already one of them.
CREATE FUNCTION app_insert_org_membership(
  p_membership_id uuid,
  p_organization_id uuid,
  p_user_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_user_id IS DISTINCT FROM app_current_user_id() THEN
    RAISE EXCEPTION 'Not allowed to create membership for another user.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM organizations o WHERE o.id = p_organization_id
  ) THEN
    RAISE EXCEPTION 'Organization not found.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM memberships m WHERE m.organization_id = p_organization_id
  ) AND NOT app_user_is_org_member(p_organization_id) THEN
    RAISE EXCEPTION 'Not allowed to join this organization.';
  END IF;

  INSERT INTO memberships (id, user_id, organization_id)
  VALUES (p_membership_id, p_user_id, p_organization_id);
END;
$$;
--> statement-breakpoint

-- Login runs before a user context exists, so it cannot read `users` directly.
CREATE FUNCTION app_find_user_for_login(p_username text)
RETURNS TABLE (
  id uuid,
  username text,
  password_hash text,
  is_active boolean
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT u.id, u.username, u.password_hash, u.is_active
  FROM users u
  WHERE lower(u.username) = lower(p_username)
  LIMIT 1;
$$;
--> statement-breakpoint

CREATE FUNCTION app_record_login(
  p_user_id uuid,
  p_ip_address text,
  p_user_agent text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_id uuid;
BEGIN
  INSERT INTO user_login_events (user_id, ip_address, user_agent, success)
  VALUES (
    p_user_id,
    left(coalesce(p_ip_address, ''), 128),
    left(coalesce(p_user_agent, ''), 512),
    true
  )
  RETURNING id INTO new_id;
  RETURN new_id;
END;
$$;
--> statement-breakpoint

-- Company codes are globally unique, including companies the caller cannot see.
CREATE FUNCTION app_is_org_code_available(p_code text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM organizations o WHERE o.code = lower(p_code)
  );
$$;
--> statement-breakpoint

REVOKE ALL ON FUNCTION
  app_current_user_id(),
  app_user_is_org_member(uuid),
  app_member_display_name(uuid),
  app_insert_org_membership(uuid, uuid, uuid),
  app_find_user_for_login(text),
  app_record_login(uuid, text, text),
  app_is_org_code_available(text)
FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION
  app_current_user_id(),
  app_user_is_org_member(uuid),
  app_member_display_name(uuid),
  app_insert_org_membership(uuid, uuid, uuid),
  app_find_user_for_login(text),
  app_record_login(uuid, text, text),
  app_is_org_code_available(text)
TO aljazayeh_app;
