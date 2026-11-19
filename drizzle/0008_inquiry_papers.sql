ALTER TABLE "inquiry_line_items" ADD COLUMN "details" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "inquiry_stage_records" ADD COLUMN "document_numbers" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "inquiry_stage_records" ADD COLUMN "tables" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "organization_settings" ADD COLUMN "address" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "organization_settings" ADD COLUMN "address_arabic" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "organization_settings" ADD COLUMN "po_box" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "organization_settings" ADD COLUMN "trn" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "organization_settings" ADD COLUMN "bank_name" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "organization_settings" ADD COLUMN "bank_account_name" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "organization_settings" ADD COLUMN "bank_account_number" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "organization_settings" ADD COLUMN "bank_iban" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "organization_settings" ADD COLUMN "bank_swift" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "organization_settings" ADD COLUMN "bank_branch" text DEFAULT '' NOT NULL;