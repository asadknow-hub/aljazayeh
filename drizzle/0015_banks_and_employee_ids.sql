CREATE TABLE "bank_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"label" text NOT NULL,
	"bank_name" text DEFAULT '' NOT NULL,
	"account_name" text DEFAULT '' NOT NULL,
	"account_number" text DEFAULT '' NOT NULL,
	"iban" text DEFAULT '' NOT NULL,
	"swift" text DEFAULT '' NOT NULL,
	"branch" text DEFAULT '' NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bank_accounts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "inquiry_stage_records" ADD COLUMN "bank" jsonb;--> statement-breakpoint
ALTER TABLE "bank_accounts" ADD CONSTRAINT "bank_accounts_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bank_accounts_org_idx" ON "bank_accounts" USING btree ("organization_id");--> statement-breakpoint
CREATE POLICY "bank_accounts_member_select" ON "bank_accounts" AS PERMISSIVE FOR SELECT TO public USING (app_user_is_org_member(organization_id));--> statement-breakpoint
CREATE POLICY "bank_accounts_member_insert" ON "bank_accounts" AS PERMISSIVE FOR INSERT TO public WITH CHECK (app_user_is_org_member(organization_id));--> statement-breakpoint
CREATE POLICY "bank_accounts_member_update" ON "bank_accounts" AS PERMISSIVE FOR UPDATE TO public USING (app_user_is_org_member(organization_id)) WITH CHECK (app_user_is_org_member(organization_id));--> statement-breakpoint

-- The one bank account a company had under Company Settings becomes its
-- first bank account, and the one new papers start with.
INSERT INTO "bank_accounts" ("organization_id", "label", "bank_name", "account_name", "account_number", "iban", "swift", "branch", "is_default")
SELECT s."organization_id",
	coalesce(nullif(s."bank_name", ''), 'Main account'),
	s."bank_name", s."bank_account_name", s."bank_account_number", s."bank_iban", s."bank_swift", s."bank_branch",
	true
FROM "organization_settings" s
WHERE s."bank_name" <> '' OR s."bank_account_number" <> '' OR s."bank_iban" <> '' OR s."bank_account_name" <> '';
--> statement-breakpoint

-- Papers that asked to be paid printed that account, so the steps they
-- belong to keep it.
UPDATE "inquiry_stage_records" r
SET "bank" = jsonb_build_object(
		'bankName', b."bank_name", 'accountName', b."account_name", 'accountNumber', b."account_number",
		'iban', b."iban", 'swift', b."swift", 'branch', b."branch"),
	"fields" = r."fields" || jsonb_build_object('bankAccount', b."id"::text)
FROM "bank_accounts" b
WHERE b."organization_id" = r."organization_id"
	AND r."stage_key" IN ('quotation', 'proforma_invoice', 'progress_invoice', 'tax_invoice', 'commercial_invoice');
--> statement-breakpoint
ALTER TABLE "organization_settings" DROP COLUMN "bank_name";--> statement-breakpoint
ALTER TABLE "organization_settings" DROP COLUMN "bank_account_name";--> statement-breakpoint
ALTER TABLE "organization_settings" DROP COLUMN "bank_account_number";--> statement-breakpoint
ALTER TABLE "organization_settings" DROP COLUMN "bank_iban";--> statement-breakpoint
ALTER TABLE "organization_settings" DROP COLUMN "bank_swift";--> statement-breakpoint
ALTER TABLE "organization_settings" DROP COLUMN "bank_branch";--> statement-breakpoint

-- Every employee has an ID, and no two people of a company share one. IDs
-- typed before stay; where two people were given the same one, the person
-- added first keeps it. Everyone left without one gets the company's next
-- free number, in the order they were added.
UPDATE "staff_members" SET "employee_code" = upper(regexp_replace("employee_code", '\s+', '', 'g'));--> statement-breakpoint
UPDATE "staff_members" s
SET "employee_code" = ''
WHERE s."employee_code" <> ''
	AND EXISTS (
		SELECT 1 FROM "staff_members" o
		WHERE o."organization_id" = s."organization_id"
			AND o."employee_code" = s."employee_code"
			AND (o."created_at", o."id") < (s."created_at", s."id")
	);
--> statement-breakpoint
DO $$
DECLARE
	person record;
	company uuid;
	n integer := 0;
	code text;
BEGIN
	FOR person IN
		SELECT "id", "organization_id" FROM "staff_members"
		WHERE "employee_code" = ''
		ORDER BY "organization_id", "created_at", "id"
	LOOP
		IF company IS DISTINCT FROM person."organization_id" THEN
			-- Carry the count over to the app, then start the next company.
			IF company IS NOT NULL THEN
				INSERT INTO "document_counters" ("organization_id", "counter_key", "year", "last_number")
				VALUES (company, 'EMP', 0, n);
			END IF;
			company := person."organization_id";
			n := 0;
		END IF;
		LOOP
			n := n + 1;
			code := 'EMP-' || lpad(n::text, 4, '0');
			EXIT WHEN NOT EXISTS (
				SELECT 1 FROM "staff_members"
				WHERE "organization_id" = company AND "employee_code" = code
			);
		END LOOP;
		UPDATE "staff_members" SET "employee_code" = code WHERE "id" = person."id";
	END LOOP;
	IF company IS NOT NULL THEN
		INSERT INTO "document_counters" ("organization_id", "counter_key", "year", "last_number")
		VALUES (company, 'EMP', 0, n);
	END IF;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX "staff_members_org_employee_code_uidx" ON "staff_members" USING btree ("organization_id","employee_code") WHERE "staff_members"."employee_code" <> '';
