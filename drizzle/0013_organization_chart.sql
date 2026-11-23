CREATE TABLE "org_positions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"block" text NOT NULL,
	"title" text NOT NULL,
	"signs_as" text,
	"staff_id" uuid,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "org_positions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "organization_settings" ADD COLUMN "closed_departments" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "org_positions" ADD CONSTRAINT "org_positions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_positions" ADD CONSTRAINT "org_positions_staff_id_staff_members_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "org_positions_org_idx" ON "org_positions" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "org_positions_org_signs_as_uidx" ON "org_positions" USING btree ("organization_id","signs_as") WHERE "org_positions"."signs_as" is not null;--> statement-breakpoint
CREATE POLICY "org_positions_member_select" ON "org_positions" AS PERMISSIVE FOR SELECT TO public USING (app_user_is_org_member(organization_id));--> statement-breakpoint
CREATE POLICY "org_positions_admin_insert" ON "org_positions" AS PERMISSIVE FOR INSERT TO public WITH CHECK (app_user_is_org_admin(organization_id));--> statement-breakpoint
CREATE POLICY "org_positions_admin_update" ON "org_positions" AS PERMISSIVE FOR UPDATE TO public USING (app_user_is_org_admin(organization_id)) WITH CHECK (app_user_is_org_admin(organization_id));--> statement-breakpoint
CREATE POLICY "org_positions_admin_delete" ON "org_positions" AS PERMISSIVE FOR DELETE TO public USING (app_user_is_org_admin(organization_id));--> statement-breakpoint

-- Every company starts its chart with the six positions the forms were
-- signed by until now, held by whoever was set under Signatories: two
-- owners at the top, the Accountant in Accounts, Admin and Purchaser in
-- Admin, the Foreman over the Workers.
INSERT INTO "org_positions" ("organization_id", "block", "title", "signs_as", "staff_id", "sort_order")
SELECT o."id", d."block", d."title", d."signs_as", s."staff_id", d."sort_order"
FROM "organizations" o
CROSS JOIN (VALUES
	('managing_partner', 'owners', 'CEO & Managing Partner', NULL, 0),
	('managing_director', 'owners', 'Managing Director', NULL, 1),
	('accountant', 'accounts', 'Accountant', 'accountant', 0),
	('admin', 'admin', 'Admin', 'admin', 0),
	('purchaser', 'admin', 'Purchaser', 'purchaser', 1),
	('foreman', 'workers', 'Foreman', 'foreman', 0)
) AS d("old_key", "block", "title", "signs_as", "sort_order")
LEFT JOIN "signatory_positions" s
	ON s."organization_id" = o."id" AND s."position_key" = d."old_key";
--> statement-breakpoint

-- An owner oversees the whole company, so every owner is in Management.
INSERT INTO "staff_department_assignments" ("staff_id", "department_key")
SELECT DISTINCT p."staff_id", 'management'
FROM "org_positions" p
WHERE p."block" = 'owners' AND p."staff_id" IS NOT NULL
ON CONFLICT DO NOTHING;
--> statement-breakpoint

-- Signatures already given say whose box they are and what was printed over
-- it, instead of only their place in a fixed list.
ALTER TABLE "document_signoffs" ADD COLUMN "signer_key" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "document_signoffs" ADD COLUMN "label" text DEFAULT '' NOT NULL;--> statement-breakpoint
UPDATE "document_signoffs" d
SET "label" = m."label",
	"signer_key" = CASE
		WHEN m."block" = 'preparer' THEN 'preparer'
		ELSE coalesce((
			SELECT p."id"::text
			FROM "org_positions" p
			WHERE p."organization_id" = d."organization_id"
				AND p."block" = m."block"
				AND (
					(m."block" = 'owners' AND p."sort_order" = m."owner_order")
					OR (m."block" <> 'owners' AND p."signs_as" = m."signs_as")
				)
			LIMIT 1
		), 'step-' || d."step")
	END
FROM (VALUES
	('leave_request', 0, 'preparer', '', 0, 'Prepared By'),
	('leave_request', 1, 'workers', 'foreman', 0, 'Forman'),
	('leave_request', 2, 'accounts', 'accountant', 0, 'Signature of Accountant'),
	('leave_request', 3, 'owners', '', 0, 'Signature of CEO & Managing Partner'),
	('leave_request', 4, 'owners', '', 1, 'Signature of Managing Director'),
	('fine_notice', 0, 'admin', 'admin', 0, 'Verified by Admin'),
	('fine_notice', 1, 'accounts', 'accountant', 0, 'Verified by Accounts'),
	('fine_notice', 2, 'owners', '', 0, 'Approved by Managing Partner'),
	('fine_notice', 3, 'owners', '', 1, 'Approved by Managing Director'),
	('medical_claim', 0, 'accounts', 'accountant', 0, 'Verified by Accounts'),
	('medical_claim', 1, 'owners', '', 0, 'Approved by Managing Partner'),
	('medical_claim', 2, 'owners', '', 1, 'Approved by Managing Director'),
	('petty_cash', 0, 'preparer', '', 0, 'Prepared By'),
	('petty_cash', 1, 'accounts', 'accountant', 0, 'Verified by Accounts'),
	('petty_cash', 2, 'owners', '', 0, 'Approved by Managing Partner'),
	('petty_cash', 3, 'owners', '', 1, 'Approved by Managing Director'),
	('material_request', 0, 'workers', 'foreman', 0, 'Verified by Forman'),
	('material_request', 1, 'admin', 'purchaser', 0, 'Verified by Purchaser'),
	('material_request', 2, 'accounts', 'accountant', 0, 'Verified by Accounts'),
	('material_request', 3, 'owners', '', 0, 'Approved by Managing Partner'),
	('material_request', 4, 'owners', '', 1, 'Approved by Managing Director'),
	('verbal_work_approval', 0, 'workers', 'foreman', 0, 'Verified by Forman'),
	('verbal_work_approval', 1, 'admin', 'purchaser', 0, 'Verified by Purchaser'),
	('verbal_work_approval', 2, 'accounts', 'accountant', 0, 'Verified by Account'),
	('verbal_work_approval', 3, 'owners', '', 0, 'Approved by Managing Partner & CEO'),
	('verbal_work_approval', 4, 'owners', '', 1, 'Approved by Managing Director')
) AS m("document_type", "step", "block", "signs_as", "owner_order", "label")
WHERE m."document_type" = d."document_type" AND m."step" = d."step";
--> statement-breakpoint
UPDATE "document_signoffs" SET "signer_key" = 'step-' || "step" WHERE "signer_key" = '';--> statement-breakpoint
ALTER TABLE "document_signoffs" ALTER COLUMN "signer_key" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "document_signoffs" ALTER COLUMN "label" DROP DEFAULT;--> statement-breakpoint
CREATE UNIQUE INDEX "document_signoffs_document_signer_uidx" ON "document_signoffs" USING btree ("document_type","document_id","signer_key");--> statement-breakpoint

-- An inquiry step is approved by the owners, or by whoever holds a position
-- on the chart. "Management" becomes the owners. Where a step was approved
-- by "Engineering", a Head of Engineering position is added for it, empty
-- until an administrator names somebody.
UPDATE "inquiry_workflow_settings" SET "approval_required_by" = 'owners' WHERE "approval_required_by" = 'management';--> statement-breakpoint
UPDATE "inquiry_stage_approvals" SET "required_by" = 'owners' WHERE "required_by" = 'management';--> statement-breakpoint
INSERT INTO "org_positions" ("organization_id", "block", "title", "sort_order")
SELECT DISTINCT w."organization_id", 'engineering', 'Head of Engineering', 0
FROM "inquiry_workflow_settings" w
WHERE w."approval_required" AND w."approval_required_by" = 'engineering';
--> statement-breakpoint
UPDATE "inquiry_workflow_settings" w
SET "approval_required_by" = p."id"::text
FROM "org_positions" p
WHERE w."approval_required" AND w."approval_required_by" = 'engineering'
	AND p."organization_id" = w."organization_id"
	AND p."block" = 'engineering' AND p."title" = 'Head of Engineering';
--> statement-breakpoint
UPDATE "inquiry_workflow_settings" SET "approval_required_by" = '' WHERE NOT "approval_required";
