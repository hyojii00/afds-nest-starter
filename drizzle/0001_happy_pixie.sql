CREATE TABLE "order_activity" (
	"event_id" uuid PRIMARY KEY NOT NULL,
	"order_id" uuid NOT NULL,
	"customer_id" varchar(100) NOT NULL,
	"currency" varchar(3) NOT NULL,
	"total_amount_minor" bigint NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "order_activity_order_idx" ON "order_activity" USING btree ("order_id","occurred_at");