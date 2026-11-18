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

-- A user belongs to a company when they have an active staff record there
-- and their login is enabled. Marking staff inactive cuts access immediately.
CREATE FUNCTION app_user_is_org_member(org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM staff_members s
    INNER JOIN users u ON u.id = s.user_id
    WHERE s.organization_id = org_id
      AND s.user_id = app_current_user_id()
      AND s.status = 'active'
      AND u.is_active
  );
$$;
--> statement-breakpoint

CREATE FUNCTION app_user_is_org_admin(org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM staff_members s
    INNER JOIN users u ON u.id = s.user_id
    WHERE s.organization_id = org_id
      AND s.user_id = app_current_user_id()
      AND s.status = 'active'
      AND s.is_admin
      AND u.is_active
  );
$$;
--> statement-breakpoint

-- Company administrators and Management maintain the staff directory.
CREATE FUNCTION app_user_can_manage_staff(org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM staff_members s
    INNER JOIN users u ON u.id = s.user_id
    WHERE s.organization_id = org_id
      AND s.user_id = app_current_user_id()
      AND s.status = 'active'
      AND u.is_active
      AND (
        s.is_admin
        OR EXISTS (
          SELECT 1
          FROM staff_department_assignments d
          WHERE d.staff_id = s.id
            AND d.department_key = 'management'
        )
      )
  );
$$;
--> statement-breakpoint

CREATE FUNCTION app_is_platform_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM users u
    WHERE u.id = app_current_user_id()
      AND u.is_platform_admin
      AND u.is_active
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
        FROM staff_members them
        WHERE them.user_id = target_user_id
          AND app_user_is_org_member(them.organization_id)
      )
    THEN coalesce(nullif(trim(u.full_name), ''), u.username, '')
    ELSE ''
  END
  FROM users u
  WHERE u.id = target_user_id;
$$;
--> statement-breakpoint

-- The creator of a brand-new company becomes its first staff member and
-- administrator. Refused once the company has any staff.
CREATE FUNCTION app_claim_new_organization(
  p_organization_id uuid,
  p_staff_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT app_is_platform_admin() THEN
    RAISE EXCEPTION 'Not allowed to create companies.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM organizations o WHERE o.id = p_organization_id
  ) THEN
    RAISE EXCEPTION 'Organization not found.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM staff_members s WHERE s.organization_id = p_organization_id
  ) THEN
    RAISE EXCEPTION 'This company already has staff.';
  END IF;

  INSERT INTO staff_members (
    id, organization_id, user_id, full_name, email, job_title, status, is_admin
  )
  SELECT
    p_staff_id,
    p_organization_id,
    u.id,
    coalesce(nullif(trim(u.full_name), ''), u.username),
    u.email,
    'Admin',
    'active',
    true
  FROM users u
  WHERE u.id = app_current_user_id();

  INSERT INTO staff_department_assignments (staff_id, department_key)
  VALUES (p_staff_id, 'admin'), (p_staff_id, 'management');
END;
$$;
--> statement-breakpoint

-- Give a staff member a login. Only a company administrator can; `users`
-- is otherwise readable and writable by its own owner only.
CREATE FUNCTION app_create_staff_login(
  p_staff_id uuid,
  p_username text,
  p_password_hash text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_staff staff_members%ROWTYPE;
  v_user_id uuid;
BEGIN
  SELECT * INTO v_staff FROM staff_members WHERE id = p_staff_id FOR UPDATE;

  IF NOT FOUND OR NOT app_user_is_org_admin(v_staff.organization_id) THEN
    RAISE EXCEPTION 'Not allowed to manage logins for this staff member.';
  END IF;
  IF v_staff.user_id IS NOT NULL THEN
    RAISE EXCEPTION 'STAFF_HAS_LOGIN';
  END IF;
  IF EXISTS (SELECT 1 FROM users u WHERE lower(u.username) = lower(p_username)) THEN
    RAISE EXCEPTION 'USERNAME_TAKEN';
  END IF;

  INSERT INTO users (username, full_name, email, password_hash)
  VALUES (lower(p_username), v_staff.full_name, v_staff.email, p_password_hash)
  RETURNING id INTO v_user_id;

  UPDATE staff_members
  SET user_id = v_user_id, updated_at = now()
  WHERE id = p_staff_id;

  RETURN v_user_id;
END;
$$;
--> statement-breakpoint

-- Reset a staff member's password. A platform admin's password can only be
-- changed by that person, so a company admin cannot take over the owner.
CREATE FUNCTION app_reset_staff_password(
  p_staff_id uuid,
  p_password_hash text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_staff staff_members%ROWTYPE;
BEGIN
  SELECT * INTO v_staff FROM staff_members WHERE id = p_staff_id;

  IF NOT FOUND OR NOT app_user_is_org_admin(v_staff.organization_id) THEN
    RAISE EXCEPTION 'Not allowed to manage logins for this staff member.';
  END IF;
  IF v_staff.user_id IS NULL THEN
    RAISE EXCEPTION 'STAFF_HAS_NO_LOGIN';
  END IF;
  IF v_staff.user_id IS DISTINCT FROM app_current_user_id() AND EXISTS (
    SELECT 1 FROM users u WHERE u.id = v_staff.user_id AND u.is_platform_admin
  ) THEN
    RAISE EXCEPTION 'OWNER_PASSWORD_PROTECTED';
  END IF;

  UPDATE users
  SET password_hash = p_password_hash, updated_at = now()
  WHERE id = v_staff.user_id;
END;
$$;
--> statement-breakpoint

-- Login username of a staff member, for those who maintain the staff directory.
CREATE FUNCTION app_staff_login_username(p_staff_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT u.username
  FROM staff_members s
  INNER JOIN users u ON u.id = s.user_id
  WHERE s.id = p_staff_id
    AND app_user_can_manage_staff(s.organization_id);
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
  app_user_is_org_admin(uuid),
  app_user_can_manage_staff(uuid),
  app_is_platform_admin(),
  app_member_display_name(uuid),
  app_claim_new_organization(uuid, uuid),
  app_create_staff_login(uuid, text, text),
  app_reset_staff_password(uuid, text),
  app_staff_login_username(uuid),
  app_find_user_for_login(text),
  app_record_login(uuid, text, text),
  app_is_org_code_available(text)
FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION
  app_current_user_id(),
  app_user_is_org_member(uuid),
  app_user_is_org_admin(uuid),
  app_user_can_manage_staff(uuid),
  app_is_platform_admin(),
  app_member_display_name(uuid),
  app_claim_new_organization(uuid, uuid),
  app_create_staff_login(uuid, text, text),
  app_reset_staff_password(uuid, text),
  app_staff_login_username(uuid),
  app_find_user_for_login(text),
  app_record_login(uuid, text, text),
  app_is_org_code_available(text)
TO aljazayeh_app;
