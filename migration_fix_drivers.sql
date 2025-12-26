-- 1. Standardize all driver roles (handle casing/spaces)
UPDATE users 
SET role = 'driver' 
WHERE role ILIKE 'driver%';

-- 2. Initialize statuses for drivers (fix NULLs)
UPDATE users 
SET status = 'idle' 
WHERE role = 'driver' AND status IS NULL;
