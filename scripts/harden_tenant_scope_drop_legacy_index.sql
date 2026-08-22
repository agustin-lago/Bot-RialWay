-- ================================================================
-- DROP LEGACY GLOBAL external_id UNIQUE INDEX
--
-- Ejecutar SOLAMENTE después de:
--
-- 1. harden_tenant_scope_preflight.sql
-- 2. harden_tenant_scope_apply.sql
-- 3. harden_tenant_scope_create_index.sql
-- 4. verificar que uq_messages_scope_external_id esté
--    UNIQUE, VALID y READY.
--
-- Ejecutar fuera de BEGIN / COMMIT.
-- ================================================================

DROP INDEX CONCURRENTLY IF EXISTS
    public.idx_messages_external_id;
