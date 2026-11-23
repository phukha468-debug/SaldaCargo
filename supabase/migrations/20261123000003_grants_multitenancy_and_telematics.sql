-- =============================================================================
-- Migration: 20261123000003_grants_multitenancy_and_telematics.sql
-- Purpose:   Явная выдача привилегий service_role и authenticated на новые
--            таблицы Multi-tenancy и Автопилота Wialon v2 (RLS остаётся
--            строго активным для authenticated; service_role обходит RLS).
--
-- ROLLBACK PLAN:
--   REVOKE ALL ON TABLE public.organizations FROM service_role, authenticated;
--   REVOKE ALL ON TABLE public.organization_members FROM service_role, authenticated;
--   REVOKE ALL ON TABLE public.organization_integrations FROM service_role, authenticated;
--   REVOKE ALL ON TABLE public.vehicle_telematics_state FROM service_role, authenticated;
--   REVOKE ALL ON TABLE public.telematics_events FROM service_role, authenticated;
--   REVOKE ALL ON TABLE public.telematics_geocode_cache FROM service_role, authenticated;
-- =============================================================================

GRANT ALL ON TABLE public.organizations TO service_role, authenticated;
GRANT ALL ON TABLE public.organization_members TO service_role, authenticated;
GRANT ALL ON TABLE public.organization_integrations TO service_role, authenticated;
GRANT ALL ON TABLE public.vehicle_telematics_state TO service_role, authenticated;
GRANT ALL ON TABLE public.telematics_events TO service_role, authenticated;
GRANT ALL ON TABLE public.telematics_geocode_cache TO service_role, authenticated;

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role, authenticated;
GRANT EXECUTE ON FUNCTION public.current_organization_id() TO service_role, authenticated, anon;
