-- Tabla de sesiones WhatsApp tenant-ready
CREATE TABLE IF NOT EXISTS public.whatsapp_sessions (
    tenant_id UUID NOT NULL,
    project_id TEXT NOT NULL,
    service_id TEXT,
    session_id TEXT NOT NULL DEFAULT 'default',
    key_id TEXT NOT NULL,
    data JSONB NOT NULL,
    bot_name TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    PRIMARY KEY (project_id, session_id, key_id),

    CONSTRAINT whatsapp_sessions_tenant_id_fkey
        FOREIGN KEY (tenant_id)
        REFERENCES public.clientes(auth_user_id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_sessions_project
    ON public.whatsapp_sessions(project_id, session_id);

CREATE INDEX IF NOT EXISTS idx_whatsapp_sessions_tenant_id
    ON public.whatsapp_sessions(tenant_id);


-- Mantener RPC genérico existente utilizado por tareas de mantenimiento.
CREATE OR REPLACE FUNCTION exec_sql(query text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    EXECUTE query;
END;
$$;


CREATE OR REPLACE FUNCTION exec_sql_read(query text)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result JSONB;
BEGIN
    EXECUTE 'SELECT json_agg(t) FROM (' || query || ') t'
    INTO result;

    IF result IS NULL THEN
        RETURN '[]'::jsonb;
    END IF;

    RETURN result;
END;
$$;
