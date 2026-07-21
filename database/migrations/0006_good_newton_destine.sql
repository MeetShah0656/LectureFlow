ALTER TABLE "timetable" ADD COLUMN "effective_from" date DEFAULT CURRENT_DATE NOT NULL;--> statement-breakpoint
ALTER TABLE "timetable" ADD COLUMN "effective_until" date;--> statement-breakpoint
ALTER TABLE "timetable" ADD COLUMN "is_active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
CREATE INDEX "timetable_active_idx" ON "timetable" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "timetable_effective_idx" ON "timetable" USING btree ("effective_from","effective_until");