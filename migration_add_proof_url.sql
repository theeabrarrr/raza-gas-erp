-- Add proof_url column to transactions table
ALTER TABLE transactions 
ADD COLUMN IF NOT EXISTS proof_url text;

-- Optional: Add comment
COMMENT ON COLUMN transactions.proof_url IS 'URL to proof of transaction (e.g. receipt image)';
