-- ================================================================
-- NEUROLINKS MULTI-TENANT HARDENING PREFLIGHT
--
-- READ ONLY.
-- Ejecutar y revisar todos los resultados antes de usar:
-- scripts/harden_tenant_scope_apply.sql
-- ================================================================


-- ================================================================
-- 1. OWNER MAP / TENANTS INCORRECTOS DE messages
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


-- Esperado:
-- Solo tenant_id NULL historicos.
-- Si aparece tenant_id NO NULL distinto de tenant_esperado, no usar APPLY.


-- ================================================================
-- 2. EXTERNAL_ID DUPLICADOS EN EL NUEVO SCOPE
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


-- Esperado: 0 filas.


-- ================================================================
-- 3. CONSTRAINTS ACTUALES DE messages
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


-- Identificar la constraint actual equivalente a UNIQUE (external_id).


-- ================================================================
-- 4. knowledge_chunks CON tenant/service NULL
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
-- 5. knowledge_chunks CON TENANT INCORRECTO
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


-- Esperado:
-- Solo tenant_id NULL historicos.
-- Si aparece tenant_id NO NULL distinto de tenant_esperado, no usar APPLY.


-- ================================================================
-- 6. SCOPES GLOBALES CON TENANT EN messages
-- ================================================================

SELECT
    project_id,
    tenant_id,
    COUNT(*) AS registros

FROM
    public.messages

WHERE
    project_id IN (
        'default_project',
        'defaul',
        'neurolinks-control'
    )

    AND tenant_id IS NOT NULL

GROUP BY
    project_id,
    tenant_id

ORDER BY
    project_id;


-- Esperado: 0 filas.


-- ================================================================
-- 7. SCOPES GLOBALES CON TENANT EN knowledge_chunks
-- ================================================================

SELECT
    project_id,
    tenant_id,
    COUNT(*) AS chunks

FROM
    public.knowledge_chunks

WHERE
    project_id IN (
        'default_project',
        'defaul',
        'neurolinks-control'
    )

    AND tenant_id IS NOT NULL

GROUP BY
    project_id,
    tenant_id

ORDER BY
    project_id;


-- Esperado: 0 filas.


-- ================================================================
-- 8. TENANT-OWNED messages SIN TENANT
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


-- ================================================================
-- 9. knowledge_chunks CON service_id NULL
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
    file_name

ORDER BY
    project_id,
    file_id;


-- Si devuelve filas, reindexar con el service correcto antes de harden final.


-- ================================================================
-- 10. CHUNKS NULL QUE YA TIENEN REEMPLAZO SCOPED
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

-- ================================================================
-- 11. ESTADO DEL NUEVO INDICE SCOPED DE messages
-- ================================================================

SELECT
    c.relname AS index_name,

    i.indisunique AS is_unique,
    i.indisvalid AS is_valid,
    i.indisready AS is_ready,

    pg_get_indexdef(
        i.indexrelid
    ) AS definition

FROM
    pg_index i

JOIN
    pg_class c
        ON c.oid =
           i.indexrelid

JOIN
    pg_namespace n
        ON n.oid =
           c.relnamespace

WHERE
    n.nspname = 'public'

    AND c.relname =
        'uq_messages_scope_external_id';


-- RESULTADOS POSIBLES:
--
-- 0 filas:
--     indice todavia no existe.
--     Es el estado esperado antes de CREATE INDEX.
--
-- is_valid = true
-- is_ready = true
-- is_unique = true:
--     indice ya existe correctamente.
--
-- is_valid = false
-- o
-- is_ready = false:
--     DETENER MIGRACION.
--     Existe un indice incompleto/invalido.
--     NO ejecutar FINALIZE.
