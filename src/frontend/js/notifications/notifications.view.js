/* global showToast, navigate, updateNotificationDots */
/* eslint-disable no-undef */
window.notificationsView = (() => {
    let _token = '';
    let _notifications = [];
    let _unreadCount = 0;

    // ── HTML ──────────────────────────────────────────────────────────────
    function getHTML() {
        return `
        <main class="crm-main-container" style="z-index:10; padding:0; display:flex; flex-direction:column; height:100%;">
            <div class="kanban-header animate-fade" style="flex-shrink:0;">
                <div class="header-info">
                    <h1>
                        <i class="fas fa-bell kanban-header-icon" style="color:#ef4444;"></i>
                        Notificaciones de Error (Meta API)
                    </h1>
                    <p>Alertas y novedades operativas de la integración con WhatsApp</p>
                </div>
                <div id="notif-header-actions" style="display:flex; gap:10px; align-items:center;">
                    <button onclick="notificationsView._markAllAsRead()" id="btn-mark-all-read" 
                        class="filter-pill active" 
                        style="display:none; cursor:pointer; font-weight:600; padding:8px 16px; border-radius:10px;">
                        <i class="fas fa-check-double" style="margin-right:6px;"></i> Marcar todas como leídas
                    </button>
                </div>
            </div>

            <div class="meta-view-body" style="flex:1; overflow-y:auto; padding:20px;">
                <div id="notif-container" style="max-width:800px; width:100%; margin:0 auto;">
                    
                    <!-- Loading state -->
                    <div id="notif-loading" style="padding:48px; text-align:center; color:var(--text-muted);">
                        <i class="fas fa-circle-notch fa-spin" style="font-size:2rem; margin-bottom:12px; color:var(--accent);"></i>
                        <p>Cargando notificaciones...</p>
                    </div>

                    <!-- Empty state -->
                    <div id="notif-empty" style="display:none; padding:64px 24px; text-align:center; border-radius:1rem; background:var(--card-bg); border:1px solid var(--card-border-color);">
                        <div style="width:64px; height:64px; border-radius:50%; background:rgba(34,197,94,0.1); border:1px solid rgba(34,197,94,0.2); display:inline-flex; align-items:center; justify-content:center; margin-bottom:16px;">
                            <i class="fas fa-circle-check" style="font-size:1.8rem; color:#22c55e;"></i>
                        </div>
                        <h2 style="margin:0 0 6px; font-size:1.25rem; font-weight:700; color:var(--text-main);">¡Todo en orden!</h2>
                        <p style="color:var(--text-muted); margin:0; font-size:0.88rem; max-width:320px; margin-inline:auto;">
                            No hay errores de envío registrados en la plataforma. Todo está funcionando correctamente.
                        </p>
                    </div>

                    <!-- List Container -->
                    <div id="notif-list-wrapper" style="display:none; display:flex; flex-direction:column; gap:12px;">
                        <!-- Cards injected here -->
                    </div>

                </div>
            </div>
        </main>
        `;
    }

    // ── INIT ──────────────────────────────────────────────────────────────
    async function init() {
        _token = localStorage.getItem('backoffice_token') || '';
        await _loadNotifications();
    }

    async function _loadNotifications() {
        const loadingEl = document.getElementById('notif-loading');
        const emptyEl = document.getElementById('notif-empty');
        const listWrapper = document.getElementById('notif-list-wrapper');
        const btnMarkAll = document.getElementById('btn-mark-all-read');

        try {
            const res = await fetch(`/api/backoffice/notifications?token=${_token}&limit=50&offset=0`);
            const data = await res.json();
            if (!data || !data.success) throw new Error(data.error || 'Fallo de API');

            _notifications = data.data || [];
            _unreadCount = data.unread_count || 0;

            if (loadingEl) loadingEl.style.display = 'none';

            if (_notifications.length === 0) {
                if (emptyEl) emptyEl.style.display = 'block';
                if (listWrapper) listWrapper.style.display = 'none';
                if (btnMarkAll) btnMarkAll.style.display = 'none';
                return;
            }

            if (emptyEl) emptyEl.style.display = 'none';
            if (listWrapper) listWrapper.style.display = 'flex';

            // Mostrar el botón de marcar todas como leídas si hay alguna no leída
            const hasUnread = _notifications.some(n => !n.read);
            if (btnMarkAll) {
                btnMarkAll.style.display = hasUnread ? 'inline-block' : 'none';
            }

            _renderNotificationsList();

            // Auto-marcar como leídas las que están actualmente visibles
            if (hasUnread) {
                await _autoMarkAsRead();
            }

        } catch (err) {
            console.error('[NotificationsView] Error cargando notificaciones:', err);
            if (loadingEl) {
                loadingEl.innerHTML = `
                    <i class="fas fa-exclamation-triangle" style="font-size:2rem; color:#ef4444; margin-bottom:12px;"></i>
                    <p style="color:#ef4444;">Error de red al cargar notificaciones.</p>
                `;
            }
        }
    }

    function _renderNotificationsList() {
        const wrapper = document.getElementById('notif-list-wrapper');
        if (!wrapper) return;

        wrapper.innerHTML = _notifications.map(notif => {
            const dateStr = new Date(notif.created_at).toLocaleString('es-AR', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });

            const isUnread = !notif.read;
            const isBulk = notif.metadata?.is_bulk === true;
            const errCode = notif.metadata?.error_code || 'WABA';
            
            // Icon overlay style
            const indicatorBorder = isUnread ? 'border-left: 4px solid #ef4444;' : 'border-left: 4px solid transparent;';
            const cardBg = isUnread ? 'background: var(--card-bg); font-weight: 500;' : 'background: var(--card-bg); opacity: 0.85;';
            
            const badgeTypeHtml = isBulk 
                ? `<span style="font-size:0.65rem; background:rgba(239,68,68,0.1); color:#ef4444; border:1px solid rgba(239,68,68,0.2); padding:2px 8px; border-radius:6px; font-weight:bold; text-transform:uppercase;">Envío Masivo</span>`
                : `<span style="font-size:0.65rem; background:rgba(0,153,255,0.1); color:#0099FF; border:1px solid rgba(0,153,255,0.2); padding:2px 8px; border-radius:6px; font-weight:bold; text-transform:uppercase;">Chat Individual</span>`;

            return `
            <div class="animate-fade" style="${cardBg} ${indicatorBorder} border-radius:12px; border-top:1px solid var(--card-border-color); border-right:1px solid var(--card-border-color); border-bottom:1px solid var(--card-border-color); padding:16px; display:flex; gap:16px; align-items:flex-start; transition:all 0.2s; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
                <!-- Icono de Estado -->
                <div style="width:40px; height:40px; border-radius:10px; background:rgba(239,68,68,0.1); display:flex; align-items:center; justify-content:center; flex-shrink:0; color:#ef4444;">
                    <i class="fas fa-triangle-exclamation" style="font-size:1.15rem;"></i>
                </div>

                <!-- Detalle -->
                <div style="flex:1; min-width:0; display:flex; flex-direction:column; gap:4px;">
                    <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
                        <h3 style="margin:0; font-size:0.95rem; font-weight:700; color:var(--text-main);">${_escHtml(notif.title)}</h3>
                        <span style="font-size:0.75rem; color:var(--text-muted);">${dateStr}</span>
                    </div>
                    <p style="margin:4px 0 8px; font-size:0.85rem; color:var(--text-muted); line-height:1.5;">${_escHtml(notif.description)}</p>
                    <div style="display:flex; gap:8px; align-items:center;">
                        ${badgeTypeHtml}
                        <span style="font-size:0.65rem; background:var(--bg-secondary); border:1px solid var(--border-color); color:var(--text-muted); padding:2px 8px; border-radius:6px; font-weight:bold;">CÓDIGO ${errCode}</span>
                    </div>
                </div>

                <!-- Acción individual para marcar lectura -->
                ${isUnread ? `
                    <button onclick="notificationsView._markSingleAsRead('${notif.id}')" 
                        class="btn-icon-wa" 
                        title="Marcar como leída" 
                        style="color:#22c55e; background:rgba(34,197,94,0.1); border-radius:8px;">
                        <i class="fas fa-check"></i>
                    </button>
                ` : ''}
            </div>
            `;
        }).join('');
    }

    async function _autoMarkAsRead() {
        const unreadIds = _notifications.filter(n => !n.read).map(n => n.id);
        if (unreadIds.length === 0) return;

        try {
            await fetch(`/api/backoffice/notifications/read?token=${_token}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids: unreadIds })
            });

            // Actualizar estado local
            _notifications.forEach(n => {
                if (unreadIds.includes(n.id)) n.read = true;
            });

            // Actualizar menú y contadores
            if (typeof updateNotificationDots === 'function') {
                updateNotificationDots();
            }

            // Ocultar botón marcar todas
            const btnMarkAll = document.getElementById('btn-mark-all-read');
            if (btnMarkAll) btnMarkAll.style.display = 'none';

        } catch (e) {
            console.error('[NotificationsView] Falló marcar auto-leídas:', e);
        }
    }

    async function _markSingleAsRead(id) {
        try {
            await fetch(`/api/backoffice/notifications/read?token=${_token}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids: [id] })
            });

            // Refrescar lista
            await _loadNotifications();
            showToast && showToast('Notificación marcada como leída', 'success');
        } catch (e) {
            showToast && showToast('Error al actualizar notificación', 'error');
        }
    }

    async function _markAllAsRead() {
        const unreadIds = _notifications.filter(n => !n.read).map(n => n.id);
        if (unreadIds.length === 0) return;

        try {
            const res = await fetch(`/api/backoffice/notifications/read?token=${_token}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids: unreadIds })
            });
            const data = await res.json();
            if (data.success) {
                showToast && showToast('Todas las notificaciones marcadas como leídas', 'success');
                await _loadNotifications();
            }
        } catch (e) {
            showToast && showToast('Error al marcar notificaciones', 'error');
        }
    }

    function _escHtml(str) {
        return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }

    function destroy() {
        // cleanup
    }

    return {
        title: 'Notificaciones - Backoffice',
        getHTML,
        init,
        destroy,
        _markSingleAsRead,
        _markAllAsRead
    };
})();
