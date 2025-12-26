-- Add column to track verification status
alter table trips add column if not exists returns_verified boolean default false;

-- Function to get metrics for trips needing return verification
create or replace function get_trip_return_metrics()
returns table (
  trip_id uuid,
  driver_name text,
  driver_id uuid,
  start_time timestamptz,
  end_time timestamptz,
  completed_orders_count bigint,
  expected_empty_returns bigint
)
language plpgsql
as $$
begin
  return query
  select 
    t.id as trip_id,
    u.name as driver_name,
    u.id as driver_id,
    t.start_time,
    t.end_time,
    count(o.id) as completed_orders_count,
    -- Assume 1 order = 1 cylinder for now (or sum quantity if available)
    -- Ideally we sum order_items.quantity for cylinder products, but simplistic start:
    coalesce(sum(
      (select sum(oi.quantity) from order_items oi where oi.order_id = o.id)
    ), 0)::bigint as expected_empty_returns
  from trips t
  join users u on t.driver_id = u.id
  left join orders o on o.driver_id = u.id 
    and (o.trip_started_at >= t.start_time)
    and (o.trip_completed_at <= coalesce(t.end_time, now()))
    and o.status = 'completed'
  where 
    -- Show active trips OR completed trips that haven't been verified
    (t.status = 'ongoing' or (t.status = 'completed' and t.returns_verified = false))
  group by t.id, u.name, u.id, t.start_time, t.end_time
  order by t.start_time desc;
end;
$$;

-- Function to process the actual return of assets
create or replace function process_trip_returns(p_trip_id uuid)
returns json
language plpgsql
as $$
declare
  v_updated_count int;
  v_order_ids uuid[];
begin
  -- 1. Get all completed orders in this trip
  -- We use the same logic as metrics: orders that happened during this trip
  select array_agg(o.id) into v_order_ids
  from orders o
  join trips t on t.id = p_trip_id
  where o.driver_id = t.driver_id
    and o.status = 'completed'
    and o.trip_started_at >= t.start_time
    and o.trip_completed_at <= coalesce(t.end_time, now());

  -- 2. Update cylinders linked to these orders
  -- Logic: If they were "delivered" in this trip, they are currently at 'customer'.
  -- We want to set them to 'godown' and 'empty'.
  
  with updated_rows as (
    update cylinders
    set 
      current_location_type = 'godown',
      status = 'empty',
      updated_at = now()
    where last_order_id = any(v_order_ids)
      -- Optional safety: only move those currently at customer? 
      -- Yes, if they were already moved, don't move again.
      and current_location_type = 'customer'
    returning id
  )
  select count(*) into v_updated_count from updated_rows;

  -- 3. Mark trip as verified
  update trips 
  set returns_verified = true 
  where id = p_trip_id;

  return json_build_object(
    'success', true,
    'trip_id', p_trip_id,
    'cylinders_returned', v_updated_count
  );
end;
$$;
