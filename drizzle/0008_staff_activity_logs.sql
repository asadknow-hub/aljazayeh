CREATE TABLE "staff_activity_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"staff_id" uuid NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"category" text NOT NULL,
	"action" text NOT NULL,
	"summary" text NOT NULL,
	"details" text DEFAULT '' NOT NULL,
	"status" text DEFAULT '' NOT NULL,
	"day_count" integer DEFAULT 0 NOT NULL,
	"reference_type" text DEFAULT '' NOT NULL,
	"reference_id" text DEFAULT '' NOT NULL,
	"actor_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "staff_activity_logs" ADD CONSTRAINT "staff_activity_logs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_activity_logs" ADD CONSTRAINT "staff_activity_logs_staff_id_staff_members_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_activity_logs" ADD CONSTRAINT "staff_activity_logs_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "staff_activity_logs_org_idx" ON "staff_activity_logs" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "staff_activity_logs_org_occurred_idx" ON "staff_activity_logs" USING btree ("organization_id","occurred_at");--> statement-breakpoint
CREATE INDEX "staff_activity_logs_staff_idx" ON "staff_activity_logs" USING btree ("staff_id");--> statement-breakpoint
INSERT INTO "staff_activity_logs" (
  "organization_id",
  "staff_id",
  "occurred_at",
  "category",
  "action",
  "summary",
  "details",
  "status",
  "day_count",
  "reference_type",
  "reference_id",
  "actor_user_id"
)
SELECT
  v."organization_id",
  v."staff_id",
  v."created_at",
  'vacation',
  'requested',
  'Vacation requested',
  CASE
    WHEN v."reason" <> '' THEN v."leave_type" || ' · ' || v."reason"
    ELSE v."leave_type"
  END,
  v."status",
  v."day_count",
  'vacation_request',
  v."id"::text,
  v."requested_by_user_id"
FROM "vacation_requests" v;
--> statement-breakpoint
INSERT INTO "staff_activity_logs" (
  "organization_id",
  "staff_id",
  "occurred_at",
  "category",
  "action",
  "summary",
  "details",
  "status",
  "day_count",
  "reference_type",
  "reference_id",
  "actor_user_id"
)
SELECT
  v."organization_id",
  v."staff_id",
  COALESCE(v."reviewed_at", v."updated_at"),
  'vacation',
  v."status",
  CASE
    WHEN v."status" = 'approved' THEN 'Vacation approved'
    ELSE 'Vacation rejected'
  END,
  CASE
    WHEN v."reason" <> '' THEN v."leave_type" || ' · ' || v."reason"
    ELSE v."leave_type"
  END,
  v."status",
  v."day_count",
  'vacation_request',
  v."id"::text,
  v."reviewed_by_user_id"
FROM "vacation_requests" v
WHERE v."status" IN ('approved', 'rejected');--> statement-breakpoint
INSERT INTO "staff_activity_logs" (
  "organization_id",
  "staff_id",
  "occurred_at",
  "category",
  "action",
  "summary",
  "details",
  "status",
  "day_count",
  "reference_type",
  "reference_id",
  "actor_user_id"
)
SELECT
  s."organization_id",
  s."id",
  s."created_at",
  'staff',
  'created',
  'Staff record created',
  COALESCE(NULLIF(s."job_title", ''), 'Staff member'),
  s."status",
  0,
  'staff_member',
  s."id"::text,
  NULL
FROM "staff_members" s;
