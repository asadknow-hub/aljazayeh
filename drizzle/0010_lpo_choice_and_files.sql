CREATE TABLE "inquiry_attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"inquiry_id" uuid NOT NULL,
	"stage_key" text NOT NULL,
	"file_name" text NOT NULL,
	"content_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"content" text NOT NULL,
	"uploaded_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "inquiry_attachments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "inquiry_attachments" ADD CONSTRAINT "inquiry_attachments_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inquiry_attachments" ADD CONSTRAINT "inquiry_attachments_inquiry_id_inquiries_id_fk" FOREIGN KEY ("inquiry_id") REFERENCES "public"."inquiries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inquiry_attachments" ADD CONSTRAINT "inquiry_attachments_uploaded_by_user_id_users_id_fk" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "inquiry_attachments_inquiry_idx" ON "inquiry_attachments" USING btree ("inquiry_id");--> statement-breakpoint
CREATE INDEX "inquiry_attachments_org_idx" ON "inquiry_attachments" USING btree ("organization_id");--> statement-breakpoint
CREATE POLICY "inquiry_attachments_member_select" ON "inquiry_attachments" AS PERMISSIVE FOR SELECT TO public USING (app_user_is_org_member(organization_id));--> statement-breakpoint
CREATE POLICY "inquiry_attachments_member_insert" ON "inquiry_attachments" AS PERMISSIVE FOR INSERT TO public WITH CHECK (app_user_is_org_member(organization_id));--> statement-breakpoint
CREATE POLICY "inquiry_attachments_member_delete" ON "inquiry_attachments" AS PERMISSIVE FOR DELETE TO public USING (app_user_is_org_member(organization_id));--> statement-breakpoint
-- The LPO step is now called "lpo"; it used to be "lpo_in_or_out".
UPDATE "inquiries" SET "current_stage" = 'lpo' WHERE "current_stage" = 'lpo_in_or_out';--> statement-breakpoint
UPDATE "inquiry_stage_records" SET "stage_key" = 'lpo' WHERE "stage_key" = 'lpo_in_or_out';--> statement-breakpoint
UPDATE "inquiry_workflow_settings" SET "stage_key" = 'lpo' WHERE "stage_key" = 'lpo_in_or_out';--> statement-breakpoint
UPDATE "inquiry_stage_approvals" SET "stage_key" = 'lpo' WHERE "stage_key" = 'lpo_in_or_out';--> statement-breakpoint
UPDATE "inquiry_stage_events" SET "from_stage" = 'lpo' WHERE "from_stage" = 'lpo_in_or_out';--> statement-breakpoint
UPDATE "inquiry_stage_events" SET "to_stage" = 'lpo' WHERE "to_stage" = 'lpo_in_or_out';--> statement-breakpoint
-- LPO steps filled in before the choice existed recorded the customer's LPO.
UPDATE "inquiry_stage_records"
SET "fields" = "fields" || '{"lpoType": "customer"}'::jsonb
WHERE "stage_key" = 'lpo'
	AND coalesce("fields" ->> 'customerLpoNumber', '') <> ''
	AND NOT ("fields" ? 'lpoType');
