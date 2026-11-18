ALTER TABLE "staff_members" ADD COLUMN "user_id" uuid;--> statement-breakpoint
ALTER TABLE "staff_members" ADD CONSTRAINT "staff_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "staff_members_org_user_uidx" ON "staff_members" USING btree ("organization_id","user_id");--> statement-breakpoint
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
);--> statement-breakpoint
ALTER TABLE "inquiry_stage_approvals" ADD CONSTRAINT "inquiry_stage_approvals_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inquiry_stage_approvals" ADD CONSTRAINT "inquiry_stage_approvals_inquiry_id_inquiries_id_fk" FOREIGN KEY ("inquiry_id") REFERENCES "public"."inquiries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inquiry_stage_approvals" ADD CONSTRAINT "inquiry_stage_approvals_approved_by_user_id_users_id_fk" FOREIGN KEY ("approved_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "inquiry_stage_approvals_inquiry_stage_uidx" ON "inquiry_stage_approvals" USING btree ("inquiry_id","stage_key");--> statement-breakpoint
CREATE INDEX "inquiry_stage_approvals_org_idx" ON "inquiry_stage_approvals" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "inquiry_stage_approvals_inquiry_idx" ON "inquiry_stage_approvals" USING btree ("inquiry_id");--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "inquiries" ADD CONSTRAINT "inquiries_source_visitor_id_visitor_logs_id_fk" FOREIGN KEY ("source_visitor_id") REFERENCES "public"."visitor_logs"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
