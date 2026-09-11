CREATE TYPE "public"."course_status" AS ENUM('active', 'paused', 'completed', 'dropped');--> statement-breakpoint
CREATE TYPE "public"."day_of_week" AS ENUM('Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo');--> statement-breakpoint
CREATE TYPE "public"."subject_color" AS ENUM('blue', 'red', 'green', 'orange', 'purple', 'teal');--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "courses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"professor" text DEFAULT '' NOT NULL,
	"email" text DEFAULT '' NOT NULL,
	"faculty" text DEFAULT '' NOT NULL,
	"semester" text DEFAULT '' NOT NULL,
	"credits" integer DEFAULT 3 NOT NULL,
	"status" "course_status" DEFAULT 'active' NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"color" "subject_color" DEFAULT 'blue' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "credits_range" CHECK ("courses"."credits" BETWEEN 0 AND 12),
	CONSTRAINT "code_length" CHECK (char_length("courses"."code") BETWEEN 1 AND 16)
);
--> statement-breakpoint
CREATE TABLE "partials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_id" uuid NOT NULL,
	"name" text NOT NULL,
	"grade" numeric(5, 2),
	"percent" numeric(5, 2) NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "grade_range" CHECK ("partials"."grade" IS NULL OR ("partials"."grade" >= 0 AND "partials"."grade" <= 100)),
	CONSTRAINT "percent_range" CHECK ("partials"."percent" >= 0 AND "partials"."percent" <= 100)
);
--> statement-breakpoint
CREATE TABLE "schedules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_id" uuid NOT NULL,
	"day" "day_of_week" NOT NULL,
	"start_time" time NOT NULL,
	"end_time" time NOT NULL,
	"room" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "valid_time_range" CHECK ("schedules"."end_time" > "schedules"."start_time")
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"university" text DEFAULT '' NOT NULL,
	"faculty" text DEFAULT '' NOT NULL,
	"current_semester" text DEFAULT '' NOT NULL,
	"passing_grade" numeric(5, 2) DEFAULT '3.00' NOT NULL,
	"max_grade" numeric(5, 2) DEFAULT '5.00' NOT NULL,
	"preferences" jsonb DEFAULT '{"theme":"system","fontSize":"normal","gridCompact":false,"weekStartsOn":"monday","timeFormat24h":true,"defaultView":"grid","timezone":"America/Bogota","semesterEndDate":null}'::jsonb NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email"),
	CONSTRAINT "passing_grade_lt_max" CHECK ("user"."passing_grade" >= 0 AND "user"."passing_grade" < "user"."max_grade"),
	CONSTRAINT "max_grade_positive" CHECK ("user"."max_grade" > 0 AND "user"."max_grade" <= 100)
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "courses" ADD CONSTRAINT "courses_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partials" ADD CONSTRAINT "partials_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedules" ADD CONSTRAINT "schedules_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_user_id_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "courses_user_code_semester_idx" ON "courses" USING btree ("user_id","code","semester");--> statement-breakpoint
CREATE INDEX "courses_user_sort_idx" ON "courses" USING btree ("user_id","sort_order","created_at");--> statement-breakpoint
CREATE INDEX "partials_course_sort_idx" ON "partials" USING btree ("course_id","sort_order");--> statement-breakpoint
CREATE INDEX "schedules_course_day_start_idx" ON "schedules" USING btree ("course_id","day","start_time");--> statement-breakpoint
CREATE INDEX "session_user_id_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");