-- Migración legacy para agregar bot_name.
-- La persistencia de sesiones se realiza directamente desde los módulos
-- tenant-aware del backend.

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'whatsapp_sessions'
          AND column_name = 'bot_name'
    ) THEN
        ALTER TABLE public.whatsapp_sessions
            ADD COLUMN bot_name TEXT DEFAULT NULL;
    END IF;
END $$;
