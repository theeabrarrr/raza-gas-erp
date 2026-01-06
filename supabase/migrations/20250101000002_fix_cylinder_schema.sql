-- 1. Remove global uniqueness on serial_number
ALTER TABLE public.cylinders DROP CONSTRAINT IF EXISTS cylinders_serial_number_key;

-- 2. Enforce Tenant-Scoped Uniqueness
-- A serial number must only be unique WITHIN a tenant
ALTER TABLE public.cylinders 
ADD CONSTRAINT cylinders_tenant_serial_unique UNIQUE (tenant_id, serial_number);

-- 3. Add QR Metadata Columns
ALTER TABLE public.cylinders 
ADD COLUMN IF NOT EXISTS qr_code_data TEXT GENERATED ALWAYS AS (
  'tenant=' || tenant_id || '&id=' || serial_number
) STORED;
