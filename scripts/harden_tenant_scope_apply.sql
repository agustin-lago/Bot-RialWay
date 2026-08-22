-- ================================================================
-- DANGER: PRODUCTION MIGRATION
--
-- Ejecutar unicamente despues de validar completamente:
-- scripts/harden_tenant_scope_preflight.sql
--
-- Orden de ejecucion:
-- 1. harden_tenant_scope_preflight.sql
-- 2. harden_tenant_scope_apply.sql
-- 3. harden_tenant_scope_create_index.sql
-- 4. harden_tenant_scope_preflight.sql
-- 5. harden_tenant_scope_finalize.sql
-- 6. harden_tenant_scope_drop_legacy_index.sql
-- 7. verificacion final
--
-- NO ejecutar automaticamente durante deploy/startup.
-- ================================================================


BEGIN;


-- ================================================================
-- 1. BACKFILL tenant_id DE messages
--
-- SOLO rellena NULL.
-- NUNCA cambia otro tenant existente.
-- ================================================================

WITH owner_map AS (

    SELECT
        pr.railway_project_id::text
            AS project_id,

        c.auth_user_id
            AS tenant_id

    FROM
        public.proyectos_railway pr

    JOIN
        public.clientes c
            ON c.id =
               pr.cliente_id

    WHERE
        c.auth_user_id
            IS NOT NULL

        AND pr.railway_project_id::text NOT IN (
            'default_project',
            'defaul',
            'neurolinks-control'
        )


    UNION ALL


    SELECT
        'client_' ||
        c.id::text
            AS project_id,

        c.auth_user_id
            AS tenant_id

    FROM
        public.clientes c

    WHERE
        c.auth_user_id
            IS NOT NULL
)

UPDATE
    public.messages m

SET
    tenant_id =
        o.tenant_id

FROM
    owner_map o

WHERE
    m.project_id =
        o.project_id

    AND
    m.tenant_id
        IS NULL

    AND
    m.project_id NOT IN (
        'default_project',
        'defaul',
        'neurolinks-control'
    );


-- ================================================================
-- 2. BACKFILL tenant_id DE knowledge_chunks
--
-- SOLO NULL.
-- ================================================================

WITH owner_map AS (

    SELECT
        pr.railway_project_id::text
            AS project_id,

        c.auth_user_id
            AS tenant_id

    FROM
        public.proyectos_railway pr

    JOIN
        public.clientes c
            ON c.id =
               pr.cliente_id

    WHERE
        c.auth_user_id
            IS NOT NULL

        AND pr.railway_project_id::text NOT IN (
            'default_project',
            'defaul',
            'neurolinks-control'
        )


    UNION ALL


    SELECT
        'client_' ||
        c.id::text
            AS project_id,

        c.auth_user_id
            AS tenant_id

    FROM
        public.clientes c

    WHERE
        c.auth_user_id
            IS NOT NULL
)

UPDATE
    public.knowledge_chunks kc

SET
    tenant_id =
        o.tenant_id

FROM
    owner_map o

WHERE
    kc.project_id =
        o.project_id

    AND
    kc.tenant_id
        IS NULL

    AND
    kc.project_id NOT IN (
        'default_project',
        'defaul',
        'neurolinks-control'
    );


-- ================================================================
-- 3. HARDEN knowledge_chunks.service_id DEFAULT
-- ================================================================

ALTER TABLE
    public.knowledge_chunks

ALTER COLUMN
    service_id

SET DEFAULT
    'default_service';


-- EJECUTAR ESTA SENTENCIA UNICAMENTE CUANDO NO QUEDE NINGUN NULL:

-- ALTER TABLE public.knowledge_chunks
--     ALTER COLUMN service_id
--     SET NOT NULL;


-- ================================================================
-- 4. DB GUARD: TENANT OBLIGATORIO PARA PROYECTOS DE CLIENTE
-- ================================================================

ALTER TABLE
    public.messages

DROP CONSTRAINT IF EXISTS
    messages_tenant_owner_required;


ALTER TABLE
    public.messages

ADD CONSTRAINT
    messages_tenant_owner_required

CHECK (

    project_id IS NULL

    OR

    (
        project_id IN (
            'default_project',
            'defaul',
            'neurolinks-control'
        )

        AND

        tenant_id IS NULL
    )

    OR

    (
        project_id NOT IN (
            'default_project',
            'defaul',
            'neurolinks-control'
        )

        AND

        tenant_id IS NOT NULL
    )
)

NOT VALID;


ALTER TABLE
    public.messages

VALIDATE CONSTRAINT
    messages_tenant_owner_required;


-- ================================================================
-- 5. DB GUARD: KNOWLEDGE TENANT
-- ================================================================

ALTER TABLE
    public.knowledge_chunks

DROP CONSTRAINT IF EXISTS
    knowledge_chunks_tenant_owner_required;


ALTER TABLE
    public.knowledge_chunks

ADD CONSTRAINT
    knowledge_chunks_tenant_owner_required

CHECK (

    project_id IS NULL

    OR

    (
        project_id IN (
            'default_project',
            'defaul',
            'neurolinks-control'
        )

        AND

        tenant_id IS NULL
    )

    OR

    (
        project_id NOT IN (
            'default_project',
            'defaul',
            'neurolinks-control'
        )

        AND

        tenant_id IS NOT NULL
    )
)

NOT VALID;


ALTER TABLE
    public.knowledge_chunks

VALIDATE CONSTRAINT
    knowledge_chunks_tenant_owner_required;


COMMIT;
