-- SamarthAI only. Run once in the existing SamarthAI Supabase SQL Editor.
-- This migration creates auth-only tables/functions. It does not migrate users,
-- change passwords, revoke current JWTs, or modify existing rows when executed.
-- Existing-name/schema conflicts fail the transaction rather than overwrite data.
-- Run as a trusted SQL Editor administrator (normally postgres).
-- The owner and BYPASSRLS roles bypass RLS; browser ACLs remain mandatory.
-- Any error before COMMIT requires ROLLBACK; after COMMIT it cannot undo DDL.
BEGIN;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='30s';

DO $owner_check$
BEGIN
    IF current_user <> 'postgres' AND NOT EXISTS (
        SELECT 1 FROM pg_catalog.pg_roles WHERE rolname=current_user AND rolsuper
    ) THEN RAISE EXCEPTION 'Trusted administrator owner required'; END IF;
    IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles
        WHERE rolname IN ('anon','authenticated','service_role')
          AND (rolsuper OR rolcreaterole OR rolcreatedb OR rolreplication
               OR (rolname IN ('anon','authenticated') AND rolbypassrls))) THEN
        RAISE EXCEPTION 'Unsafe elevated API role attributes';
    END IF;
    IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles
        WHERE rolname IN ('anon','authenticated','service_role')
          AND pg_catalog.pg_has_role(oid,current_user,'MEMBER')) THEN
        RAISE EXCEPTION 'API roles must not inherit the function owner';
    END IF;
END $owner_check$;

-- Check existing dependencies without changing their schema or contents.
DO $schema_check$
DECLARE required_column record;
BEGIN
    FOR required_column IN SELECT * FROM (VALUES
        ('users','id',ARRAY['uuid']),('users','password',ARRAY['text','varchar']),
        ('password_reset_tokens','user_id',ARRAY['uuid']),
        ('password_reset_tokens','token_hash',ARRAY['text','varchar']),
        ('password_reset_tokens','expires_at',ARRAY['timestamptz']),
        ('password_reset_tokens','used_at',ARRAY['timestamptz'])
    ) AS expected(table_name,column_name,type_names)
    LOOP
        IF NOT EXISTS (
            SELECT 1 FROM pg_catalog.pg_attribute a
            JOIN pg_catalog.pg_type t ON t.oid=a.atttypid
            WHERE a.attrelid=pg_catalog.to_regclass('public.'||required_column.table_name)
              AND a.attname=required_column.column_name AND NOT a.attisdropped
              AND t.typname=ANY(required_column.type_names)
        ) THEN RAISE EXCEPTION 'Auth dependency schema mismatch: %.%',
            required_column.table_name,required_column.column_name; END IF;
    END LOOP;
    IF NOT EXISTS (
        SELECT 1 FROM pg_catalog.pg_index i
        JOIN pg_catalog.pg_attribute a ON a.attrelid=i.indrelid AND a.attnum=i.indkey[0]
        WHERE i.indrelid='public.password_reset_tokens'::regclass
          AND a.attname='token_hash' AND i.indisunique AND i.indisvalid
          AND i.indnkeyatts=1 AND i.indpred IS NULL AND i.indexprs IS NULL
    ) THEN RAISE EXCEPTION 'Unique reset token_hash index required'; END IF;
END $schema_check$;

CREATE TABLE public.auth_user_security (
    user_id uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
    token_version bigint NOT NULL DEFAULT 0 CHECK (token_version >= 0),
    disabled boolean NOT NULL DEFAULT false,
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.auth_sessions (
    id uuid PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    token_version bigint NOT NULL CHECK (token_version >= 0),
    refresh_generation bigint NOT NULL DEFAULT 0 CHECK (refresh_generation >= 0),
    refresh_hash text NOT NULL UNIQUE CHECK (refresh_hash ~ '^[0-9a-f]{64}$'),
    previous_refresh_hash text CHECK (previous_refresh_hash ~ '^[0-9a-f]{64}$'),
    previous_valid_until timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    rotated_at timestamptz NOT NULL DEFAULT now(),
    last_used_at timestamptz NOT NULL DEFAULT now(),
    idle_expires_at timestamptz NOT NULL,
    absolute_expires_at timestamptz NOT NULL,
    revoked_at timestamptz,
    CHECK (idle_expires_at <= absolute_expires_at),
    CHECK (absolute_expires_at > created_at),
    CHECK ((previous_refresh_hash IS NULL) = (previous_valid_until IS NULL))
);
CREATE INDEX auth_sessions_user_idx ON public.auth_sessions(user_id);
CREATE INDEX auth_sessions_expiry_idx ON public.auth_sessions(absolute_expires_at);

ALTER TABLE public.auth_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auth_user_security ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.auth_sessions, public.auth_user_security
    FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.auth_sessions, public.auth_user_security TO service_role;
-- Writes are through the service-role-only atomic functions below.

CREATE FUNCTION public.samarth_auth_create_session(
    p_user_id uuid, p_session_id uuid, p_refresh_hash text, p_expected_password_hash text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = '' SET lock_timeout = '3s' AS $$
DECLARE security_row public.auth_user_security; now_at timestamptz; current_password_hash text;
BEGIN
    -- Backend bcrypt verification happens first. Recheck its snapshot under lock
    -- so a concurrent password reset cannot mint a session from old credentials.
    -- All auth mutations serialize on the existing user row FIRST.
    SELECT password INTO current_password_hash FROM public.users WHERE id=p_user_id FOR UPDATE;
    IF NOT FOUND OR current_password_hash IS NULL OR p_expected_password_hash IS NULL
       OR current_password_hash IS DISTINCT FROM p_expected_password_hash THEN
        RETURN jsonb_build_object('state','credentials_changed');
    END IF;
    IF p_refresh_hash IS NULL OR p_refresh_hash !~ '^[0-9a-f]{64}$' THEN
        RAISE EXCEPTION 'Invalid session hash' USING ERRCODE='22023';
    END IF;
    INSERT INTO public.auth_user_security(user_id) VALUES(p_user_id)
        ON CONFLICT(user_id) DO NOTHING;
    SELECT * INTO security_row FROM public.auth_user_security
        WHERE user_id=p_user_id FOR SHARE;
    IF security_row.disabled THEN RETURN jsonb_build_object('state','disabled'); END IF;
    now_at := clock_timestamp();
    INSERT INTO public.auth_sessions(id,user_id,token_version,refresh_hash,
        created_at,rotated_at,last_used_at,idle_expires_at,absolute_expires_at)
    VALUES(p_session_id,p_user_id,security_row.token_version,p_refresh_hash,
        now_at,now_at,now_at,now_at+interval '7 days',now_at+interval '30 days');
    RETURN jsonb_build_object('state','created','session_id',p_session_id,
        'token_version',security_row.token_version,'absolute_expires_at',now_at+interval '30 days');
END $$;

CREATE FUNCTION public.samarth_auth_rotate_session(
    p_session_id uuid, p_presented_hash text, p_next_hash text, p_generation bigint
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = '' SET lock_timeout = '3s' AS $$
DECLARE session_row public.auth_sessions; security_row public.auth_user_security;
    owner_id uuid; now_at timestamptz; outcome text;
BEGIN
    IF p_generation IS NULL OR p_generation < 0 OR p_generation >= 9223372036854775807 OR p_presented_hash IS NULL OR p_next_hash IS NULL
       OR p_presented_hash !~ '^[0-9a-f]{64}$' OR p_next_hash !~ '^[0-9a-f]{64}$' THEN
        RETURN jsonb_build_object('state','invalid');
    END IF;
    SELECT user_id INTO owner_id FROM public.auth_sessions WHERE id=p_session_id;
    IF NOT FOUND THEN RETURN jsonb_build_object('state','invalid'); END IF;
    PERFORM 1 FROM public.users WHERE id=owner_id FOR UPDATE;
    IF NOT FOUND THEN RETURN jsonb_build_object('state','invalid'); END IF;
    -- Shared order: user, security, session. No lock upgrades from SHARE to UPDATE.
    SELECT * INTO security_row FROM public.auth_user_security
        WHERE user_id=owner_id FOR SHARE;
    IF NOT FOUND THEN RETURN jsonb_build_object('state','invalid'); END IF;
    SELECT * INTO session_row FROM public.auth_sessions WHERE id=p_session_id FOR UPDATE;
    IF NOT FOUND THEN RETURN jsonb_build_object('state','invalid'); END IF;
    now_at := clock_timestamp();
    IF security_row.disabled OR session_row.revoked_at IS NOT NULL
       OR session_row.token_version <> security_row.token_version THEN
        RETURN jsonb_build_object('state','revoked');
    END IF;
    IF session_row.absolute_expires_at <= now_at OR session_row.idle_expires_at <= now_at THEN
        RETURN jsonb_build_object('state','expired');
    END IF;
    IF p_generation=session_row.refresh_generation AND p_presented_hash = session_row.refresh_hash THEN
        IF session_row.previous_refresh_hash IS NOT NULL
           AND now_at < session_row.previous_valid_until THEN
            -- Do not advance the chain twice while prior responses may be in flight.
            outcome := 'current';
        ELSE
            IF p_next_hash=p_presented_hash THEN
                RAISE EXCEPTION 'Rotation must change hash' USING ERRCODE='22023';
            END IF;
            UPDATE public.auth_sessions SET previous_refresh_hash=refresh_hash,
                previous_valid_until=now_at+interval '30 seconds',
                refresh_hash=p_next_hash,refresh_generation=refresh_generation+1,rotated_at=now_at WHERE id=p_session_id;
            outcome := 'rotated';
        END IF;
    ELSIF p_generation+1=session_row.refresh_generation AND p_presented_hash = session_row.previous_refresh_hash
        AND now_at < session_row.previous_valid_until
        AND p_next_hash = session_row.refresh_hash THEN
        -- Backend must derive the SAME successor from the presented secret.
        -- Replay never rotates again; this handles tabs and lost responses.
        outcome := 'previous';
    ELSE
        -- Revoke only on proof of possession of the retained previous secret.
        -- An arbitrary old generation/hash must never become a revocation oracle.
        -- Older-than-retained tokens are rejected, without changing the session.
        -- Backend must ALSO verify its refresh envelope MAC before calling RPC.
        IF p_generation+1=session_row.refresh_generation
           AND p_presented_hash=session_row.previous_refresh_hash THEN
            UPDATE public.auth_sessions SET revoked_at=now_at WHERE id=p_session_id;
            RETURN jsonb_build_object('state','reused');
        END IF;
        RETURN jsonb_build_object('state','invalid');
    END IF;
    UPDATE public.auth_sessions SET last_used_at=now_at,
        idle_expires_at=least(absolute_expires_at,now_at+interval '7 days')
        WHERE id=p_session_id;
    RETURN jsonb_build_object('state',outcome,'session_id',p_session_id,
        'user_id',owner_id,'token_version',session_row.token_version,
        'refresh_generation',session_row.refresh_generation+CASE WHEN outcome='rotated' THEN 1 ELSE 0 END,
        'absolute_expires_at',session_row.absolute_expires_at);
END $$;

CREATE FUNCTION public.samarth_auth_validate_access(
    p_user_id uuid, p_session_id uuid, p_token_version bigint
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = '' SET lock_timeout='3s' AS $$
DECLARE security_row public.auth_user_security; session_row public.auth_sessions;
    now_at timestamptz := clock_timestamp();
BEGIN
    -- Compatible SHARE readers wait for a committed reset/revocation before reading.
    PERFORM 1 FROM public.users WHERE id=p_user_id FOR SHARE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('state','revoked');
    END IF;
    now_at := clock_timestamp();
    SELECT * INTO security_row FROM public.auth_user_security WHERE user_id=p_user_id;
    IF FOUND AND security_row.disabled THEN RETURN jsonb_build_object('state','disabled'); END IF;
    IF p_session_id IS NULL THEN
        -- Backend alone permits already-issued legacy JWTs until their ORIGINAL
        -- 1-hour expiry. A revocation/version bump closes legacy access too.
        IF p_token_version IS NULL AND coalesce(security_row.token_version,0)=0 THEN
            RETURN jsonb_build_object('state','legacy');
        END IF;
        RETURN jsonb_build_object('state','revoked');
    END IF;
    SELECT * INTO session_row FROM public.auth_sessions
        WHERE id=p_session_id AND user_id=p_user_id;
    IF NOT FOUND OR security_row.user_id IS NULL OR p_token_version IS NULL THEN
        RETURN jsonb_build_object('state','revoked');
    END IF;
    IF session_row.revoked_at IS NOT NULL OR session_row.token_version<>p_token_version
       OR security_row.token_version<>p_token_version THEN
        RETURN jsonb_build_object('state','revoked');
    END IF;
    IF session_row.absolute_expires_at<=now_at OR session_row.idle_expires_at<=now_at THEN
        RETURN jsonb_build_object('state','expired');
    END IF;
    RETURN jsonb_build_object('state','active');
END $$;

CREATE FUNCTION public.samarth_auth_revoke_session(p_user_id uuid,p_session_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' SET lock_timeout='3s' AS $$
BEGIN
    PERFORM 1 FROM public.users WHERE id=p_user_id FOR UPDATE;
    IF NOT FOUND THEN RETURN jsonb_build_object('state','revoked'); END IF;
    UPDATE public.auth_sessions SET revoked_at=coalesce(revoked_at,clock_timestamp())
        WHERE id=p_session_id AND user_id=p_user_id;
    RETURN jsonb_build_object('state','revoked');
END $$;

CREATE FUNCTION public.samarth_auth_revoke_user(p_user_id uuid,p_disabled boolean DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path='' SET lock_timeout='3s' AS $$
BEGIN
    PERFORM 1 FROM public.users WHERE id=p_user_id FOR UPDATE;
    IF NOT FOUND THEN RETURN jsonb_build_object('state','revoked'); END IF;
    INSERT INTO public.auth_user_security(user_id,token_version,disabled)
        VALUES(p_user_id,1,coalesce(p_disabled,false))
    ON CONFLICT(user_id) DO UPDATE SET token_version=auth_user_security.token_version+1,
        disabled=coalesce(p_disabled,auth_user_security.disabled),updated_at=clock_timestamp();
    UPDATE public.auth_sessions SET revoked_at=coalesce(revoked_at,clock_timestamp()) WHERE user_id=p_user_id;
    RETURN jsonb_build_object('state','revoked');
END $$;

CREATE FUNCTION public.samarth_auth_reset_password(p_reset_hash text,p_password_hash text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path='' SET lock_timeout='3s' AS $$
DECLARE reset_row record; now_at timestamptz; reset_user_id uuid;
BEGIN
    IF p_reset_hash IS NULL OR p_reset_hash !~ '^[0-9a-f]{64}$'
       OR p_password_hash IS NULL OR length(p_password_hash)<>60
       OR p_password_hash !~ '^\$2[aby]\$[0-9]{2}\$' THEN
        RETURN jsonb_build_object('state','invalid');
    END IF;
    -- Serialize by user BEFORE locking any reset token, avoiding cross-token deadlocks.
    SELECT user_id INTO reset_user_id FROM public.password_reset_tokens WHERE token_hash=p_reset_hash;
    IF NOT FOUND THEN RETURN jsonb_build_object('state','invalid'); END IF;
    PERFORM 1 FROM public.users WHERE id=reset_user_id FOR UPDATE;
    IF NOT FOUND THEN RETURN jsonb_build_object('state','invalid'); END IF;
    SELECT * INTO reset_row FROM public.password_reset_tokens
        WHERE token_hash=p_reset_hash AND user_id=reset_user_id FOR UPDATE;
    IF NOT FOUND THEN RETURN jsonb_build_object('state','invalid'); END IF;
    now_at := clock_timestamp();
    IF reset_row.used_at IS NOT NULL OR reset_row.expires_at IS NULL OR reset_row.expires_at<=now_at THEN
        RETURN jsonb_build_object('state','invalid');
    END IF;
    -- User row already precedes security/session locks, matching create_session.
    UPDATE public.users SET password=p_password_hash WHERE id=reset_row.user_id;
    PERFORM public.samarth_auth_revoke_user(reset_row.user_id,NULL);
    UPDATE public.password_reset_tokens SET used_at=now_at WHERE user_id=reset_row.user_id AND used_at IS NULL;
    RETURN jsonb_build_object('state','reset');
END $$;

-- Browser roles have no table writes or RPC execution. Existing user/admin
-- permissions must still be verified by the backend BEFORE invoking these RPCs.
REVOKE ALL ON FUNCTION public.samarth_auth_create_session(uuid,uuid,text,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.samarth_auth_rotate_session(uuid,text,text,bigint) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.samarth_auth_validate_access(uuid,uuid,bigint) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.samarth_auth_revoke_session(uuid,uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.samarth_auth_revoke_user(uuid,boolean) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.samarth_auth_reset_password(text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.samarth_auth_create_session(uuid,uuid,text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.samarth_auth_rotate_session(uuid,text,text,bigint) TO service_role;
GRANT EXECUTE ON FUNCTION public.samarth_auth_validate_access(uuid,uuid,bigint) TO service_role;
GRANT EXECUTE ON FUNCTION public.samarth_auth_revoke_session(uuid,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.samarth_auth_revoke_user(uuid,boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.samarth_auth_reset_password(text,text) TO service_role;

-- Abort before commit if inherited/default grants weaken the intended boundary.
DO $security_check$
DECLARE obj record; role_name text; privilege_name text; function_count integer := 0;
BEGIN
    FOR obj IN SELECT c.oid,c.relrowsecurity FROM pg_catalog.pg_class c
        JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
        WHERE n.nspname='public' AND c.relname IN ('auth_sessions','auth_user_security')
    LOOP
        IF NOT obj.relrowsecurity THEN RAISE EXCEPTION 'Auth RLS check failed'; END IF;
        FOREACH role_name IN ARRAY ARRAY['anon','authenticated'] LOOP
            FOREACH privilege_name IN ARRAY ARRAY['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'] LOOP
                IF pg_catalog.has_table_privilege(role_name,obj.oid,privilege_name) THEN
                    RAISE EXCEPTION 'Unexpected browser table privilege';
                END IF;
            END LOOP;
        END LOOP;
        IF NOT pg_catalog.has_table_privilege('service_role',obj.oid,'SELECT') THEN
            RAISE EXCEPTION 'Missing service read privilege';
        END IF;
        FOREACH privilege_name IN ARRAY ARRAY['INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'] LOOP
            IF pg_catalog.has_table_privilege('service_role',obj.oid,privilege_name) THEN
                RAISE EXCEPTION 'Unexpected direct service write privilege';
            END IF;
        END LOOP;
    END LOOP;
    FOR obj IN SELECT p.oid,p.prosecdef,p.proconfig,p.proowner FROM pg_catalog.pg_proc p
        JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
        WHERE n.nspname='public' AND p.proname IN (
            'samarth_auth_create_session','samarth_auth_rotate_session',
            'samarth_auth_validate_access','samarth_auth_revoke_session',
            'samarth_auth_revoke_user','samarth_auth_reset_password')
    LOOP
        function_count := function_count+1;
        -- PostgreSQL stores SET search_path='' as search_path="" in proconfig.
        IF NOT obj.prosecdef OR NOT coalesce('search_path=""'=ANY(obj.proconfig),false)
            OR pg_catalog.pg_get_userbyid(obj.proowner)<>current_user THEN
            RAISE EXCEPTION 'Unexpected auth function security configuration';
        END IF;
        IF pg_catalog.has_function_privilege('anon',obj.oid,'EXECUTE')
            OR pg_catalog.has_function_privilege('authenticated',obj.oid,'EXECUTE')
            OR NOT pg_catalog.has_function_privilege('service_role',obj.oid,'EXECUTE') THEN
            RAISE EXCEPTION 'Unexpected auth function permissions';
        END IF;
    END LOOP;
    IF function_count<>6 THEN RAISE EXCEPTION 'Auth function name/signature conflict'; END IF;
END $security_check$;

-- Fail closed on grants to unexpected custom roles as well as browser roles.
DO $acl_check$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_catalog.pg_class c
        JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
        CROSS JOIN LATERAL pg_catalog.aclexplode(c.relacl) a
        WHERE n.nspname='public' AND c.relname IN ('auth_sessions','auth_user_security')
          AND a.grantee NOT IN (c.relowner,(SELECT oid FROM pg_catalog.pg_roles WHERE rolname='service_role'))
    ) OR EXISTS (
        SELECT 1 FROM pg_catalog.pg_proc p
        JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
        CROSS JOIN LATERAL pg_catalog.aclexplode(p.proacl) a
        WHERE n.nspname='public' AND p.proname IN (
            'samarth_auth_create_session','samarth_auth_rotate_session',
            'samarth_auth_validate_access','samarth_auth_revoke_session',
            'samarth_auth_revoke_user','samarth_auth_reset_password')
          AND a.grantee NOT IN (p.proowner,(SELECT oid FROM pg_catalog.pg_roles WHERE rolname='service_role'))
    ) THEN RAISE EXCEPTION 'Unexpected custom role grant on auth objects'; END IF;
END $acl_check$;

COMMIT;

-- Read-only verification. Expected: both RLS=true, both counts=0.
SELECT c.relname AS table_name,c.relrowsecurity AS rls_enabled
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relname IN ('auth_sessions','auth_user_security');
SELECT 'auth_sessions' AS table_name,count(*) AS initial_row_count FROM public.auth_sessions
UNION ALL SELECT 'auth_user_security',count(*) FROM public.auth_user_security;
SELECT role_name,table_name,
    has_table_privilege(role_name,'public.'||table_name,'SELECT') AS can_select,
    has_table_privilege(role_name,'public.'||table_name,'INSERT') AS can_insert,
    has_table_privilege(role_name,'public.'||table_name,'UPDATE') AS can_update,
    has_table_privilege(role_name,'public.'||table_name,'DELETE') AS can_delete
FROM unnest(ARRAY['anon','authenticated','service_role']) AS r(role_name)
CROSS JOIN unnest(ARRAY['auth_sessions','auth_user_security']) AS t(table_name);
SELECT p.proname AS function_name,
    has_function_privilege('anon',p.oid,'EXECUTE') AS anon_execute,
    has_function_privilege('authenticated',p.oid,'EXECUTE') AS authenticated_execute,
    has_function_privilege('service_role',p.oid,'EXECUTE') AS service_role_execute
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.proname IN (
    'samarth_auth_create_session','samarth_auth_rotate_session',
    'samarth_auth_validate_access','samarth_auth_revoke_session',
    'samarth_auth_revoke_user','samarth_auth_reset_password');
