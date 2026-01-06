-- Trigger to automatically update customer.last_order_at when an order is created

CREATE OR REPLACE FUNCTION public.update_last_order_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.customers
    SET last_order_at = NEW.created_at
    WHERE id = NEW.customer_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists to prevent duplication error on re-runs
DROP TRIGGER IF EXISTS on_order_created_update_customer ON public.orders;

CREATE TRIGGER on_order_created_update_customer
AFTER INSERT ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.update_last_order_timestamp();
