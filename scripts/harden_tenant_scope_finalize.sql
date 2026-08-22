-- ================================================================
-- DANGER: PRODUCTION MIGRATION FINALIZATION
--
-- Ejecutar SOLAMENTE despues de:
--
-- 1. harden_tenant_scope_preflight.sql
-- 2. harden_tenant_scope_apply.sql
-- 3. harden_tenant_scope_create_index.sql
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
-- Recien despues elimina el UNIQUE global legacy de external_id.
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
-- 3. VERIFICACION FINAL
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
