ALTER TABLE "staff_members" ADD COLUMN "salary_amount" numeric(14, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "staff_members" ADD COLUMN "salary_currency" text DEFAULT 'AED' NOT NULL;--> statement-breakpoint
ALTER TABLE "staff_members" ADD COLUMN "pay_frequency" text DEFAULT 'monthly' NOT NULL;--> statement-breakpoint
ALTER TABLE "staff_members" ADD COLUMN "last_salary_paid_on" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "staff_members" ADD COLUMN "salary_notes" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "staff_members" ADD COLUMN "contract_title" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "staff_members" ADD COLUMN "contract_status" text DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "staff_members" ADD COLUMN "contract_start_date" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "staff_members" ADD COLUMN "contract_end_date" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "staff_members" ADD COLUMN "contract_notes" text DEFAULT '' NOT NULL;--> statement-breakpoint
UPDATE "staff_department_assignments" SET "department_key" = 'management' WHERE "department_key" = 'staff';
