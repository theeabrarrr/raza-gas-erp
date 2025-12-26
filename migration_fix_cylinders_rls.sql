-- Fix RLS Policies for Cylinders Table
-- Drop existing restricted policies
drop policy if exists "Enable read access for authenticated users" on cylinders;
drop policy if exists "Enable insert access for authenticated users" on cylinders;
drop policy if exists "Enable update access for authenticated users" on cylinders;

-- Create permissive policies for development (Mock Auth context)
create policy "Enable read access for all users" 
  on cylinders for select using (true);

create policy "Enable insert access for all users" 
  on cylinders for insert with check (true);

create policy "Enable update access for all users" 
  on cylinders for update using (true);

-- Ensure RLS is still enabled but policies are permissive
alter table cylinders enable row level security;
