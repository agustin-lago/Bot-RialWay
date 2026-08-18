import { HistoryHandler, supabase } from "../db/historyHandler";

/**
 * Inicia un worker que verifica cada minuto los chats con intervención humana (bot desactivado).
 * Si no han recibido un mensaje humano en 15 minutos, reactiva el bot automáticamente.
 * Excluye contactos en lista negra (sin_bot o bloqueado_crm) que deben permanecer en atención humana.
 */
export const startHumanInactivityWorker = (timeoutMinutes = 15) => {
    console.log(`🤖 [Worker] Iniciando worker de inactividad humana multitenant (${timeoutMinutes} min)...`);

    setInterval(async () => {
        try {
            if (!supabase) return;
            const now = new Date();
            const threshold = new Date(now.getTime() - timeoutMinutes * 60 * 1000);
            const minThreshold = new Date(now.getTime() - 24 * 60 * 60 * 1000); // Ventana de 24 horas para omitir chats inactivos antiguos
            
            // 1. Obtener chats con bot desactivado y actividad humana reciente (entre 24 horas y 15 minutos atrás)
            const { data: inactiveChats, error } = await supabase
                .from('chats')
                .select('id, project_id, service_id, last_human_message_at')
                .eq('bot_enabled', false)
                .not('last_human_message_at', 'is', null)
                .gte('last_human_message_at', minThreshold.toISOString())
                .lte('last_human_message_at', threshold.toISOString());

            if (error) throw error;
            if (!inactiveChats || inactiveChats.length === 0) return;

            // 2. Obtener lista negra en un solo lote (batch query) para evitar consultas en bucle
            const chatIds = inactiveChats.map(c => c.id);
            const { data: blacklistEntries, error: blError } = await supabase
                .from('blacklist')
                .select('chat_id, project_id, service_id')
                .in('chat_id', chatIds)
                .or('sin_bot.eq.true,bloqueado_crm.eq.true');

            if (blError) {
                console.error('[WORKER] Error consultando blacklist en lote:', blError);
            }

            const blockedKeys = new Set(
                (blacklistEntries || []).map(entry => {
                    const sId = entry.service_id || 'default';
                    return `${entry.project_id}:${sId}:${entry.chat_id}`;
                })
            );

            // Caché en memoria durante este tick para no consultar la misma configuración del mismo proyecto/servicio varias veces
            const globalBotSettingsCache = new Map<string, boolean>();

            for (const chat of inactiveChats) {
                const projectId = chat.project_id;
                const serviceId = chat.service_id || 'default';
                const settingKey = `${projectId}:${serviceId}`;

                // 3. Obtener estado del bot global usando caché en memoria
                let isGlobalBotEnabled = globalBotSettingsCache.get(settingKey);
                if (isGlobalBotEnabled === undefined) {
                    const settingValue = await HistoryHandler.getSetting('GLOBAL_BOT_ENABLED', projectId, chat.service_id);
                    isGlobalBotEnabled = settingValue !== 'false';
                    globalBotSettingsCache.set(settingKey, isGlobalBotEnabled);
                }

                if (!isGlobalBotEnabled) {
                    continue; // Saltar si el bot está desactivado globalmente para este inquilino/servicio
                }

                // 4. Filtrar lista negra usando el Set en memoria
                const lookupKey = `${projectId}:${serviceId}:${chat.id}`;
                if (blockedKeys.has(lookupKey)) {
                    continue; // Saltar si está en lista negra
                }

                console.log(`[WORKER] [${new Date().toLocaleTimeString()}] Auto-activando bot para chat ${chat.id} en proyecto ${projectId} (Inactividad > ${timeoutMinutes} min)`);
                await HistoryHandler.toggleBot(chat.id, true, projectId, chat.service_id);
            }
        } catch (e) {
            console.error('[WORKER] Error en check de inactividad humana:', e);
        }
    }, 60 * 1000); // Verificar cada minuto para alta precisión
};
