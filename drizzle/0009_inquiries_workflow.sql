ALTER TABLE "visitor_logs" ADD COLUMN "notes" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "visitor_logs" ADD COLUMN "inquiry_id" uuid;--> statement-breakpoint
CREATE TABLE "inquiry_workflow_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"stage_key" text NOT NULL,
	"department_key" text DEFAULT 'admin' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
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
ALTER TABLE "inquiry_workflow_settings" ADD CONSTRAINT "inquiry_workflow_settings_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inquiries" ADD CONSTRAINT "inquiries_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inquiries" ADD CONSTRAINT "inquiries_assigned_staff_id_staff_members_id_fk" FOREIGN KEY ("assigned_staff_id") REFERENCES "public"."staff_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inquiries" ADD CONSTRAINT "inquiries_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inquiry_line_items" ADD CONSTRAINT "inquiry_line_items_inquiry_id_inquiries_id_fk" FOREIGN KEY ("inquiry_id") REFERENCES "public"."inquiries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inquiry_stage_events" ADD CONSTRAINT "inquiry_stage_events_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inquiry_stage_events" ADD CONSTRAINT "inquiry_stage_events_inquiry_id_inquiries_id_fk" FOREIGN KEY ("inquiry_id") REFERENCES "public"."inquiries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inquiry_stage_events" ADD CONSTRAINT "inquiry_stage_events_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visitor_logs" ADD CONSTRAINT "visitor_logs_inquiry_id_inquiries_id_fk" FOREIGN KEY ("inquiry_id") REFERENCES "public"."inquiries"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "inquiry_workflow_settings_org_stage_uidx" ON "inquiry_workflow_settings" USING btree ("organization_id","stage_key");--> statement-breakpoint
CREATE INDEX "inquiry_workflow_settings_org_idx" ON "inquiry_workflow_settings" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "inquiries_org_idx" ON "inquiries" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "inquiries_org_stage_idx" ON "inquiries" USING btree ("organization_id","current_stage");--> statement-breakpoint
CREATE INDEX "inquiries_org_dept_idx" ON "inquiries" USING btree ("organization_id","owning_department_key");--> statement-breakpoint
CREATE INDEX "inquiry_line_items_inquiry_idx" ON "inquiry_line_items" USING btree ("inquiry_id");--> statement-breakpoint
CREATE INDEX "inquiry_stage_events_inquiry_idx" ON "inquiry_stage_events" USING btree ("inquiry_id");--> statement-breakpoint
CREATE INDEX "inquiry_stage_events_org_idx" ON "inquiry_stage_events" USING btree ("organization_id");--> statement-breakpoint
INSERT INTO "inquiry_workflow_settings" ("organization_id", "stage_key", "department_key")
SELECT o."id", s.stage_key, 'admin'
FROM "organizations" o
CROSS JOIN (
  VALUES
    ('inquiry'),
    ('quotation'),
    ('lpo_in_or_out'),
    ('proforma_invoice'),
    ('job_card'),
    ('progress_invoice'),
    ('delivery_note'),
    ('tax_invoice'),
    ('receipt_voucher')
) AS s(stage_key);
