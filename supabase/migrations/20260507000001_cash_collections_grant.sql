-- Grant access to cash_collections for service_role and authenticated
-- Rollback: REVOKE ALL ON cash_collections FROM authenticated, anon;

GRANT ALL ON TABLE cash_collections TO service_role;
GRANT ALL ON TABLE cash_collections TO authenticated;
GRANT ALL ON TABLE cash_collections TO anon;
