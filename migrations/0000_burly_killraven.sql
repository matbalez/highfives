CREATE TABLE "high_fives" (
	"id" serial PRIMARY KEY NOT NULL,
	"recipient" text NOT NULL,
	"reason" text NOT NULL,
	"sender" text,
	"created_at" text NOT NULL,
	"nostr_event_id" text,
	"profile_name" text,
	"sender_profile_name" text
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"password" text NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
