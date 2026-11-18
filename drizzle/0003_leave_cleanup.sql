ALTER TABLE "vacation_requests" DROP CONSTRAINT "vacation_requests_reviewed_by_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "vacation_requests" DROP COLUMN "selected_dates";--> statement-breakpoint
ALTER TABLE "vacation_requests" DROP COLUMN "reviewed_by_user_id";--> statement-breakpoint
ALTER TABLE "vacation_requests" DROP COLUMN "reviewed_at";--> statement-breakpoint
ALTER TABLE "vacation_requests" DROP COLUMN "review_note";