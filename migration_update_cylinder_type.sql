-- Drop the old constraint on 'type'
alter table cylinders drop constraint if exists cylinders_type_check;

-- Add new constraint allowing '45.4KG'
-- We can also just remove the check entirely if we want flexibility, but strict is good.
alter table cylinders add constraint cylinders_type_check 
  check (type in ('45.4KG', 'domestic', 'commercial')); 
  -- Keeping old ones just in case existing rows exist, but we will migrate them.

-- Update existing rows (if any) to '45.4KG'
update cylinders set type = '45.4KG';

-- Now we can restrict strict if we want, but let's leave it flexible or just strict
alter table cylinders drop constraint cylinders_type_check;
alter table cylinders add constraint cylinders_type_check check (type = '45.4KG');
