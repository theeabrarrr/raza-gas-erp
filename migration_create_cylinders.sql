-- Create cylinders table
create table if not exists cylinders (
  id uuid default gen_random_uuid() primary key,
  serial_number text not null unique,
  type text not null check (type in ('domestic', 'commercial')),
  status text not null default 'empty' check (status in ('full', 'empty', 'missing', 'maintenance')),
  condition text default 'good',
  current_location_type text default 'shop' check (current_location_type in ('shop', 'driver', 'customer')),
  current_holder_id uuid, -- Can be User ID (Shop/Driver) or Customer ID
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table cylinders enable row level security;

-- Policies
create policy "Enable read access for authenticated users" 
  on cylinders for select using (auth.role() = 'authenticated');

create policy "Enable insert access for authenticated users" 
  on cylinders for insert with check (auth.role() = 'authenticated');

create policy "Enable update access for authenticated users" 
  on cylinders for update using (auth.role() = 'authenticated');

-- Create generic Inventory/Metrics view helper (Optional, but good for queries)
-- For now, we will query directly.
