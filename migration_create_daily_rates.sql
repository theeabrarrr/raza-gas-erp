-- 1. Daily Rates Table banayein
CREATE TABLE IF NOT EXISTS public.daily_rates (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    product_name text UNIQUE NOT NULL,
    current_rate numeric NOT NULL,
    updated_at timestamp WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 2. Initial Rate set karein (Rs. 11,000)
INSERT INTO public.daily_rates (product_name, current_rate)
VALUES ('LPG Cylinder 45.4KG', 11000)
ON CONFLICT (product_name) DO UPDATE SET current_rate = 11000;

-- 3. Ensure cylinders have 'current_location_type' column
ALTER TABLE public.cylinders ADD COLUMN IF NOT EXISTS current_location_type text DEFAULT 'godown';
