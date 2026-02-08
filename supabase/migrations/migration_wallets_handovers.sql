-- Create Wallet Table
CREATE TABLE IF NOT EXISTS employee_wallets (
  user_id uuid PRIMARY KEY REFERENCES users(id),
  balance numeric DEFAULT 0 NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create Handover Logs Table
CREATE TABLE IF NOT EXISTS handover_logs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id uuid REFERENCES users(id),
  receiver_id uuid REFERENCES users(id), -- Optional, initially null until verified? or selected by driver
  amount numeric NOT NULL,
  status text NOT NULL CHECK (status IN ('pending', 'verified', 'rejected')) DEFAULT 'pending',
  proof_url text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  verified_at timestamp with time zone
);

-- Enable RLS (Standard Practice)
ALTER TABLE employee_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE handover_logs ENABLE ROW LEVEL SECURITY;

-- Simple Policies (Adjust as needed for strictness)
CREATE POLICY "Public Read Wallets" ON employee_wallets FOR SELECT USING (true);
CREATE POLICY "Public Update Wallets" ON employee_wallets FOR UPDATE USING (true); -- Simplified for demo
CREATE POLICY "Public Insert Wallets" ON employee_wallets FOR INSERT WITH CHECK (true);

CREATE POLICY "Public Read Handovers" ON handover_logs FOR SELECT USING (true);
CREATE POLICY "Public Insert Handovers" ON handover_logs FOR INSERT WITH CHECK (true);
CREATE POLICY "Public Update Handovers" ON handover_logs FOR UPDATE USING (true);

-- Add foreign key relationship if needed for specific user queries, but references users(id) handles it.
