-- ============================================================
-- Neurolinks RAG
-- Scope:
-- tenant_id + project_id + service_id
-- ============================================================

CREATE EXTENSION IF NOT EXISTS vector;


CREATE TABLE IF NOT EXISTS public.knowledge_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    tenant_id UUID,

    project_id TEXT NOT NULL,

    service_id TEXT NOT NULL
        DEFAULT 'default_service',

    file_id TEXT,

    file_name TEXT,

    content TEXT NOT NULL,

    chunk_index INT DEFAULT 0,

    metadata JSONB DEFAULT '{}'::jsonb,

    embedding vector(1536),

    created_at TIMESTAMPTZ DEFAULT NOW()
);


-- Compatibilidad con instalaciones existentes.
-- CREATE TABLE IF NOT EXISTS no agrega columnas faltantes.

ALTER TABLE public.knowledge_chunks
    ADD COLUMN IF NOT EXISTS tenant_id UUID;


ALTER TABLE public.knowledge_chunks
    ADD COLUMN IF NOT EXISTS service_id TEXT;


CREATE INDEX IF NOT EXISTS
    idx_knowledge_chunks_project_id
ON public.knowledge_chunks (
    project_id
);


CREATE INDEX IF NOT EXISTS
    idx_knowledge_chunks_tenant_project_service
ON public.knowledge_chunks (
    tenant_id,
    project_id,
    service_id
);


CREATE INDEX IF NOT EXISTS
    idx_knowledge_chunks_scope_file
ON public.knowledge_chunks (
    tenant_id,
    project_id,
    service_id,
    file_id
);


-- Nueva versión multi-tenant.
--
-- Al agregar parámetros tenant/service se crea una firma nueva.
-- Esto permite migrar sin romper temporalmente clientes que todavía
-- estén usando la RPC legacy.

CREATE OR REPLACE FUNCTION
public.match_knowledge_chunks(
    p_tenant_id UUID,
    p_project_id TEXT,
    p_service_id TEXT,
    query_embedding vector(1536),
    match_threshold FLOAT DEFAULT 0.2,
    match_count INT DEFAULT 5
)
RETURNS TABLE (
    id UUID,
    content TEXT,
    file_name TEXT,
    similarity FLOAT
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN

    RETURN QUERY

    SELECT
        kc.id,
        kc.content,
        kc.file_name,

        (
            1 -
            (
                kc.embedding <=>
                query_embedding
            )
        )::FLOAT
            AS similarity

    FROM
        public.knowledge_chunks kc

    WHERE
        kc.project_id =
            p_project_id

        AND
        kc.tenant_id
            IS NOT DISTINCT FROM
            p_tenant_id

        AND
        kc.service_id
            IS NOT DISTINCT FROM
            p_service_id

        AND
        (
            1 -
            (
                kc.embedding <=>
                query_embedding
            )
        ) >
            match_threshold

    ORDER BY
        kc.embedding <=>
        query_embedding

    LIMIT
        match_count;

END;
$$;
