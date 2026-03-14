-- EduCore Postgres/Supabase seed
-- Seeds ONLY the `transport_routes` table.

INSERT INTO public.transport_routes
  (transport_id, school_id, route_name, driver_name, driver_phone, vehicle_number, fee, status)
VALUES
  (1, 1, 'Kilimani Route', 'Daniel Kariuki', '0744556677', 'KDA 123A', 3000, 'active')
ON CONFLICT (transport_id) DO NOTHING;

SELECT setval(
  pg_get_serial_sequence('public.transport_routes', 'transport_id'),
  COALESCE((SELECT MAX(transport_id) FROM public.transport_routes), 1)
);

