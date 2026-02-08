-- Drop existing constraint
alter table cylinders drop constraint if exists cylinders_current_location_type_check;

-- Add new constraint including 'godown'
alter table cylinders add constraint cylinders_current_location_type_check 
  check (current_location_type in ('godown', 'shop', 'driver', 'customer'));
