CREATE TABLE "inquiry_stage_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"inquiry_id" uuid NOT NULL,
	"stage_key" text NOT NULL,
	"document_number" text DEFAULT '' NOT NULL,
	"fields" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"handled_by_staff_id" uuid,
	"completed_at" timestamp with time zone,
	"completed_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "inquiry_stage_records" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "inquiries" ADD COLUMN "inquiry_number" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "inquiries" ADD COLUMN "title" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "inquiries" ADD COLUMN "job_type" text DEFAULT 'local' NOT NULL;--> statement-breakpoint
ALTER TABLE "inquiries" ADD COLUMN "status" text DEFAULT 'open' NOT NULL;--> statement-breakpoint
ALTER TABLE "inquiries" ADD COLUMN "close_reason" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "inquiries" ADD COLUMN "closed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "inquiries" ADD COLUMN "stage_entered_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "inquiry_line_items" ADD COLUMN "unit" text DEFAULT 'Nos' NOT NULL;--> statement-breakpoint
ALTER TABLE "inquiry_line_items" ADD COLUMN "delivered_quantity" numeric(14, 2);--> statement-breakpoint
ALTER TABLE "inquiry_stage_records" ADD CONSTRAINT "inquiry_stage_records_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inquiry_stage_records" ADD CONSTRAINT "inquiry_stage_records_inquiry_id_inquiries_id_fk" FOREIGN KEY ("inquiry_id") REFERENCES "public"."inquiries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inquiry_stage_records" ADD CONSTRAINT "inquiry_stage_records_handled_by_staff_id_staff_members_id_fk" FOREIGN KEY ("handled_by_staff_id") REFERENCES "public"."staff_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inquiry_stage_records" ADD CONSTRAINT "inquiry_stage_records_completed_by_user_id_users_id_fk" FOREIGN KEY ("completed_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "inquiry_stage_records_inquiry_stage_uidx" ON "inquiry_stage_records" USING btree ("inquiry_id","stage_key");--> statement-breakpoint
CREATE INDEX "inquiry_stage_records_org_idx" ON "inquiry_stage_records" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "inquiries_org_number_uidx" ON "inquiries" USING btree ("organization_id","inquiry_number") WHERE "inquiries"."inquiry_number" <> '';--> statement-breakpoint
CREATE POLICY "inquiry_stage_records_member_select" ON "inquiry_stage_records" AS PERMISSIVE FOR SELECT TO public USING (app_user_is_org_member(organization_id));--> statement-breakpoint
CREATE POLICY "inquiry_stage_records_member_insert" ON "inquiry_stage_records" AS PERMISSIVE FOR INSERT TO public WITH CHECK (app_user_is_org_member(organization_id));--> statement-breakpoint
CREATE POLICY "inquiry_stage_records_member_update" ON "inquiry_stage_records" AS PERMISSIVE FOR UPDATE TO public USING (app_user_is_org_member(organization_id)) WITH CHECK (app_user_is_org_member(organization_id));--> statement-breakpoint
-- Inquiries that already exist get a running number, oldest first.
WITH numbered AS (
	SELECT i.id,
		upper(o.code) AS code,
		extract(year FROM i.created_at AT TIME ZONE 'Asia/Dubai')::int AS yr,
		row_number() OVER (
			PARTITION BY i.organization_id, extract(year FROM i.created_at AT TIME ZONE 'Asia/Dubai')
			ORDER BY i.created_at, i.id
		) AS n
	FROM "inquiries" i
	JOIN "organizations" o ON o.id = i.organization_id
)
UPDATE "inquiries"
SET "inquiry_number" = numbered.code || '/INQ/' || numbered.yr || '/' || lpad(numbered.n::text, 4, '0'),
	"stage_entered_at" = "inquiries"."updated_at"
FROM numbered
WHERE "inquiries".id = numbered.id;--> statement-breakpoint
INSERT INTO "document_counters" ("organization_id", "counter_key", "year", "last_number")
SELECT organization_id, 'INQ', extract(year FROM created_at AT TIME ZONE 'Asia/Dubai')::int, count(*)
FROM "inquiries"
GROUP BY 1, 3
ON CONFLICT ("organization_id", "counter_key", "year") DO UPDATE SET "last_number" = EXCLUDED."last_number";
