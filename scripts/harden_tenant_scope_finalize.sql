-- ================================================================
-- DANGER: PRODUCTION MIGRATION FINALIZATION
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
-- Ejecutar este archivo como paso 5.
--
-- Este script NO crea el nuevo indice.
--
-- Primero verifica que el indice nuevo:
--
-- - exista
-- - sea UNIQUE
-- - este READY
-- - este VALID
--
-- Recien despues elimina, si existiera, una UNIQUE CONSTRAINT
-- legacy de external_id.
--
-- El indice standalone idx_messages_external_id se elimina en:
-- scripts/harden_tenant_scope_drop_legacy_index.sql
-- ================================================================


BEGIN;


-- ================================================================
-- 1. FAIL CLOSED SI EL INDICE NUEVO NO ESTA LISTO
-- ================================================================

DO $$
DECLARE
    index_state RECORD;
BEGIN

    SELECT
        i.indisunique,
        i.indisvalid,
        i.indisready

    INTO
        index_state

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


    IF NOT FOUND THEN

        RAISE EXCEPTION
            'uq_messages_scope_external_id does not exist. Aborting finalization.';

    END IF;


    IF NOT index_state.indisunique THEN

        RAISE EXCEPTION
            'uq_messages_scope_external_id is not UNIQUE. Aborting finalization.';

    END IF;


    IF NOT index_state.indisvalid THEN

        RAISE EXCEPTION
            'uq_messages_scope_external_id is INVALID. Aborting finalization.';

    END IF;


    IF NOT index_state.indisready THEN

        RAISE EXCEPTION
            'uq_messages_scope_external_id is not READY. Aborting finalization.';

    END IF;

END;
$$;


-- ================================================================
-- 2. ELIMINAR UNICAMENTE UNIQUE(external_id) LEGACY
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


COMMIT;


-- ================================================================
-- 3. VERIFICACION FINAL DE INDICES external_id
-- ================================================================

SELECT
    c.relname AS index_name,

    i.indisunique,
    i.indisvalid,
    i.indisready,

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

    AND c.relname IN (
        'uq_messages_scope_external_id',
        'idx_messages_external_id'
    )

ORDER BY
    c.relname;


-- Estado final esperado:
-- uq_messages_scope_external_id existe, UNIQUE, VALID y READY.
-- idx_messages_external_id puede aparecer hasta ejecutar el paso 6.
-- Despues del paso 6, idx_messages_external_id no debe devolver filas.


-- ================================================================
-- 4. UNIQUE CONSTRAINTS RESTANTES DE messages
-- ================================================================


SELECT
    c.conname,
    pg_get_constraintdef(
        c.oid
    ) AS definition

FROM
    pg_constraint c

WHERE
    c.conrelid =
        'public.messages'::regclass

    AND
    c.contype = 'u'

ORDER BY
    c.conname;
