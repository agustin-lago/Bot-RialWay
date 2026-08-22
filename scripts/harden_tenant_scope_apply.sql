-- ================================================================
-- DANGER: PRODUCTION MIGRATION
--
-- Ejecutar unicamente despues de validar completamente:
-- scripts/harden_tenant_scope_preflight.sql
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
-- 4. NUEVA UNIQUE INDEX DE MESSAGES
-- ================================================================

CREATE UNIQUE INDEX IF NOT EXISTS
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


-- ================================================================
-- 5. ELIMINAR CONSTRAINT GLOBAL external_id
-- ================================================================

DO $$
DECLARE
    constraint_row RECORD;
BEGIN

    FOR constraint_row IN

        SELECT
            c.conname

        FROM
            pg_constraint c

        WHERE
            c.conrelid =
                'public.messages'::regclass

            AND
            c.contype = 'u'

            AND
            pg_get_constraintdef(
                c.oid
            ) = 'UNIQUE (external_id)'

    LOOP

        EXECUTE format(
            'ALTER TABLE public.messages DROP CONSTRAINT %I',
            constraint_row.conname
        );

    END LOOP;

END;
$$;


-- ================================================================
-- 6. DB GUARD: TENANT OBLIGATORIO PARA PROYECTOS DE CLIENTE
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

    project_id IN (
        'default_project',
        'defaul',
        'neurolinks-control'
    )

    OR

    tenant_id IS NOT NULL
)

NOT VALID;


ALTER TABLE
    public.messages

VALIDATE CONSTRAINT
    messages_tenant_owner_required;


-- ================================================================
-- 7. DB GUARD: KNOWLEDGE TENANT
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

    project_id IN (
        'default_project',
        'defaul',
        'neurolinks-control'
    )

    OR

    tenant_id IS NOT NULL
)

NOT VALID;


ALTER TABLE
    public.knowledge_chunks

VALIDATE CONSTRAINT
    knowledge_chunks_tenant_owner_required;


COMMIT;
