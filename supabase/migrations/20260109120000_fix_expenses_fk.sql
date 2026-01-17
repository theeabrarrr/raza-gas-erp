-- Fix missing Foreign Key on expenses.user_id

DO $$
BEGIN
    -- Check if constraint exists, if not add it
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'expenses_user_id_fkey'
    ) THEN
        ALTER TABLE public.expenses
        ADD CONSTRAINT expenses_user_id_fkey
        FOREIGN KEY (user_id)
        REFERENCES public.users(id)
        ON UPDATE CASCADE
        ON DELETE CASCADE; -- If user is deleted, expense records might as well be deleted or set to null. Driver app usually implies tight coupling.
    END IF;
END $$;
