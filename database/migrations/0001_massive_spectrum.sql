ALTER TABLE "timetable" ALTER COLUMN "class_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "timetable" ADD COLUMN "user_id" uuid;--> statement-breakpoint
ALTER TABLE "timetable" ADD CONSTRAINT "timetable_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "timetable_user_idx" ON "timetable" USING btree ("user_id");