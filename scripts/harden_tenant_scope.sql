-- ================================================================
-- NEUROLINKS MULTI-TENANT HARDENING
--
-- IMPORTANTE:
-- Ejecutar primero las consultas PREFLIGHT.
-- NO ejecutar la sección APPLY si alguna validación devuelve
-- inconsistencias.
-- ================================================================


-- ================================================================
-- 1. PREFLIGHT — OWNER MAP
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

SELECT
    m.project_id,

    m.tenant_id
        AS tenant_actual,

    o.tenant_id
        AS tenant_esperado,

    COUNT(*)
        AS mensajes

FROM
    public.messages m

JOIN
    owner_map o
        ON o.project_id =
           m.project_id

WHERE
    m.tenant_id
        IS DISTINCT FROM
        o.tenant_id

GROUP BY
    m.project_id,
    m.tenant_id,
    o.tenant_id

ORDER BY
    m.project_id,
    m.tenant_id;


-- ESPERADO:
--
-- Sólo deberían aparecer tenant_id NULL históricos.
--
-- SI aparece un tenant_id NO NULL distinto de tenant_esperado:
--
-- DETENERSE.
-- NO EJECUTAR UPDATE.
-- REPORTARLO PARA AUDITORÍA.


-- ================================================================
-- 2. PREFLIGHT — EXTERNAL_ID DUPLICADOS EN EL NUEVO SCOPE
-- ================================================================

SELECT
    tenant_id,
    project_id,

    COALESCE(
        service_id,
        'default_service'
    ) AS service_id,

    chat_id,
    external_id,

    COUNT(*)
        AS cantidad

FROM
    public.messages

WHERE
    external_id
        IS NOT NULL

GROUP BY
    tenant_id,
    project_id,
    COALESCE(
        service_id,
        'default_service'
    ),
    chat_id,
    external_id

HAVING
    COUNT(*) > 1

ORDER BY
    cantidad DESC;


-- ESPERADO:
-- 0 filas.
--
-- SI devuelve filas:
-- NO BORRAR NADA AUTOMÁTICAMENTE.
-- Detener la migración y revisar los duplicados.


-- ================================================================
-- 3. PREFLIGHT — CONSTRAINTS DE messages
-- ================================================================

SELECT
    c.conname,
    c.contype,
    pg_get_constraintdef(
        c.oid
    ) AS definition

FROM
    pg_constraint c

WHERE
    c.conrelid =
        'public.messages'::regclass

ORDER BY
    c.conname;


-- Identificar la constraint actual equivalente a:
--
-- UNIQUE (external_id)


-- ================================================================
-- 4. PREFLIGHT — KNOWLEDGE CHUNKS NULL
-- ================================================================

SELECT
    project_id,
    tenant_id,
    service_id,
    file_id,
    file_name,
    COUNT(*) AS chunks

FROM
    public.knowledge_chunks

WHERE
    tenant_id IS NULL
    OR
    service_id IS NULL

GROUP BY
    project_id,
    tenant_id,
    service_id,
    file_id,
    file_name

ORDER BY
    project_id,
    file_id;


-- ================================================================
-- 5. PREFLIGHT — KNOWLEDGE TENANT INCORRECTO
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


    UNION ALL


    SELECT
        'client_' ||
        c.id::text,

        c.auth_user_id

    FROM
        public.clientes c

    WHERE
        c.auth_user_id
            IS NOT NULL
)

SELECT
    kc.project_id,

    kc.tenant_id
        AS tenant_actual,

    o.tenant_id
        AS tenant_esperado,

    COUNT(*)
        AS chunks

FROM
    public.knowledge_chunks kc

JOIN
    owner_map o
        ON o.project_id =
           kc.project_id

WHERE
    kc.tenant_id
        IS DISTINCT FROM
        o.tenant_id

GROUP BY
    kc.project_id,
    kc.tenant_id,
    o.tenant_id

ORDER BY
    kc.project_id;


-- MISMA REGLA:
--
-- NULL histórico puede backfillearse.
--
-- tenant_id NO NULL pero distinto:
-- DETENERSE Y AUDITAR.


-- ================================================================
-- ================================================================
-- APPLY
--
-- EJECUTAR SÓLO DESPUÉS DE VALIDAR LOS PREFLIGHT.
-- ================================================================
-- ================================================================


BEGIN;


-- ================================================================
-- 6. BACKFILL tenant_id DE messages
--
-- SÓLO rellena NULL.
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


    UNION ALL


    SELECT
        'client_' ||
        c.id::text,

        c.auth_user_id

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
        IS NULL;


-- ================================================================
-- 7. BACKFILL tenant_id DE knowledge_chunks
--
-- SÓLO NULL.
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


    UNION ALL


    SELECT
        'client_' ||
        c.id::text,

        c.auth_user_id

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
        IS NULL;


COMMIT;


-- ================================================================
-- 8. VALIDACIÓN POST BACKFILL
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
)

SELECT
    COUNT(*)
        AS messages_sin_tenant

FROM
    public.messages m

JOIN
    owner_map o
        ON o.project_id =
           m.project_id

WHERE
    m.tenant_id
        IS NULL;


-- DEBE SER 0.


-- ================================================================
-- 9. KNOWLEDGE CHUNKS service_id
-- ================================================================

SELECT
    project_id,
    tenant_id,
    file_id,
    file_name,
    COUNT(*) AS chunks

FROM
    public.knowledge_chunks

WHERE
    service_id
        IS NULL

GROUP BY
    project_id,
    tenant_id,
    file_id,
    file_name;


-- SI devuelve filas:
--
-- NO hacer:
--
-- UPDATE service_id = 'default_service'
--
-- a ciegas.
--
-- Primero reindexar esos documentos utilizando el flujo real:
--
-- updateAllDocs(projectId, serviceId)
--
-- El código nuevo de ragService.ts ya genera:
--
-- tenant_id
-- project_id
-- service_id
-- file_id
--
-- correctamente.


-- ================================================================
-- 10. DETECTAR CHUNKS NULL QUE YA TIENEN REEMPLAZO SCOPED
-- ================================================================

SELECT
    old.project_id,
    old.file_id,
    COUNT(*)
        AS chunks_legacy

FROM
    public.knowledge_chunks old

WHERE
    old.service_id IS NULL

    AND EXISTS (

        SELECT 1

        FROM
            public.knowledge_chunks fresh

        WHERE
            fresh.project_id =
                old.project_id

            AND
            fresh.file_id =
                old.file_id

            AND
            fresh.service_id
                IS NOT NULL

            AND
            fresh.tenant_id
                IS NOT DISTINCT FROM
                old.tenant_id
    )

GROUP BY
    old.project_id,
    old.file_id;


-- Luego de confirmar manualmente que los chunks fresh corresponden
-- al mismo documento, recién entonces se pueden eliminar los legacy.
--
-- NO incluir DELETE automático en este script.


-- ================================================================
-- 11. HARDEN service_id
--
-- EJECUTAR SÓLO CUANDO:
--
-- SELECT COUNT(*)
-- FROM knowledge_chunks
-- WHERE service_id IS NULL;
--
-- DEVUELVA 0.
-- ================================================================


ALTER TABLE
    public.knowledge_chunks

ALTER COLUMN
    service_id

SET DEFAULT
    'default_service';


-- EJECUTAR ESTA SENTENCIA ÚNICAMENTE CUANDO NO QUEDE NINGÚN NULL:

-- ALTER TABLE public.knowledge_chunks
--     ALTER COLUMN service_id
--     SET NOT NULL;


-- ================================================================
-- 12. NUEVA UNIQUE INDEX DE MESSAGES
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
-- 13. ELIMINAR CONSTRAINT GLOBAL external_id
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
-- 14. DB GUARD — TENANT OBLIGATORIO PARA PROYECTOS DE CLIENTE
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
-- 15. DB GUARD — KNOWLEDGE TENANT
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


-- ================================================================
-- FINAL VALIDATION
-- ================================================================

SELECT
    COUNT(*) AS tenant_messages_null

FROM
    public.messages

WHERE
    project_id NOT IN (
        'default_project',
        'defaul',
        'neurolinks-control'
    )

    AND
    tenant_id IS NULL;


SELECT
    COUNT(*) AS tenant_chunks_null

FROM
    public.knowledge_chunks

WHERE
    project_id NOT IN (
        'default_project',
        'defaul',
        'neurolinks-control'
    )

    AND
    tenant_id IS NULL;


SELECT
    COUNT(*) AS chunks_service_null

FROM
    public.knowledge_chunks

WHERE
    service_id IS NULL;


-- OBJETIVO FINAL:
--
-- tenant_messages_null = 0
-- tenant_chunks_null   = 0
-- chunks_service_null  = 0
