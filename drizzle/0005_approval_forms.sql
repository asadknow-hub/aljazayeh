CREATE TABLE "approval_forms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"form_type" text NOT NULL,
	"reference_no" text NOT NULL,
	"staff_id" uuid,
	"fields" jsonb NOT NULL,
	"lines" jsonb NOT NULL,
	"amount" numeric(14, 2),
	"status" text DEFAULT 'pending' NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "approval_forms" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "document_counters" (
	"organization_id" uuid NOT NULL,
	"counter_key" text NOT NULL,
	"year" integer NOT NULL,
	"last_number" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "document_counters_organization_id_counter_key_year_pk" PRIMARY KEY("organization_id","counter_key","year")
);
--> statement-breakpoint
ALTER TABLE "document_counters" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "approval_forms" ADD CONSTRAINT "approval_forms_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_forms" ADD CONSTRAINT "approval_forms_staff_id_staff_members_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff_members"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_forms" ADD CONSTRAINT "approval_forms_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_counters" ADD CONSTRAINT "document_counters_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "approval_forms_org_reference_uidx" ON "approval_forms" USING btree ("organization_id","reference_no");--> statement-breakpoint
CREATE INDEX "approval_forms_org_type_idx" ON "approval_forms" USING btree ("organization_id","form_type");--> statement-breakpoint
CREATE POLICY "approval_forms_member_select" ON "approval_forms" AS PERMISSIVE FOR SELECT TO public USING (app_user_is_org_member(organization_id));--> statement-breakpoint
CREATE POLICY "approval_forms_member_insert" ON "approval_forms" AS PERMISSIVE FOR INSERT TO public WITH CHECK (app_user_is_org_member(organization_id));--> statement-breakpoint
CREATE POLICY "approval_forms_member_update" ON "approval_forms" AS PERMISSIVE FOR UPDATE TO public USING (app_user_is_org_member(organization_id)) WITH CHECK (app_user_is_org_member(organization_id));--> statement-breakpoint
CREATE POLICY "document_counters_member_select" ON "document_counters" AS PERMISSIVE FOR SELECT TO public USING (app_user_is_org_member(organization_id));--> statement-breakpoint
CREATE POLICY "document_counters_member_insert" ON "document_counters" AS PERMISSIVE FOR INSERT TO public WITH CHECK (app_user_is_org_member(organization_id));--> statement-breakpoint
CREATE POLICY "document_counters_member_update" ON "document_counters" AS PERMISSIVE FOR UPDATE TO public USING (app_user_is_org_member(organization_id)) WITH CHECK (app_user_is_org_member(organization_id));