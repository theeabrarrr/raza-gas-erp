-- Add status and receiver_id to transactions
ALTER TABLE "public"."transactions" ADD COLUMN IF NOT EXISTS "status" text NOT NULL DEFAULT 'completed';
ALTER TABLE "public"."transactions" ADD COLUMN IF NOT EXISTS "receiver_id" uuid REFERENCES "public"."users"("id");

-- Add check constraint for transactions status
ALTER TABLE "public"."transactions" DROP CONSTRAINT IF EXISTS "transactions_status_check";
ALTER TABLE "public"."transactions" ADD CONSTRAINT "transactions_status_check" CHECK (status IN ('pending', 'completed', 'rejected'));

-- Update check constraint for cylinders status to include 'handover_pending'
ALTER TABLE "public"."cylinders" DROP CONSTRAINT IF EXISTS "cylinders_status_check";
ALTER TABLE "public"."cylinders" ADD CONSTRAINT "cylinders_status_check" CHECK (status IN ('full', 'empty', 'missing', 'maintenance', 'at_customer', 'handover_pending'));
