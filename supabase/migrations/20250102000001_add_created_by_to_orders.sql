-- Add created_by to orders table
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id);

-- Ensure RLS allows insert if authenticated
-- (Assuming existing policy allows insert for authenticated users with matching tenant_id)
-- If not, we might need:
-- CREATE POLICY "Enable insert for authenticated users" ON "public"."orders"
-- FOR INSERT TO authenticated
-- WITH CHECK ((select auth.uid()) = created_by);
