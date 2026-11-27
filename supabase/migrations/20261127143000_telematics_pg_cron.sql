-- =============================================================================
-- Migration: 20261127143000_telematics_pg_cron.sql
-- Purpose:   Автономный планировщик синхронизации телематики Wialon 24/7
--            внутри Supabase PostgreSQL (pg_cron + pg_net + Supabase Vault)
--            с интервалом 5 минут без лимитов внешних CI-раннеров.
--
-- ROLLBACK PLAN:
--   DO $$
--   BEGIN
--     IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'wialon-telematics-sync-5m') THEN
--       PERFORM cron.unschedule('wialon-telematics-sync-5m');
--     END IF;
--   END $$;
--   DROP FUNCTION IF EXISTS public.trigger_wialon_telematics_sync();
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE OR REPLACE FUNCTION public.trigger_wialon_telematics_sync()
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, net, vault
AS $$
DECLARE
  v_url text;
  v_secret text;
  v_request_id bigint;
BEGIN
  SELECT decrypted_secret INTO v_url
  FROM vault.decrypted_secrets
  WHERE name = 'wialon_cron_url'
  ORDER BY created_at DESC
  LIMIT 1;

  SELECT decrypted_secret INTO v_secret
  FROM vault.decrypted_secrets
  WHERE name = 'wialon_cron_secret'
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_url IS NULL OR btrim(v_url) = '' OR v_secret IS NULL OR btrim(v_secret) = '' THEN
    RETURN NULL;
  END IF;

  SELECT net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || v_secret,
      'Content-Type', 'application/json',
      'User-Agent', 'Supabase-PgCron-Telematics/1.0'
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 55000
  ) INTO v_request_id;

  RETURN v_request_id;
END;
$$;

REVOKE ALL ON FUNCTION public.trigger_wialon_telematics_sync() FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'wialon-telematics-sync-5m') THEN
    PERFORM cron.unschedule('wialon-telematics-sync-5m');
  END IF;

  PERFORM cron.schedule(
    'wialon-telematics-sync-5m',
    '*/5 * * * *',
    $cron$SELECT public.trigger_wialon_telematics_sync();$cron$
  );
END;
$$;
