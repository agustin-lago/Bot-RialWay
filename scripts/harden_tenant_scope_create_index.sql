-- ================================================================
-- NEUROLINKS MULTI-TENANT HARDENING
-- CREATE MESSAGE UNIQUE INDEX
--
-- IMPORTANTE:
--
-- Ejecutar SOLAMENTE despues de:
--
-- 1. harden_tenant_scope_preflight.sql
-- 2. harden_tenant_scope_apply.sql
--
-- ESTA SENTENCIA DEBE EJECUTARSE FUERA DE BEGIN / COMMIT.
--
-- CREATE INDEX CONCURRENTLY no puede ejecutarse dentro de una
-- transaction block.
--
-- Ejecutar esta sentencia como operacion independiente.
-- ================================================================


CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS
    uq_messages_scope_external_id

ON public.messages (

    COALESCE(
        tenant_id::text,
        '__global__'
    ),

    project_id,

    COALESCE(
        service_id,
        'default_service'
    ),

    chat_id,

    external_id
)

WHERE
    external_id IS NOT NULL;
