CREATE TABLE "letterheads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"name_arabic" text DEFAULT '' NOT NULL,
	"logo_image" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "letterheads" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "letterheads" ADD CONSTRAINT "letterheads_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "letterheads_org_idx" ON "letterheads" USING btree ("organization_id");--> statement-breakpoint
CREATE POLICY "letterheads_member_select" ON "letterheads" AS PERMISSIVE FOR SELECT TO public USING (app_user_is_org_member(organization_id));--> statement-breakpoint
CREATE POLICY "letterheads_member_insert" ON "letterheads" AS PERMISSIVE FOR INSERT TO public WITH CHECK (app_user_is_org_member(organization_id));--> statement-breakpoint
CREATE POLICY "letterheads_member_update" ON "letterheads" AS PERMISSIVE FOR UPDATE TO public USING (app_user_is_org_member(organization_id)) WITH CHECK (app_user_is_org_member(organization_id));--> statement-breakpoint

-- The LPO step used to ask whose LPO the job runs on. Now the customer's LPO
-- is the LPO and ours is an extra paper of the step. A step that ran on our
-- own LPO had none from the customer: it becomes a job confirmed verbally,
-- with our LPO prepared.
UPDATE "inquiry_stage_records"
SET "fields" = "fields" || '{"lpoType": "verbal", "ownLpo": "yes"}'::jsonb
WHERE "stage_key" = 'lpo' AND "fields"->>'lpoType' = 'own';
