CREATE TABLE "attendance_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"staff_id" uuid NOT NULL,
	"work_date" date NOT NULL,
	"status" text NOT NULL,
	"marked_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "attendance_records" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "organization_settings" ADD COLUMN "attendance_sheet_notes" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "staff_members" ADD COLUMN "joined_on" date;--> statement-breakpoint
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_staff_id_staff_members_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff_members"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_marked_by_user_id_users_id_fk" FOREIGN KEY ("marked_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "attendance_records_staff_date_uidx" ON "attendance_records" USING btree ("staff_id","work_date");--> statement-breakpoint
CREATE INDEX "attendance_records_org_date_idx" ON "attendance_records" USING btree ("organization_id","work_date");--> statement-breakpoint
CREATE POLICY "attendance_records_member_select" ON "attendance_records" AS PERMISSIVE FOR SELECT TO public USING (app_user_is_org_member(organization_id));--> statement-breakpoint
CREATE POLICY "attendance_records_member_insert" ON "attendance_records" AS PERMISSIVE FOR INSERT TO public WITH CHECK (app_user_is_org_member(organization_id));--> statement-breakpoint
CREATE POLICY "attendance_records_member_update" ON "attendance_records" AS PERMISSIVE FOR UPDATE TO public USING (app_user_is_org_member(organization_id)) WITH CHECK (app_user_is_org_member(organization_id));--> statement-breakpoint
CREATE POLICY "attendance_records_member_delete" ON "attendance_records" AS PERMISSIVE FOR DELETE TO public USING (app_user_is_org_member(organization_id));