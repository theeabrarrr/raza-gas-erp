-- Drop the old constraint
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;

-- Add new constraint with 'completed' and 'on_trip'
ALTER TABLE orders 
ADD CONSTRAINT orders_status_check 
CHECK (status IN ('pending', 'assigned', 'dispatched', 'on-the-road', 'on_trip', 'delivering', 'delivered', 'completed', 'cancelled'));

-- Add payment_method column if not exists
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_method text;

-- Also ensure proof_url exists on transactions (from the other migration, just in case)
ALTER TABLE transactions 
ADD COLUMN IF NOT EXISTS proof_url text;

COMMENT ON COLUMN transactions.proof_url IS 'URL to proof of transaction (e.g. receipt image)';
