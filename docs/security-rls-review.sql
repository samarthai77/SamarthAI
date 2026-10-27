-- Read-only review only. Do not paste credential values or table contents into reports.
BEGIN READ ONLY;

-- Private application tables must not be exposed to anon/authenticated through broad policies.
SELECT n.nspname AS schema_name, c.relname AS table_name,
       c.relrowsecurity AS rls_enabled, c.relforcerowsecurity AS rls_forced
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname IN ('public', 'storage') AND c.relkind = 'r'
ORDER BY 1, 2;

SELECT schemaname, tablename, policyname, roles, cmd, qual, with_check
FROM pg_policies WHERE schemaname IN ('public', 'storage')
ORDER BY schemaname, tablename, policyname;

SELECT table_schema, table_name, grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public' AND grantee IN ('anon', 'authenticated', 'PUBLIC')
ORDER BY table_name, grantee;

-- SECURITY DEFINER functions need a fixed safe search_path and constrained EXECUTE grants.
SELECT n.nspname, p.proname, p.prosecdef, p.proconfig, p.proacl
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
ORDER BY p.proname;

-- Verify unique indexes: webhook event_id, provider invoice/subscription/payment IDs,
-- users email, chat request identity and family membership/invite constraints.
SELECT tablename, indexname, indexdef FROM pg_indexes
WHERE schemaname = 'public' ORDER BY tablename, indexname;

-- Bucket policy metadata only; returns no object names, URLs or user data.
SELECT id, public, file_size_limit, allowed_mime_types FROM storage.buckets ORDER BY id;

ROLLBACK;
