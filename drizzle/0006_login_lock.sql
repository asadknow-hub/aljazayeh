ALTER TABLE "users" ADD COLUMN "failed_login_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "login_locked_until" timestamp with time zone;--> statement-breakpoint

-- Count a wrong password. After p_max_attempts in a row the login is locked
-- for p_lock_minutes and the count starts again. A lock that ends by itself
-- cannot be used to shut anyone out for good.
CREATE FUNCTION app_record_failed_login(
  p_user_id uuid,
  p_max_attempts integer,
  p_lock_minutes integer
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE users
  SET
    login_locked_until = CASE
      WHEN failed_login_count + 1 >= p_max_attempts
        THEN now() + make_interval(mins => p_lock_minutes)
      ELSE login_locked_until
    END,
    failed_login_count = CASE
      WHEN failed_login_count + 1 >= p_max_attempts THEN 0
      ELSE failed_login_count + 1
    END
  WHERE id = p_user_id;
$$;
--> statement-breakpoint

-- Minutes until a locked login opens again; 0 when it is not locked.
CREATE FUNCTION app_login_locked_minutes(p_user_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT greatest(
    0,
    ceil(extract(epoch FROM (u.login_locked_until - now())) / 60)::integer
  )
  FROM users u
  WHERE u.id = p_user_id AND u.login_locked_until IS NOT NULL;
$$;
--> statement-breakpoint

REVOKE ALL ON FUNCTION
  app_record_failed_login(uuid, integer, integer),
  app_login_locked_minutes(uuid)
FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION
  app_record_failed_login(uuid, integer, integer),
  app_login_locked_minutes(uuid)
TO aljazayeh_app;
--> statement-breakpoint

-- A successful login clears the count and any lock.
CREATE OR REPLACE FUNCTION app_record_login(
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
  UPDATE users
  SET failed_login_count = 0, login_locked_until = NULL
  WHERE id = p_user_id;

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

-- An administrator's password reset also unlocks the login.
CREATE OR REPLACE FUNCTION app_reset_staff_password(
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
  SET
    password_hash = p_password_hash,
    failed_login_count = 0,
    login_locked_until = NULL,
    updated_at = now()
  WHERE id = v_staff.user_id;
END;
$$;
