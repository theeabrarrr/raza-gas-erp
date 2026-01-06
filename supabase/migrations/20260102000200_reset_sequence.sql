-- Reset friendly_id sequence to 1
-- Check if sequence exists first to avoid error, or just run it. 
-- Standard naming for serial column friendly_id on table orders is orders_friendly_id_seq

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'orders_friendly_id_seq') THEN
        ALTER SEQUENCE orders_friendly_id_seq RESTART WITH 1;
    END IF;
END $$;
