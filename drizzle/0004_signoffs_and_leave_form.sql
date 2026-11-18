CREATE TABLE "document_signoffs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"document_type" text NOT NULL,
	"document_id" uuid NOT NULL,
	"step" integer NOT NULL,
	"decision" text NOT NULL,
	"signed_by_user_id" uuid NOT NULL,
	"signer_name" text NOT NULL,
	"signature_image" text,
	"remarks" text DEFAULT '' NOT NULL,
	"signed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "document_signoffs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "signatory_positions" (
	"organization_id" uuid NOT NULL,
	"position_key" text NOT NULL,
	"staff_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "signatory_positions_organization_id_position_key_pk" PRIMARY KEY("organization_id","position_key")
);
--> statement-breakpoint
ALTER TABLE "signatory_positions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "vacation_requests" ALTER COLUMN "start_date" SET DATA TYPE date USING "start_date"::date;--> statement-breakpoint
ALTER TABLE "vacation_requests" ALTER COLUMN "end_date" SET DATA TYPE date USING "end_date"::date;--> statement-breakpoint
ALTER TABLE "organization_settings" ADD COLUMN "name_arabic" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "organization_settings" ADD COLUMN "logo_image" text;--> statement-breakpoint
ALTER TABLE "staff_members" ADD COLUMN "home_country_contact" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "staff_members" ADD COLUMN "passport_number" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "signature_image" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "approval_pin_hash" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "approval_pin_failures" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "vacation_requests" ADD COLUMN "job_handled_by" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "vacation_requests" ADD COLUMN "leave_available_days" integer;--> statement-breakpoint
ALTER TABLE "vacation_requests" ADD COLUMN "office_comments" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "document_signoffs" ADD CONSTRAINT "document_signoffs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_signoffs" ADD CONSTRAINT "document_signoffs_signed_by_user_id_users_id_fk" FOREIGN KEY ("signed_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signatory_positions" ADD CONSTRAINT "signatory_positions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signatory_positions" ADD CONSTRAINT "signatory_positions_staff_id_staff_members_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff_members"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "document_signoffs_document_step_uidx" ON "document_signoffs" USING btree ("document_type","document_id","step");--> statement-breakpoint
CREATE INDEX "document_signoffs_org_idx" ON "document_signoffs" USING btree ("organization_id");--> statement-breakpoint
CREATE POLICY "document_signoffs_member_select" ON "document_signoffs" AS PERMISSIVE FOR SELECT TO public USING (app_user_is_org_member(organization_id));--> statement-breakpoint
CREATE POLICY "document_signoffs_member_insert" ON "document_signoffs" AS PERMISSIVE FOR INSERT TO public WITH CHECK (app_user_is_org_member(organization_id));--> statement-breakpoint
CREATE POLICY "signatory_positions_member_select" ON "signatory_positions" AS PERMISSIVE FOR SELECT TO public USING (app_user_is_org_member(organization_id));--> statement-breakpoint
CREATE POLICY "signatory_positions_admin_insert" ON "signatory_positions" AS PERMISSIVE FOR INSERT TO public WITH CHECK (app_user_is_org_admin(organization_id));--> statement-breakpoint
CREATE POLICY "signatory_positions_admin_update" ON "signatory_positions" AS PERMISSIVE FOR UPDATE TO public USING (app_user_is_org_admin(organization_id)) WITH CHECK (app_user_is_org_admin(organization_id));--> statement-breakpoint
CREATE POLICY "signatory_positions_admin_delete" ON "signatory_positions" AS PERMISSIVE FOR DELETE TO public USING (app_user_is_org_admin(organization_id));