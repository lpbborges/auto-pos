ALTER TABLE IF EXISTS "public"."sales" ADD COLUMN IF NOT EXISTS "cancelled_at" timestamp with time zone;
ALTER TABLE IF EXISTS "public"."sales" ADD COLUMN IF NOT EXISTS "cancelled_by" uuid REFERENCES "auth"."users"("id");
