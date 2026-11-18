ALTER TABLE "vacation_requests" ADD COLUMN "selected_dates" text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE "vacation_requests" ADD COLUMN "day_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
UPDATE "vacation_requests"
SET
  "selected_dates" = CASE
    WHEN "start_date" = "end_date" THEN json_build_array("start_date")::text
    ELSE json_build_array("start_date", "end_date")::text
  END,
  "day_count" = CASE
    WHEN "start_date" = '' OR "end_date" = '' THEN 0
    WHEN "start_date" = "end_date" THEN 1
    ELSE GREATEST(1, (("end_date"::date - "start_date"::date) + 1))
  END
WHERE "day_count" = 0 AND "start_date" <> '';
