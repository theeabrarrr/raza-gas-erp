-- Add amount_received column to orders table
ALTER TABLE orders ADD COLUMN IF NOT EXISTS amount_received numeric DEFAULT 0;

COMMENT ON COLUMN orders.amount_received IS 'Actual cash/money collected during delivery. If less than total_amount, difference is credit.';
