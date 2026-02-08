-- Fix RLS Policies for Cylinders Table
-- Drop existing restricted policies (just in case)
drop policy if exists "Enable read access for authenticated users" on cylinders;
drop policy if exists "Enable insert access for authenticated users" on cylinders;
drop policy if exists "Enable update access for authenticated users" on cylinders;
drop policy if exists "Enable read access for all users" on cylinders;
drop policy if exists "Enable insert access for all users" on cylinders;
drop policy if exists "Enable update access for all users" on cylinders;

-- Create Standard Isolation Policy
-- Users can only see rows where tenant_id matches their own tenant_id
drop policy if exists "Tenant Isolation" on cylinders;
create policy "Tenant Isolation" on cylinders 
    for all 
    using (tenant_id = public.get_my_tenant_id());

-- Ensure RLS is still enabled
alter table cylinders enable row level security;
