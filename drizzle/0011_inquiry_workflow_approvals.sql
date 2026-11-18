ALTER TABLE "inquiry_workflow_settings" ADD COLUMN "approval_required" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "inquiry_workflow_settings" ADD COLUMN "approval_required_by" text DEFAULT '' NOT NULL;
