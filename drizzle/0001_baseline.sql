CREATE TABLE "inquiries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"customer_name" text NOT NULL,
	"contact" text DEFAULT '' NOT NULL,
	"delivery_expected_on" text DEFAULT '' NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"current_stage" text DEFAULT 'inquiry' NOT NULL,
	"owning_department_key" text DEFAULT 'admin' NOT NULL,
	"assigned_staff_id" uuid,
	"source" text DEFAULT 'admin' NOT NULL,
	"source_visitor_id" uuid,
	"created_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "inquiries" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "inquiry_comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"inquiry_id" uuid NOT NULL,
	"author_user_id" uuid NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "inquiry_comments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "inquiry_line_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"inquiry_id" uuid NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"quantity" numeric(14, 2) DEFAULT '1' NOT NULL,
	"unit_price" numeric(14, 2) DEFAULT '0' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "inquiry_line_items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "inquiry_stage_approvals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"inquiry_id" uuid NOT NULL,
	"stage_key" text NOT NULL,
	"required_by" text NOT NULL,
	"approved_by_user_id" uuid NOT NULL,
	"approved_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "inquiry_stage_approvals" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "inquiry_stage_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"inquiry_id" uuid NOT NULL,
	"from_stage" text DEFAULT '' NOT NULL,
	"to_stage" text NOT NULL,
	"actor_user_id" uuid,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "inquiry_stage_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "inquiry_workflow_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"stage_key" text NOT NULL,
	"department_key" text DEFAULT 'admin' NOT NULL,
	"approval_required" boolean DEFAULT false NOT NULL,
	"approval_required_by" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "inquiry_workflow_settings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "membership_roles" (
	"membership_id" uuid NOT NULL,
	"role_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "membership_roles_membership_id_role_id_pk" PRIMARY KEY("membership_id","role_id")
);
--> statement-breakpoint
ALTER TABLE "membership_roles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "memberships" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "organization_settings" (
	"organization_id" uuid PRIMARY KEY NOT NULL,
	"telephone_number" text DEFAULT '' NOT NULL,
	"phone_number" text DEFAULT '' NOT NULL,
	"whatsapp_number" text DEFAULT '' NOT NULL,
	"email" text DEFAULT '' NOT NULL,
	"website_url" text DEFAULT '' NOT NULL,
	"instagram_url" text DEFAULT '' NOT NULL,
	"facebook_url" text DEFAULT '' NOT NULL,
	"admin_name" text DEFAULT '' NOT NULL,
	"admin_email" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "organization_settings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"code" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "organizations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "permissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "permissions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "role_permissions" (
	"role_id" uuid NOT NULL,
	"permission_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "role_permissions_role_id_permission_id_pk" PRIMARY KEY("role_id","permission_id")
);
--> statement-breakpoint
ALTER TABLE "role_permissions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "roles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
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
ALTER TABLE "staff_activity_logs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "staff_department_assignments" (
	"staff_id" uuid NOT NULL,
	"department_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "staff_department_assignments_staff_id_department_key_pk" PRIMARY KEY("staff_id","department_key")
);
--> statement-breakpoint
ALTER TABLE "staff_department_assignments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "staff_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" uuid,
	"full_name" text NOT NULL,
	"email" text DEFAULT '' NOT NULL,
	"phone" text DEFAULT '' NOT NULL,
	"job_title" text DEFAULT '' NOT NULL,
	"employee_code" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"salary_amount" numeric(14, 2) DEFAULT '0' NOT NULL,
	"salary_currency" text DEFAULT 'AED' NOT NULL,
	"pay_frequency" text DEFAULT 'monthly' NOT NULL,
	"last_salary_paid_on" text DEFAULT '' NOT NULL,
	"salary_notes" text DEFAULT '' NOT NULL,
	"contract_title" text DEFAULT '' NOT NULL,
	"contract_status" text DEFAULT 'active' NOT NULL,
	"contract_start_date" text DEFAULT '' NOT NULL,
	"contract_end_date" text DEFAULT '' NOT NULL,
	"contract_notes" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "staff_members" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "user_contracts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"start_date" text DEFAULT '' NOT NULL,
	"end_date" text DEFAULT '' NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_contracts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "user_login_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip_address" text DEFAULT '' NOT NULL,
	"user_agent" text DEFAULT '' NOT NULL,
	"success" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_login_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "user_preferences" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"default_organization_id" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_preferences" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "user_salary" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"amount" numeric(14, 2) DEFAULT '0' NOT NULL,
	"currency" text DEFAULT 'AED' NOT NULL,
	"pay_frequency" text DEFAULT 'monthly' NOT NULL,
	"effective_from" text DEFAULT '' NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_salary" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" text NOT NULL,
	"full_name" text DEFAULT '' NOT NULL,
	"email" text DEFAULT '' NOT NULL,
	"password_hash" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "vacation_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"staff_id" uuid NOT NULL,
	"start_date" text NOT NULL,
	"end_date" text NOT NULL,
	"selected_dates" text DEFAULT '[]' NOT NULL,
	"day_count" integer DEFAULT 0 NOT NULL,
	"leave_type" text NOT NULL,
	"reason" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"requested_by_user_id" uuid NOT NULL,
	"reviewed_by_user_id" uuid,
	"reviewed_at" timestamp with time zone,
	"review_note" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "vacation_requests" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "visitor_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"full_name" text NOT NULL,
	"visited_at" timestamp with time zone NOT NULL,
	"purpose" text NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"inquiry_id" uuid,
	"logged_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "visitor_logs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "inquiries" ADD CONSTRAINT "inquiries_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inquiries" ADD CONSTRAINT "inquiries_assigned_staff_id_staff_members_id_fk" FOREIGN KEY ("assigned_staff_id") REFERENCES "public"."staff_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inquiries" ADD CONSTRAINT "inquiries_source_visitor_id_visitor_logs_id_fk" FOREIGN KEY ("source_visitor_id") REFERENCES "public"."visitor_logs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inquiries" ADD CONSTRAINT "inquiries_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inquiry_comments" ADD CONSTRAINT "inquiry_comments_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inquiry_comments" ADD CONSTRAINT "inquiry_comments_inquiry_id_inquiries_id_fk" FOREIGN KEY ("inquiry_id") REFERENCES "public"."inquiries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inquiry_comments" ADD CONSTRAINT "inquiry_comments_author_user_id_users_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inquiry_line_items" ADD CONSTRAINT "inquiry_line_items_inquiry_id_inquiries_id_fk" FOREIGN KEY ("inquiry_id") REFERENCES "public"."inquiries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inquiry_stage_approvals" ADD CONSTRAINT "inquiry_stage_approvals_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inquiry_stage_approvals" ADD CONSTRAINT "inquiry_stage_approvals_inquiry_id_inquiries_id_fk" FOREIGN KEY ("inquiry_id") REFERENCES "public"."inquiries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inquiry_stage_approvals" ADD CONSTRAINT "inquiry_stage_approvals_approved_by_user_id_users_id_fk" FOREIGN KEY ("approved_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inquiry_stage_events" ADD CONSTRAINT "inquiry_stage_events_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inquiry_stage_events" ADD CONSTRAINT "inquiry_stage_events_inquiry_id_inquiries_id_fk" FOREIGN KEY ("inquiry_id") REFERENCES "public"."inquiries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inquiry_stage_events" ADD CONSTRAINT "inquiry_stage_events_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inquiry_workflow_settings" ADD CONSTRAINT "inquiry_workflow_settings_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membership_roles" ADD CONSTRAINT "membership_roles_membership_id_memberships_id_fk" FOREIGN KEY ("membership_id") REFERENCES "public"."memberships"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membership_roles" ADD CONSTRAINT "membership_roles_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_settings" ADD CONSTRAINT "organization_settings_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_permissions_id_fk" FOREIGN KEY ("permission_id") REFERENCES "public"."permissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roles" ADD CONSTRAINT "roles_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_activity_logs" ADD CONSTRAINT "staff_activity_logs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_activity_logs" ADD CONSTRAINT "staff_activity_logs_staff_id_staff_members_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_activity_logs" ADD CONSTRAINT "staff_activity_logs_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_department_assignments" ADD CONSTRAINT "staff_department_assignments_staff_id_staff_members_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_members" ADD CONSTRAINT "staff_members_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_members" ADD CONSTRAINT "staff_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_contracts" ADD CONSTRAINT "user_contracts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_login_events" ADD CONSTRAINT "user_login_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_default_organization_id_organizations_id_fk" FOREIGN KEY ("default_organization_id") REFERENCES "public"."organizations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_salary" ADD CONSTRAINT "user_salary_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vacation_requests" ADD CONSTRAINT "vacation_requests_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vacation_requests" ADD CONSTRAINT "vacation_requests_staff_id_staff_members_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vacation_requests" ADD CONSTRAINT "vacation_requests_requested_by_user_id_users_id_fk" FOREIGN KEY ("requested_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vacation_requests" ADD CONSTRAINT "vacation_requests_reviewed_by_user_id_users_id_fk" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visitor_logs" ADD CONSTRAINT "visitor_logs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visitor_logs" ADD CONSTRAINT "visitor_logs_inquiry_id_inquiries_id_fk" FOREIGN KEY ("inquiry_id") REFERENCES "public"."inquiries"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visitor_logs" ADD CONSTRAINT "visitor_logs_logged_by_user_id_users_id_fk" FOREIGN KEY ("logged_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "inquiries_org_idx" ON "inquiries" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "inquiries_org_stage_idx" ON "inquiries" USING btree ("organization_id","current_stage");--> statement-breakpoint
CREATE INDEX "inquiries_org_dept_idx" ON "inquiries" USING btree ("organization_id","owning_department_key");--> statement-breakpoint
CREATE INDEX "inquiry_comments_inquiry_idx" ON "inquiry_comments" USING btree ("inquiry_id");--> statement-breakpoint
CREATE INDEX "inquiry_comments_org_idx" ON "inquiry_comments" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "inquiry_line_items_inquiry_idx" ON "inquiry_line_items" USING btree ("inquiry_id");--> statement-breakpoint
CREATE UNIQUE INDEX "inquiry_stage_approvals_inquiry_stage_uidx" ON "inquiry_stage_approvals" USING btree ("inquiry_id","stage_key");--> statement-breakpoint
CREATE INDEX "inquiry_stage_approvals_org_idx" ON "inquiry_stage_approvals" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "inquiry_stage_approvals_inquiry_idx" ON "inquiry_stage_approvals" USING btree ("inquiry_id");--> statement-breakpoint
CREATE INDEX "inquiry_stage_events_inquiry_idx" ON "inquiry_stage_events" USING btree ("inquiry_id");--> statement-breakpoint
CREATE INDEX "inquiry_stage_events_org_idx" ON "inquiry_stage_events" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "inquiry_workflow_settings_org_stage_uidx" ON "inquiry_workflow_settings" USING btree ("organization_id","stage_key");--> statement-breakpoint
CREATE INDEX "inquiry_workflow_settings_org_idx" ON "inquiry_workflow_settings" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "memberships_user_org_uidx" ON "memberships" USING btree ("user_id","organization_id");--> statement-breakpoint
CREATE INDEX "memberships_org_idx" ON "memberships" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "memberships_user_idx" ON "memberships" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "organizations_code_uidx" ON "organizations" USING btree ("code");--> statement-breakpoint
CREATE UNIQUE INDEX "permissions_key_uidx" ON "permissions" USING btree ("key");--> statement-breakpoint
CREATE UNIQUE INDEX "roles_org_key_uidx" ON "roles" USING btree ("organization_id","key");--> statement-breakpoint
CREATE INDEX "roles_org_idx" ON "roles" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "staff_activity_logs_org_idx" ON "staff_activity_logs" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "staff_activity_logs_org_occurred_idx" ON "staff_activity_logs" USING btree ("organization_id","occurred_at");--> statement-breakpoint
CREATE INDEX "staff_activity_logs_staff_idx" ON "staff_activity_logs" USING btree ("staff_id");--> statement-breakpoint
CREATE INDEX "staff_department_assignments_dept_idx" ON "staff_department_assignments" USING btree ("department_key");--> statement-breakpoint
CREATE INDEX "staff_members_org_idx" ON "staff_members" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "staff_members_org_name_idx" ON "staff_members" USING btree ("organization_id","full_name");--> statement-breakpoint
CREATE UNIQUE INDEX "staff_members_org_user_uidx" ON "staff_members" USING btree ("organization_id","user_id");--> statement-breakpoint
CREATE INDEX "user_contracts_user_idx" ON "user_contracts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_login_events_user_occurred_idx" ON "user_login_events" USING btree ("user_id","occurred_at");--> statement-breakpoint
CREATE UNIQUE INDEX "users_username_uidx" ON "users" USING btree ("username");--> statement-breakpoint
CREATE INDEX "vacation_requests_org_idx" ON "vacation_requests" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "vacation_requests_staff_idx" ON "vacation_requests" USING btree ("staff_id");--> statement-breakpoint
CREATE INDEX "vacation_requests_org_status_idx" ON "vacation_requests" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "visitor_logs_org_idx" ON "visitor_logs" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "visitor_logs_org_visited_idx" ON "visitor_logs" USING btree ("organization_id","visited_at");--> statement-breakpoint
CREATE POLICY "inquiries_member_all" ON "inquiries" AS PERMISSIVE FOR ALL TO public USING (app_user_is_org_member(organization_id)) WITH CHECK (app_user_is_org_member(organization_id));--> statement-breakpoint
CREATE POLICY "inquiry_comments_member_select" ON "inquiry_comments" AS PERMISSIVE FOR SELECT TO public USING (app_user_is_org_member(organization_id));--> statement-breakpoint
CREATE POLICY "inquiry_comments_member_insert" ON "inquiry_comments" AS PERMISSIVE FOR INSERT TO public WITH CHECK (app_user_is_org_member(organization_id));--> statement-breakpoint
CREATE POLICY "inquiry_line_items_member_all" ON "inquiry_line_items" AS PERMISSIVE FOR ALL TO public USING (exists (select 1 from inquiries p where p.id = inquiry_id and app_user_is_org_member(p.organization_id))) WITH CHECK (exists (select 1 from inquiries p where p.id = inquiry_id and app_user_is_org_member(p.organization_id)));--> statement-breakpoint
CREATE POLICY "inquiry_stage_approvals_member_select" ON "inquiry_stage_approvals" AS PERMISSIVE FOR SELECT TO public USING (app_user_is_org_member(organization_id));--> statement-breakpoint
CREATE POLICY "inquiry_stage_approvals_member_insert" ON "inquiry_stage_approvals" AS PERMISSIVE FOR INSERT TO public WITH CHECK (app_user_is_org_member(organization_id));--> statement-breakpoint
CREATE POLICY "inquiry_stage_approvals_member_delete" ON "inquiry_stage_approvals" AS PERMISSIVE FOR DELETE TO public USING (app_user_is_org_member(organization_id));--> statement-breakpoint
CREATE POLICY "inquiry_stage_events_member_select" ON "inquiry_stage_events" AS PERMISSIVE FOR SELECT TO public USING (app_user_is_org_member(organization_id));--> statement-breakpoint
CREATE POLICY "inquiry_stage_events_member_insert" ON "inquiry_stage_events" AS PERMISSIVE FOR INSERT TO public WITH CHECK (app_user_is_org_member(organization_id));--> statement-breakpoint
CREATE POLICY "inquiry_workflow_settings_member_all" ON "inquiry_workflow_settings" AS PERMISSIVE FOR ALL TO public USING (app_user_is_org_member(organization_id)) WITH CHECK (app_user_is_org_member(organization_id));--> statement-breakpoint
CREATE POLICY "membership_roles_member_all" ON "membership_roles" AS PERMISSIVE FOR ALL TO public USING (exists (select 1 from memberships p where p.id = membership_id and app_user_is_org_member(p.organization_id))) WITH CHECK (exists (select 1 from memberships p where p.id = membership_id and app_user_is_org_member(p.organization_id)));--> statement-breakpoint
CREATE POLICY "memberships_member_select" ON "memberships" AS PERMISSIVE FOR SELECT TO public USING (app_user_is_org_member(organization_id) or user_id = app_current_user_id());--> statement-breakpoint
CREATE POLICY "memberships_member_insert" ON "memberships" AS PERMISSIVE FOR INSERT TO public WITH CHECK (app_user_is_org_member(organization_id));--> statement-breakpoint
CREATE POLICY "memberships_member_update" ON "memberships" AS PERMISSIVE FOR UPDATE TO public USING (app_user_is_org_member(organization_id)) WITH CHECK (app_user_is_org_member(organization_id));--> statement-breakpoint
CREATE POLICY "memberships_member_delete" ON "memberships" AS PERMISSIVE FOR DELETE TO public USING (app_user_is_org_member(organization_id));--> statement-breakpoint
CREATE POLICY "organization_settings_member_all" ON "organization_settings" AS PERMISSIVE FOR ALL TO public USING (app_user_is_org_member(organization_id)) WITH CHECK (app_user_is_org_member(organization_id));--> statement-breakpoint
CREATE POLICY "organizations_member_select" ON "organizations" AS PERMISSIVE FOR SELECT TO public USING (app_user_is_org_member(id));--> statement-breakpoint
CREATE POLICY "organizations_member_update" ON "organizations" AS PERMISSIVE FOR UPDATE TO public USING (app_user_is_org_member(id)) WITH CHECK (app_user_is_org_member(id));--> statement-breakpoint
CREATE POLICY "organizations_authenticated_insert" ON "organizations" AS PERMISSIVE FOR INSERT TO public WITH CHECK (app_current_user_id() is not null);--> statement-breakpoint
CREATE POLICY "permissions_read_authenticated" ON "permissions" AS PERMISSIVE FOR SELECT TO public USING (app_current_user_id() is not null);--> statement-breakpoint
CREATE POLICY "role_permissions_member_all" ON "role_permissions" AS PERMISSIVE FOR ALL TO public USING (exists (select 1 from roles p where p.id = role_id and app_user_is_org_member(p.organization_id))) WITH CHECK (exists (select 1 from roles p where p.id = role_id and app_user_is_org_member(p.organization_id)));--> statement-breakpoint
CREATE POLICY "roles_member_all" ON "roles" AS PERMISSIVE FOR ALL TO public USING (app_user_is_org_member(organization_id)) WITH CHECK (app_user_is_org_member(organization_id));--> statement-breakpoint
CREATE POLICY "staff_activity_logs_member_all" ON "staff_activity_logs" AS PERMISSIVE FOR ALL TO public USING (app_user_is_org_member(organization_id)) WITH CHECK (app_user_is_org_member(organization_id));--> statement-breakpoint
CREATE POLICY "staff_department_assignments_member_all" ON "staff_department_assignments" AS PERMISSIVE FOR ALL TO public USING (exists (select 1 from staff_members p where p.id = staff_id and app_user_is_org_member(p.organization_id))) WITH CHECK (exists (select 1 from staff_members p where p.id = staff_id and app_user_is_org_member(p.organization_id)));--> statement-breakpoint
CREATE POLICY "staff_members_member_all" ON "staff_members" AS PERMISSIVE FOR ALL TO public USING (app_user_is_org_member(organization_id)) WITH CHECK (app_user_is_org_member(organization_id));--> statement-breakpoint
CREATE POLICY "user_contracts_self" ON "user_contracts" AS PERMISSIVE FOR ALL TO public USING (user_id = app_current_user_id()) WITH CHECK (user_id = app_current_user_id());--> statement-breakpoint
CREATE POLICY "user_login_events_self_select" ON "user_login_events" AS PERMISSIVE FOR SELECT TO public USING (user_id = app_current_user_id());--> statement-breakpoint
CREATE POLICY "user_login_events_self_insert" ON "user_login_events" AS PERMISSIVE FOR INSERT TO public WITH CHECK (user_id = app_current_user_id());--> statement-breakpoint
CREATE POLICY "user_preferences_self" ON "user_preferences" AS PERMISSIVE FOR ALL TO public USING (user_id = app_current_user_id()) WITH CHECK (user_id = app_current_user_id());--> statement-breakpoint
CREATE POLICY "user_salary_self" ON "user_salary" AS PERMISSIVE FOR ALL TO public USING (user_id = app_current_user_id()) WITH CHECK (user_id = app_current_user_id());--> statement-breakpoint
CREATE POLICY "users_self_select" ON "users" AS PERMISSIVE FOR SELECT TO public USING (id = app_current_user_id());--> statement-breakpoint
CREATE POLICY "users_self_update" ON "users" AS PERMISSIVE FOR UPDATE TO public USING (id = app_current_user_id()) WITH CHECK (id = app_current_user_id());--> statement-breakpoint
CREATE POLICY "vacation_requests_member_all" ON "vacation_requests" AS PERMISSIVE FOR ALL TO public USING (app_user_is_org_member(organization_id)) WITH CHECK (app_user_is_org_member(organization_id));--> statement-breakpoint
CREATE POLICY "visitor_logs_member_all" ON "visitor_logs" AS PERMISSIVE FOR ALL TO public USING (app_user_is_org_member(organization_id)) WITH CHECK (app_user_is_org_member(organization_id));