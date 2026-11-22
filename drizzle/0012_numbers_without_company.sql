-- Document numbers no longer start with the company's code: "QTN/2026/0001"
-- instead of "AJE/QTN/2026/0001". Every paper already carries the company's
-- name, and a long company code made the numbers unreadable. Numbers given
-- before this change lose the same prefix, so old and new ones look alike.
-- Within a company they stay unique: they all lose the same prefix.
UPDATE "inquiries" i
SET "inquiry_number" = substr(i."inquiry_number", length(o."code") + 2)
FROM "organizations" o
WHERE o."id" = i."organization_id"
  AND left(i."inquiry_number", length(o."code") + 1) = upper(o."code") || '/';
--> statement-breakpoint
UPDATE "inquiry_stage_records" r
SET "document_number" = substr(r."document_number", length(o."code") + 2)
FROM "organizations" o
WHERE o."id" = r."organization_id"
  AND left(r."document_number", length(o."code") + 1) = upper(o."code") || '/';
--> statement-breakpoint
UPDATE "inquiry_stage_records" r
SET "document_numbers" = (
  SELECT jsonb_object_agg(
    n."key",
    CASE
      WHEN left(n."value", length(o."code") + 1) = upper(o."code") || '/'
        THEN substr(n."value", length(o."code") + 2)
      ELSE n."value"
    END
  )
  FROM jsonb_each_text(r."document_numbers") AS n
)
FROM "organizations" o
WHERE o."id" = r."organization_id"
  AND r."document_numbers" <> '{}'::jsonb;
--> statement-breakpoint
UPDATE "approval_forms" f
SET "reference_no" = substr(f."reference_no", length(o."code") + 2)
FROM "organizations" o
WHERE o."id" = f."organization_id"
  AND left(f."reference_no", length(o."code") + 1) = upper(o."code") || '/';
