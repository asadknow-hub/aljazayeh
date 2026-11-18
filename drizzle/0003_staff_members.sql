CREATE TABLE "staff_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"full_name" text NOT NULL,
	"email" text DEFAULT '' NOT NULL,
	"phone" text DEFAULT '' NOT NULL,
	"job_title" text DEFAULT '' NOT NULL,
	"employee_code" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "staff_department_assignments" (
	"staff_id" uuid NOT NULL,
	"department_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "staff_department_assignments_staff_id_department_key_pk" PRIMARY KEY("staff_id","department_key")
);
--> statement-breakpoint
ALTER TABLE "staff_members" ADD CONSTRAINT "staff_members_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_department_assignments" ADD CONSTRAINT "staff_department_assignments_staff_id_staff_members_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "staff_members_org_idx" ON "staff_members" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "staff_members_org_name_idx" ON "staff_members" USING btree ("organization_id","full_name");--> statement-breakpoint
CREATE INDEX "staff_department_assignments_dept_idx" ON "staff_department_assignments" USING btree ("department_key");
