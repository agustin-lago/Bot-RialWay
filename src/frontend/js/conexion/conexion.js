/* global logout */
let currentProjectId = window.railwayProjectId || 'default';
let _conexionIntervals = [];
let _qrSkeletonTimer = null;
let _lastRenderedQrSource = null;
let _qrRequestPendingUntil = 0;

function isQrRequestPending() {
    return _qrRequestPendingUntil > Date.now();
}

function markQrRequestPending() {
    _qrRequestPendingUntil = Date.now() + 120000;
}

function clearQrRequestPending() {
    _qrRequestPendingUntil = 0;
}

function getConexionServiceId() {
    return window.railwayServiceId || undefined;
}

async function runBotCommand(command, chatId) {
    const token = localStorage.getItem('backoffice_token');
    const res = await fetch(`/api/backoffice/bot-command?token=${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            token,
            command,
            chatId,
            projectId: currentProjectId,
            serviceId: getConexionServiceId()
        })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) throw new Error(data.error || 'No se pudo ejecutar el comando');
    return data;
}

function setCommandButtonBusy(button, isBusy, busyText) {
    if (!button) return;
    if (isBusy) {
        button.dataset.originalHtml = button.innerHTML;
        button.disabled = true;
        button.innerHTML = `<i class="fas fa-spinner fa-spin"></i> ${busyText || 'Ejecutando...'}`;
    } else {
        button.disabled = false;
        if (button.dataset.originalHtml) button.innerHTML = button.dataset.originalHtml;
        delete button.dataset.originalHtml;
    }
}


function getQrElements() {
    return {
        section: document.getElementById('qr-section'),
        title: document.getElementById('qr-section-title'),
        skeleton: document.getElementById('qr-skeleton'),
        img: document.getElementById('baileys-qr-img') || document.querySelector('.qr'),
        empty: document.getElementById('qr-empty-message') || document.querySelector('.qr-error-msg'),
        pairing: document.getElementById('pairing-code-container')
    };
}

function setConnectionButtonsBusy(isBusy) {
    const buttons = [document.getElementById('generate-qr-btn'), document.getElementById('generate-pairing-btn')];
    buttons.forEach((button) => {
        if (button) button.disabled = isBusy;
    });
    const loading = document.getElementById('generate-qr-loading');
    if (loading && !isBusy) loading.style.display = 'none';
}

function showQrLoading(titleText) {
    const { section, title, skeleton, img, empty, pairing } = getQrElements();
    if (!section) return;
    section.style.display = 'block';
    if (title) title.textContent = titleText || 'Generando QR';
    if (skeleton) skeleton.style.display = 'grid';
    if (img) img.style.display = 'none';
    if (empty) empty.style.display = 'none';
    if (pairing) pairing.style.display = 'none';
}

function renderQrImage(source, titleText) {
    clearQrRequestPending();
    const qrSource = source || '/qr.png';
    const { section, title, skeleton, img, empty, pairing } = getQrElements();
    if (!section || !img) return;
    section.style.display = 'block';
    if (title) title.textContent = titleText || 'Escanea con WhatsApp';
    if (pairing) pairing.style.display = 'none';

    if (_lastRenderedQrSource === qrSource) {
        if (_qrSkeletonTimer) return;
        if (skeleton) skeleton.style.display = 'none';
        if (empty && empty.style.display !== 'block') img.style.display = 'block';
        return;
    }

    _lastRenderedQrSource = qrSource;
    showQrLoading(titleText || 'Escanea con WhatsApp');
    if (_qrSkeletonTimer) clearTimeout(_qrSkeletonTimer);
    _qrSkeletonTimer = setTimeout(() => {
        if (skeleton) skeleton.style.display = 'none';
        if (empty) empty.style.display = 'none';
        img.src = qrSource;
        img.style.display = 'block';
    }, 2000);
}

function renderPairingCode(code, titleText) {
    const { section, title, skeleton, img, empty, pairing } = getQrElements();
    if (!section || !pairing) return;
    clearQrRequestPending();
    if (_qrSkeletonTimer) clearTimeout(_qrSkeletonTimer);
    _lastRenderedQrSource = null;
    section.style.display = 'block';
    if (title) title.textContent = titleText || 'Codigo de vinculacion';
    if (skeleton) skeleton.style.display = 'none';
    if (img) img.style.display = 'none';
    if (empty) empty.style.display = 'none';
    pairing.style.display = 'block';
    pairing.innerHTML = '<div class="conexion-pairing-code-value"></div><p>Ingresa este codigo en WhatsApp cuando se solicite la vinculacion.</p>';
    const value = pairing.querySelector('.conexion-pairing-code-value');
    if (value) value.textContent = String(code || '');
}

function hideQrPresentation() {
    const { section, skeleton, img, empty, pairing } = getQrElements();
    if (_qrSkeletonTimer) clearTimeout(_qrSkeletonTimer);
    _qrSkeletonTimer = null;
    _lastRenderedQrSource = null;
    if (section) section.style.display = 'none';
    if (skeleton) skeleton.style.display = 'none';
    if (img) img.style.display = 'none';
    if (empty) empty.style.display = 'none';
    if (pairing) pairing.style.display = 'none';
}

async function fetchStatus() {
    const token = localStorage.getItem('backoffice_token');
    try {
        const res = await fetch(`/api/dashboard-status?token=${token}`);
        if (res.status === 401) return logout();
        const data = await res.json();
        console.log('[fetchStatus] status data received:', data);

        if (data) {
            currentProjectId = data.activeProjectId || (data.metaOnboarding && data.metaOnboarding.project_id) || 'default';
        }

        const statusEl       = document.getElementById('session-status');
        const sessionInfo    = document.getElementById('session-info');
        const sessionError   = document.getElementById('session-error');
        const wsLinkContainer = document.getElementById('whatsapp-link-container');
        const groupContainer = document.getElementById('group-connection-container');
        const groupStatusEl  = document.getElementById('group-session-status');
        const startContainer = document.getElementById('baileys-start-container');
        const statusSkeleton = document.getElementById('session-status-skeleton');

        if (!statusEl) return; // view desmontada
        statusEl.style.display = '';
        if (statusSkeleton) statusSkeleton.style.display = 'none';
        sessionInfo.style.display = 'none';
        wsLinkContainer.style.display = 'none';
        sessionError.innerHTML = '';
        sessionInfo.innerHTML = '';

        if (!data || !data.adapter) {
            statusEl.textContent = '❌ Error de sistema';
            return;
        }

        const isMeta = data.adapter.type === 'meta';
        const hasMetaConfig = data.metaOnboarding && data.metaOnboarding.status === 'active';

        if (isMeta) {
            statusEl.textContent = '✅ Principal: META';
            statusEl.style.color = '#0668E1';
            sessionInfo.style.display = 'block';

            let extraInfo = '';
            if (data.metaOnboarding.onboarding_data) {
                const obData = data.metaOnboarding.onboarding_data;

                const phoneDisplay  = obData.display_phone_number || data.metaOnboarding.phone_number_id || 'No configurado';
                const phoneId       = data.metaOnboarding.phone_number_id || data.metaOnboarding.whatsappNumberId || 'No configurado';
                const wabaId        = data.metaOnboarding.waba_id || data.metaOnboarding.whatsappBusinessId || 'No configurado';
                const verifiedName  = obData.verified_name || 'Sin Nombre de Marca';

                const metaStatus = obData.status || 'Desconocido';
                let metaStatusLabel = `<span class="meta-status-badge" style="background:#94a3b8;color:white;padding:2px 8px;border-radius:10px;font-size:.8rem;display:inline-block;">${metaStatus}</span>`;
                if (metaStatus === 'CONNECTED' || metaStatus === 'APPROVED') {
                    metaStatusLabel = `<span class="meta-status-badge" style="background:#10b981;color:white;padding:2px 8px;border-radius:10px;font-size:.8rem;display:inline-block;"><i class="fas fa-circle-check"></i> Conectado</span>`;
                } else if (metaStatus === 'BANNED') {
                    metaStatusLabel = `<span class="meta-status-badge" style="background:#ef4444;color:white;padding:2px 8px;border-radius:10px;font-size:.8rem;display:inline-block;"><i class="fas fa-ban"></i> Baneado / Bloqueado</span>`;
                } else if (metaStatus === 'RESTRICTED' || metaStatus === 'FLAGGED') {
                    metaStatusLabel = `<span class="meta-status-badge" style="background:#f59e0b;color:white;padding:2px 8px;border-radius:10px;font-size:.8rem;display:inline-block;"><i class="fas fa-triangle-exclamation"></i> ${metaStatus === 'RESTRICTED' ? 'Restringido' : 'Advertencia'}</span>`;
                }

                const quality = obData.quality_rating || 'UNKNOWN';
                let qualityLabel = `<span style="font-weight:600;color:#94a3b8;">⚪ Desconocida</span>`;
                if (quality === 'GREEN')  qualityLabel = `<span style="font-weight:600;color:#10b981;">🟢 Alta (Verde)</span>`;
                else if (quality === 'YELLOW') qualityLabel = `<span style="font-weight:600;color:#f59e0b;">🟡 Media (Amarillo)</span>`;
                else if (quality === 'RED')    qualityLabel = `<span style="font-weight:600;color:#ef4444;">🔴 Baja (Rojo)</span>`;

                const isVerified = (obData.is_official_business_account === true) || 
                                   (obData.code_verification_status === 'verified' || obData.code_verification_status === 'VERIFIED') ||
                                   (obData.name_status === 'APPROVED' || obData.name_status === 'VERIFIED');
                const vStatusLabel = isVerified
                    ? '<span style="color:#10b981;font-weight:600;">✅ Verificado</span>'
                    : '<span style="color:#ef4444;font-weight:600;">❌ No Verificado</span>';

                const wabaReview = obData.account_review_status || 'UNKNOWN';
                let wabaReviewLabel = `<span style="font-weight:600;color:#94a3b8;">⏳ Pendiente</span>`;
                if (wabaReview === 'APPROVED') wabaReviewLabel = `<span style="color:#10b981;font-weight:600;">✅ Aprobada</span>`;
                else if (wabaReview === 'REJECTED') wabaReviewLabel = `<span style="color:#ef4444;font-weight:600;">❌ Rechazada</span>`;
                else if (wabaReview === 'NEEDS_COMPLIANCE_REVIEW') wabaReviewLabel = `<span style="color:#f59e0b;font-weight:600;">⚠️ Requiere Revisión</span>`;

                const tier = obData.messaging_limit_tier || obData.messagingLimit || 'Desconocido';
                const tierMap = { TIER_50:'50 conversaciones / 24h', TIER_250:'250 conversaciones / 24h', TIER_1K:'1,000 conversaciones / 24h', TIER_2K:'2,000 conversaciones / 24h', TIER_10K:'10,000 conversaciones / 24h', TIER_100K:'100,000 conversaciones / 24h', TIER_UNLIMITED:'Conversaciones Ilimitadas', UNTIERED:'Sin Límite Definido (Untiered)' };
                const tierHuman = tierMap[tier] || tier;

                extraInfo = `
                    <div class="meta-stats" style="margin-top:15px;padding:15px;background:rgba(6,104,225,0.05);border-radius:12px;border:1px solid rgba(6,104,225,0.15);display:flex;flex-direction:column;gap:10px;text-align:left;font-size:.95rem;">
                        <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid rgba(6,104,225,0.1);padding-bottom:8px;"><strong>Marca / Nombre:</strong><span style="font-weight:600;">${verifiedName}</span></div>
                        <div style="display:flex;justify-content:space-between;align-items:center;"><strong>Número de Teléfono:</strong><span style="font-weight:600;">${phoneDisplay}</span></div>
                        <div style="display:flex;justify-content:space-between;align-items:center;"><strong>ID del Teléfono (Phone ID):</strong><span style="font-family:monospace;font-size:.85rem;color:#64748b;">${phoneId}</span></div>
                        <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid rgba(6,104,225,0.1);padding-bottom:8px;"><strong>ID de WABA:</strong><span style="font-family:monospace;font-size:.85rem;color:#64748b;">${wabaId}</span></div>
                        <div style="display:flex;justify-content:space-between;align-items:center;"><strong>Estado del Canal:</strong>${metaStatusLabel}</div>
                        <div style="display:flex;justify-content:space-between;align-items:center;"><strong>Calificación de Calidad:</strong>${qualityLabel}</div>
                        <div style="display:flex;justify-content:space-between;align-items:center;"><strong>Verificación del Número:</strong>${vStatusLabel}</div>
                        <div style="display:flex;justify-content:space-between;align-items:center;"><strong>Revisión de WABA:</strong>${wabaReviewLabel}</div>
                        <div style="display:flex;justify-content:space-between;align-items:center;border-top:1px solid rgba(6,104,225,0.1);padding-top:8px;"><strong>Límite de Mensajes (Tier):</strong><span class="meta-status-badge" style="background:#0668E1;color:white;padding:3px 10px;border-radius:12px;font-size:.85rem;font-weight:600;display:inline-block;">${tierHuman}</span></div>
                    </div>
                `;
            }
            sessionInfo.innerHTML = `<div><strong>Configuración:</strong> Meta Cloud API Activa</div>${extraInfo}`;
        } else if (hasMetaConfig) {
            statusEl.textContent = '⏳ Principal: META (En curso)';
            statusEl.style.color = '#f59e0b';
            const missing = !data.metaOnboarding.access_token ? 'Token' : (!data.metaOnboarding.phone_number_id || data.metaOnboarding.phone_number_id === 'PENDING' ? 'Phone ID' : 'Desconocido');
            sessionInfo.style.display = 'block';
            sessionInfo.innerHTML = `<div class="warning-box">Vinculación de Meta detectada pero incompleta (Falta: ${missing}). Usando Baileys como respaldo.</div>`;
            renderProviderStatus(data.adapter, 'Baileys (Respaldo)', { preserveQr: Boolean(data.group && !data.group.active) });
        } else {
            renderProviderStatus(data.adapter, 'Principal', { preserveQr: Boolean(data.group && !data.group.active) });
        }

        if (data.group) {
            groupContainer.style.display = 'block';
            if (data.group.active) {
                groupStatusEl.textContent = '✅ Grupos: Baileys';
                groupStatusEl.style.color = '#10b981';
                if (startContainer) startContainer.style.display = 'none';
                hideQrPresentation();
                clearQrRequestPending();
                setConnectionButtonsBusy(false);
            } else if (data.group.qr) {
                groupStatusEl.textContent = '⏳ Grupos: Esperando vinculación';
                groupStatusEl.style.color = '#f59e0b';
                if (startContainer) startContainer.style.display = 'block';
                renderQrImage(data.group.qrImage || '/bot.groups.qr.png', 'Escanea con WhatsApp para grupos');
                setConnectionButtonsBusy(false);
            } else {
                groupStatusEl.textContent = '⏳ Grupos: ' + (data.group.message || 'Cargando...');
                groupStatusEl.style.color = '#94a3b8';
                if (startContainer && !data.group.active) {
                    startContainer.style.display = 'block';
                    const btn = document.getElementById('generate-qr-btn');
                    if (btn) btn.innerHTML = `<i class="fas fa-qrcode"></i> Generar QR Grupos`;
                    if (isQrRequestPending()) {
                        showQrLoading('Generando QR de grupos');
                        setConnectionButtonsBusy(true);
                    } else {
                        setConnectionButtonsBusy(false);
                    }
                }
            }
        } else if (groupContainer) {
            groupContainer.style.display = 'block';
            if (groupStatusEl) {
                groupStatusEl.textContent = 'Grupos: No configurado';
                groupStatusEl.style.color = '#94a3b8';
            }
        }
    } catch (e) {
        console.error(e);
        const el = document.getElementById('session-status');
        const err = document.getElementById('session-error');
        if (el) el.textContent = 'Error';
        if (err) err.innerHTML = `<div class='error-box'>No se pudo obtener el estado del bot.</div>`;
    }
}

function renderProviderStatus(status, label, options = {}) {
    console.log('[renderProviderStatus] status:', status, 'label:', label);
    const statusEl = document.getElementById('session-status');
    const sessionInfo = document.getElementById('session-info');
    const startContainer = document.getElementById('baileys-start-container');
    const preserveQr = options.preserveQr === true;
    if (!statusEl) return;

    if (status.active) {
        statusEl.textContent = label + ': ' + (status.message || 'Conectado');
        statusEl.style.color = '#10b981';
        if (sessionInfo) {
            sessionInfo.style.display = 'block';
            sessionInfo.innerHTML += '<div class="conexion-provider-line"><strong>' + label + ':</strong><span>' + (status.message || 'Operativo') + '</span></div>';
        }
        if (startContainer) startContainer.style.display = 'none';
        clearQrRequestPending();
        if (!preserveQr) hideQrPresentation();
        setConnectionButtonsBusy(false);
    } else if (status.pairingCode) {
        statusEl.textContent = label + ': Esperando vinculacion por codigo';
        statusEl.style.color = '#f59e0b';
        if (startContainer) startContainer.style.display = 'block';
        renderPairingCode(status.pairingCode, 'Codigo de vinculacion para WhatsApp');
        setConnectionButtonsBusy(false);
    } else if (status.qr) {
        statusEl.textContent = label + ': Esperando vinculacion';
        statusEl.style.color = '#f59e0b';
        if (startContainer) startContainer.style.display = 'block';
        renderQrImage(status.qrImage || '/qr.png', 'Escanea con WhatsApp');
        setConnectionButtonsBusy(false);
    } else {
        statusEl.textContent = label + ': ' + (status.message || 'Cargando...');
        if (startContainer && !status.active) {
            startContainer.style.display = 'block';
            const btn = document.getElementById('generate-qr-btn');
            if (btn) btn.innerHTML = '<i class="fas fa-qrcode"></i> Generar QR Baileys';
        }
        if (isQrRequestPending()) {
            if (startContainer) startContainer.style.display = 'block';
            showQrLoading(label.includes('Grupos') ? 'Generando QR de grupos' : 'Generando QR Baileys');
            setConnectionButtonsBusy(true);
        } else {
            if (!preserveQr) hideQrPresentation();
            setConnectionButtonsBusy(false);
        }
    }
}

async function fetchBotStatus() {
    const botToggle = document.getElementById('global-bot-toggle');
    if (!botToggle) return;
    try {
        const token = localStorage.getItem('backoffice_token');
        const serviceParam = window.railwayServiceId ? `&serviceId=${encodeURIComponent(window.railwayServiceId)}` : '';
        const res = await fetch(`/api/backoffice/get-setting?key=GLOBAL_BOT_ENABLED&projectId=${currentProjectId}${serviceParam}&token=${token}`);
        const data = await res.json();
        if (data.success) botToggle.checked = data.value !== 'false';
    } catch (e) { console.error("Error fetching bot status", e); }
}

// Funcion de inicializacion para SPA (se llama en cada visita)
window.initConexionView = function () {
    // Limpiar intervalos anteriores
    _conexionIntervals.forEach(clearInterval);
    _conexionIntervals = [];

    // Carga inicial
    fetchBotStatus();
    fetchStatus();

    // Intervalos de polling
    _conexionIntervals.push(setInterval(fetchStatus,    5000));
    _conexionIntervals.push(setInterval(fetchBotStatus, 30000));

    // --- Toggle Bot Global ---
    const botToggle = document.getElementById('global-bot-toggle');
    if (botToggle) {
        botToggle.addEventListener('change', async () => {
            const enabled = botToggle.checked;
            try {
                const token = localStorage.getItem('backoffice_token');
                const serviceId = window.railwayServiceId || undefined;
                const res = await fetch(`/api/backoffice/save-setting?token=${token}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ key: 'GLOBAL_BOT_ENABLED', value: enabled ? 'true' : 'false', projectId: currentProjectId, serviceId })
                });
                const data = await res.json();
                if (!res.ok || !data.success) throw new Error(data.error || 'Server error');
            } catch (e) {
                window.swalAlert("Error", "Error al cambiar el estado del bot", "error");
                botToggle.checked = !enabled;
            }
        });
    }

    // --- Reload Bot ---
    const reloadBtn = document.getElementById('system-reload-btn');
    if (reloadBtn) {
        reloadBtn.addEventListener('click', async function restartBot() {
            if (!await window.swalConfirm('¿Reiniciar bot?', '¿Seguro que quieres reiniciar el bot? Esto desconectará temporalmente el servicio.')) return;
            reloadBtn.disabled = true;
            reloadBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Reiniciando...';
            try {
                const res = await fetch('/api/backoffice/system/restart', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ token: localStorage.getItem('backoffice_token') })
                });
                if (res.ok) {
                    window.swalAlert("Reinicio solicitado", "La página se recargará en 10 segundos.", "success");
                    setTimeout(() => window.location.reload(), 10000);
                }
            } catch (e) {
                window.swalAlert("Error", "Error al solicitar el reinicio", "error");
                reloadBtn.disabled = false;
                reloadBtn.innerHTML = '<i class="fas fa-sync-alt"></i> Reiniciar';
            }
        });
    }

    const syncCommandBtn = document.getElementById('bot-command-sync');
    if (syncCommandBtn) {
        syncCommandBtn.addEventListener('click', async () => {
            setCommandButtonBusy(syncCommandBtn, true, 'Sincronizando...');
            try {
                const data = await runBotCommand('#ACTUALIZAR#');
                window.swalAlert('Sincronizacion completada', `Sheets, RAG y tools actualizados. Asistentes sincronizados: ${data.assistantsSynced || 0}.`, 'success');
            } catch (err) {
                window.swalAlert('Error', err.message || 'No se pudo ejecutar #ACTUALIZAR#', 'error');
            } finally {
                setCommandButtonBusy(syncCommandBtn, false);
            }
        });
    }

    const commandChatInput = document.getElementById('bot-command-chat-id');
    const resetCommandBtn = document.getElementById('bot-command-reset');
    const newThreadCommandBtn = document.getElementById('bot-command-new-thread');
    const getCommandChatId = () => (commandChatInput?.value || '').trim();

    if (resetCommandBtn) {
        resetCommandBtn.addEventListener('click', async () => {
            const chatId = getCommandChatId();
            if (!chatId) return window.swalAlert('Falta el contacto', 'Ingresa el telefono o chat ID antes de ejecutar #RESET#.', 'warning');
            setCommandButtonBusy(resetCommandBtn, true, 'Reiniciando...');
            try {
                await runBotCommand('#RESET#', chatId);
                window.swalAlert('Asistente reiniciado', 'El chat volvio a asistente1.', 'success');
            } catch (err) {
                window.swalAlert('Error', err.message || 'No se pudo ejecutar #RESET#', 'error');
            } finally {
                setCommandButtonBusy(resetCommandBtn, false);
            }
        });
    }

    if (newThreadCommandBtn) {
        newThreadCommandBtn.addEventListener('click', async () => {
            const chatId = getCommandChatId();
            if (!chatId) return window.swalAlert('Falta el contacto', 'Ingresa el telefono o chat ID antes de ejecutar #HILO_NUEVO#.', 'warning');
            const confirmed = await window.swalConfirm('Borrar historial?', 'Se eliminara todo el historial de mensajes para ese contacto y se iniciara un hilo limpio.');
            if (!confirmed) return;
            setCommandButtonBusy(newThreadCommandBtn, true, 'Borrando...');
            try {
                await runBotCommand('#HILO_NUEVO#', chatId);
                window.swalAlert('Hilo nuevo iniciado', 'El historial fue eliminado y el chat volvio a asistente1.', 'success');
            } catch (err) {
                window.swalAlert('Error', err.message || 'No se pudo ejecutar #HILO_NUEVO#', 'error');
            } finally {
                setCommandButtonBusy(newThreadCommandBtn, false);
            }
        });
    }

    // --- Modal Reiniciar Sesion ---
    const goResetBtn  = document.getElementById('go-reset');
    const resetModal  = document.getElementById('resetModal');
    const confirmSi   = document.getElementById('confirmSi');
    const confirmNo   = document.getElementById('confirmNo');

    if (goResetBtn)  goResetBtn.addEventListener('click', (e) => { e.preventDefault(); resetModal.classList.remove('hidden'); });
    if (confirmNo)   confirmNo.addEventListener('click', () => resetModal.classList.add('hidden'));
    if (confirmSi) {
        confirmSi.addEventListener('click', async () => {
            confirmSi.disabled = true;
            confirmSi.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Reiniciando...';
            try {
                const token = localStorage.getItem('backoffice_token');
                const delRes = await fetch(`/api/delete-session?token=${token}`, { method: 'POST' });
                if (!delRes.ok) throw new Error("Error al borrar la sesión en DB");
                const restRes = await fetch(`/api/restart-bot?token=${token}`, { method: 'POST' });
                if (!restRes.ok) throw new Error("Error al solicitar el reinicio del bot");
                resetModal.innerHTML = `<div class="glass-strong p-8 text-center"><i class="fas fa-check-circle" style="font-size:3rem;color:#25d366;display:block;margin-bottom:20px;"></i><h3 class="text-xl font-heading font-bold mb-3">¡Listo!</h3><p class="text-secondary-content text-sm">El bot se está reiniciando. La página se recargará en 5 segundos.</p></div>`;
                setTimeout(() => window.location.reload(), 5000);
            } catch (err) {
                console.error(err);
                window.swalAlert("Error", "Hubo un error: " + err.message, "error");
                confirmSi.disabled = false;
                confirmSi.innerText = 'SÍ, REINICIAR';
            }
        });
    }

    // --- Modal Desvincular Meta ---
    const goUnlinkBtn     = document.getElementById('go-unlink-meta');
    const unlinkModal     = document.getElementById('unlinkMetaModal');
    const confirmUnlinkSi = document.getElementById('confirmUnlinkSi');
    const confirmUnlinkNo = document.getElementById('confirmUnlinkNo');

    if (goUnlinkBtn)     goUnlinkBtn.addEventListener('click', (e) => { e.preventDefault(); unlinkModal.classList.remove('hidden'); });
    if (confirmUnlinkNo) confirmUnlinkNo.addEventListener('click', () => unlinkModal.classList.add('hidden'));
    if (confirmUnlinkSi) {
        confirmUnlinkSi.addEventListener('click', async () => {
            confirmUnlinkSi.disabled = true;
            confirmUnlinkSi.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Desvinculando...';
            try {
                const token = localStorage.getItem('backoffice_token');
                const res = await fetch(`/api/backoffice/whatsapp/unlink-meta?projectId=${currentProjectId}&token=${token}`, { method: 'POST' });
                if (!res.ok) {
                    const errData = await res.json().catch(() => ({}));
                    throw new Error(errData.error || "Error al desvincular de Meta en el servidor");
                }
                unlinkModal.innerHTML = `<div class="glass-strong p-8 text-center" style="border-top:5px solid #25d366;"><i class="fas fa-check-circle" style="font-size:3rem;color:#25d366;display:block;margin-bottom:20px;"></i><h3 class="text-xl font-heading font-bold mb-3">¡Listo!</h3><p class="text-secondary-content text-sm">La desvinculación se completó. El bot se está reiniciando. La página se recargará en 5 segundos.</p></div>`;
                setTimeout(() => window.location.reload(), 5000);
            } catch (err) {
                console.error(err);
                window.swalAlert("Error", "Hubo un error al desvincular Meta: " + err.message, "error");
                confirmUnlinkSi.disabled = false;
                confirmUnlinkSi.innerText = 'SÍ, DESVINCULAR';
            }
        });
    }

    // --- Generar QR manual ---
    const generateQrBtn = document.getElementById('generate-qr-btn');
    if (generateQrBtn) {
        generateQrBtn.addEventListener('click', async () => {
            const isGroup = document.getElementById('group-connection-container')?.style.display !== 'none' &&
                            generateQrBtn.textContent.includes('Grupos');
            setConnectionButtonsBusy(true);
            markQrRequestPending();
            showQrLoading(isGroup ? 'Generando QR de grupos' : 'Generando QR Baileys');
            const loading = document.getElementById('generate-qr-loading');
            if (loading) loading.style.display = 'block';
            try {
                const token = localStorage.getItem('backoffice_token');
                const res = await fetch(`/api/backoffice/baileys/start?token=${token}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ isGroup })
                });
                if (res.ok) {
                    setTimeout(fetchStatus, 1500);
                } else {
                    const err = await res.json();
                    window.swalAlert('Error', 'Error al iniciar generador de QR: ' + (err.error || 'error desconocido'), 'error');
                    clearQrRequestPending();
                    hideQrPresentation();
                    setConnectionButtonsBusy(false);
                    if (loading) loading.style.display = 'none';
                }
            } catch (e) {
                console.error(e);
                window.swalAlert('Error', 'Error al iniciar generador de QR', 'error');
                clearQrRequestPending();
                hideQrPresentation();
                setConnectionButtonsBusy(false);
                const loading2 = document.getElementById('generate-qr-loading');
                if (loading2) loading2.style.display = 'none';
            }
        });
    }

    // --- Generar Codigo de Vinculacion manual ---
    const generatePairingBtn = document.getElementById('generate-pairing-btn');
    const pairingPhoneInput = document.getElementById('pairing-phone-input');
    if (generatePairingBtn) {
        generatePairingBtn.addEventListener('click', async () => {
            const phoneNumber = pairingPhoneInput.value.trim();
            if (!phoneNumber) {
                window.swalAlert('Atencion', 'Por favor ingresa un numero de telefono valido (con codigo de pais, ej: 5491122334455)', 'warning');
                return;
            }

            const isGroup = document.getElementById('group-connection-container')?.style.display !== 'none' &&
                            generatePairingBtn.textContent.includes('Grupos');

            setConnectionButtonsBusy(true);
            markQrRequestPending();
            showQrLoading('Solicitando codigo de vinculacion');
            const loading = document.getElementById('generate-qr-loading');
            if (loading) {
                loading.style.display = 'block';
                const loadingText = loading.querySelector('p');
                if (loadingText) loadingText.textContent = 'Solicitando codigo de vinculacion... esto tardara unos segundos.';
            }

            try {
                const token = localStorage.getItem('backoffice_token');
                const res = await fetch(`/api/backoffice/baileys/start?token=${token}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ isGroup, usePairingCode: true, phoneNumber })
                });
                if (res.ok) {
                    setTimeout(fetchStatus, 1500);
                } else {
                    const err = await res.json();
                    window.swalAlert('Error', 'Error al iniciar vinculacion: ' + (err.error || 'error desconocido'), 'error');
                    clearQrRequestPending();
                    hideQrPresentation();
                    setConnectionButtonsBusy(false);
                    if (loading) loading.style.display = 'none';
                }
            } catch (e) {
                console.error(e);
                window.swalAlert('Error', 'Error al iniciar vinculacion', 'error');
                clearQrRequestPending();
                hideQrPresentation();
                setConnectionButtonsBusy(false);
                if (loading) loading.style.display = 'none';
            }
        });
    }
};

window.refreshConexionStatus = fetchStatus;

window.destroyConexionView = function () {
    _conexionIntervals.forEach(clearInterval);
    _conexionIntervals = [];
    if (_qrSkeletonTimer) clearTimeout(_qrSkeletonTimer);
    _qrSkeletonTimer = null;
    _lastRenderedQrSource = null;
    clearQrRequestPending();
};
