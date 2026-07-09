CREATE TABLE "lecture_overrides" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"timetable_id" uuid NOT NULL,
	"date" date NOT NULL,
	"teacher" text,
	"room" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lecture_overrides_unique" UNIQUE("user_id","timetable_id","date")
);
--> statement-breakpoint
ALTER TABLE "lecture_overrides" ADD CONSTRAINT "lecture_overrides_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lecture_overrides" ADD CONSTRAINT "lecture_overrides_timetable_id_timetable_id_fk" FOREIGN KEY ("timetable_id") REFERENCES "public"."timetable"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "lecture_overrides_user_idx" ON "lecture_overrides" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "lecture_overrides_timetable_idx" ON "lecture_overrides" USING btree ("timetable_id");--> statement-breakpoint
CREATE INDEX "lecture_overrides_date_idx" ON "lecture_overrides" USING btree ("date");