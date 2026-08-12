/* global showToast, updateNotificationDots */
/* eslint-disable no-undef */

window.openNotificationsModal = async function() {
    // 1. Ensure modal markup exists in document body
    let overlay = document.getElementById('notif-modal-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'notif-modal-overlay';
        overlay.style = `
            position: fixed;
            top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(15, 23, 42, 0.45);
            backdrop-filter: blur(8px);
            -webkit-backdrop-filter: blur(8px);
            z-index: 99999;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
            animation: notif-fade-in 0.2s ease-out;
        `;
        overlay.innerHTML = `
            <style>
                @keyframes notif-fade-in {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes notif-pop-in {
                    from { transform: scale(0.95); opacity: 0; }
                    to { transform: scale(1); opacity: 1; }
                }
                .notif-modal-content {
                    background: var(--card-bg, #ffffff);
                    border: 1px solid var(--card-border-color, rgba(0,0,0,0.1));
                    width: 100%;
                    max-width: 650px;
                    max-height: clamp(400px, 80vh, 700px);
                    border-radius: 20px;
                    display: flex;
                    flex-direction: column;
                    box-shadow: 0 20px 50px rgba(0,0,0,0.3);
                    animation: notif-pop-in 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
                    overflow: hidden;
                    color: var(--text-main, #1e293b);
                }
                [data-theme="dark"] .notif-modal-content {
                    background: #0B132B;
                    border-color: rgba(255,255,255,0.08);
                    color: #f8fafc;
                }
                .notif-modal-header {
                    padding: 20px 24px;
                    border-bottom: 1px solid var(--card-border-color, rgba(0,0,0,0.08));
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    flex-shrink: 0;
                }
                [data-theme="dark"] .notif-modal-header {
                    border-color: rgba(255,255,255,0.08);
                }
                .notif-modal-body {
                    padding: 20px 24px;
                    overflow-y: auto;
                    flex: 1;
                    min-height: 0;
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                }
                .notif-card {
                    padding: 16px;
                    border-radius: 12px;
                    border: 1px solid var(--card-border-color, rgba(0,0,0,0.06));
                    background: var(--bg-secondary, #f8fafc);
                    display: flex;
                    gap: 14px;
                    align-items: flex-start;
                    transition: all 0.2s;
                }
                [data-theme="dark"] .notif-card {
                    background: rgba(255,255,255,0.02);
                    border-color: rgba(255,255,255,0.05);
                }
                .notif-card.unread {
                    border-left: 4px solid #ef4444;
                    background: var(--card-bg, #ffffff);
                }
                [data-theme="dark"] .notif-card.unread {
                    background: rgba(239, 68, 68, 0.03);
                }
            </style>
            <div class="notif-modal-content" onclick="event.stopPropagation()">
                <div class="notif-modal-header">
                    <div style="display:flex; align-items:center; gap:12px;">
                        <span style="width:40px; height:40px; border-radius:12px; background:rgba(239,68,68,0.1); border:1px solid rgba(239,68,68,0.2); display:flex; align-items:center; justify-content:center; color:#ef4444;">
                            <i class="fas fa-bell" style="font-size:1.15rem;"></i>
                        </span>
                        <div>
                            <h3 style="margin:0; font-size:1.1rem; font-weight:700;">Errores de Envío (Meta API)</h3>
                            <p style="margin:2px 0 0; font-size:0.75rem; color:var(--text-muted, #64748b);">Novedades de la integración con WhatsApp</p>
                        </div>
                    </div>
                    <div style="display:flex; gap:8px; align-items:center;">
                        <button id="notif-modal-mark-all" onclick="window._notifModalMarkAll()" class="filter-pill active" style="display:none; cursor:pointer; padding:6px 12px; font-size:0.75rem; border-radius:8px; font-weight:600;">
                            <i class="fas fa-check-double" style="margin-right:4px;"></i> Marcar leídas
                        </button>
                        <button onclick="window.closeNotificationsModal()" class="btn-icon-wa" style="width:32px; height:32px; border-radius:8px; background:rgba(0,0,0,0.05); color:var(--text-muted);" onmouseenter="this.style.background='rgba(0,0,0,0.1)'" onmouseleave="this.style.background='rgba(0,0,0,0.05)'">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                </div>
                <div class="notif-modal-body" id="notif-modal-list">
                    <div style="text-align:center; padding:30px; color:var(--text-muted);">
                        <i class="fas fa-circle-notch fa-spin"></i> Cargando...
                    </div>
                </div>
            </div>
        `;
        overlay.onclick = window.closeNotificationsModal;
        document.body.appendChild(overlay);
    } else {
        overlay.style.display = 'flex';
        // Reset contents
        document.getElementById('notif-modal-list').innerHTML = `
            <div style="text-align:center; padding:30px; color:var(--text-muted);">
                <i class="fas fa-circle-notch fa-spin"></i> Cargando...
            </div>
        `;
    }

    // 2. Load and render notifications
    const token = localStorage.getItem('backoffice_token') || '';
    try {
        const res = await fetch(`/api/backoffice/notifications?token=${encodeURIComponent(token)}&limit=40`);
        const result = await res.json();
        if (!result || !result.success) throw new Error(result.error);

        const listEl = document.getElementById('notif-modal-list');
        const markAllBtn = document.getElementById('notif-modal-mark-all');
        const notifications = result.data || [];

        if (notifications.length === 0) {
            listEl.innerHTML = `
                <div style="text-align:center; padding:48px 16px; color:var(--text-muted);">
                    <div style="width:54px; height:54px; border-radius:50%; background:rgba(34,197,94,0.1); border:1px solid rgba(34,197,94,0.2); display:inline-flex; align-items:center; justify-content:center; margin-bottom:12px; color:#22c55e;">
                        <i class="fas fa-circle-check" style="font-size:1.5rem;"></i>
                    </div>
                    <h4 style="margin:0 0 4px; color:var(--text-main); font-weight:700;">¡Sin novedades de error!</h4>
                    <p style="margin:0; font-size:0.8rem; max-width:280px; margin-inline:auto;">Meta API está procesando todos los envíos con éxito.</p>
                </div>
            `;
            if (markAllBtn) markAllBtn.style.display = 'none';
            return;
        }

        const hasUnread = notifications.some(n => !n.read);
        if (markAllBtn) markAllBtn.style.display = hasUnread ? 'inline-block' : 'none';

        listEl.innerHTML = notifications.map(n => {
            const dateStr = new Date(n.created_at).toLocaleString('es-AR', {
                day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
            });
            const unreadClass = !n.read ? 'unread' : '';
            const errCode = n.metadata?.error_code || 'META';
            const isBulk = n.metadata?.is_bulk === true;

            const typeBadge = isBulk 
                ? `<span style="font-size:0.62rem; background:rgba(239,68,68,0.1); color:#ef4444; border:1px solid rgba(239,68,68,0.2); padding:1px 6px; border-radius:4px; font-weight:700; text-transform:uppercase;">Envío Masivo</span>`
                : `<span style="font-size:0.62rem; background:rgba(0,153,255,0.1); color:#0099FF; border:1px solid rgba(0,153,255,0.2); padding:1px 6px; border-radius:4px; font-weight:700; text-transform:uppercase;">Chat Individual</span>`;

            return `
                <div class="notif-card ${unreadClass}">
                    <div style="width:32px; height:32px; border-radius:8px; background:rgba(239,68,68,0.08); display:flex; align-items:center; justify-content:center; flex-shrink:0; color:#ef4444; margin-top:2px;">
                        <i class="fas fa-circle-exclamation" style="font-size:0.95rem;"></i>
                    </div>
                    <div style="flex:1; min-width:0; display:flex; flex-direction:column; gap:2px;">
                        <div style="display:flex; justify-content:space-between; align-items:center; gap:8px;">
                            <h4 style="margin:0; font-size:0.88rem; font-weight:700; color:var(--text-main);">${window._escNotif(n.title)}</h4>
                            <span style="font-size:0.7rem; color:var(--text-muted);">${dateStr}</span>
                        </div>
                        <p style="margin:2px 0 6px; font-size:0.8rem; color:var(--text-muted); line-height:1.45;">${window._escNotif(n.description)}</p>
                        <div style="display:flex; gap:6px; align-items:center; flex-wrap:wrap;">
                            ${typeBadge}
                            <span style="font-size:0.62rem; background:var(--bg-secondary); border:1px solid var(--border-color); color:var(--text-muted); padding:1px 6px; border-radius:4px; font-weight:700;">CÓDIGO ${errCode}</span>
                        </div>
                    </div>
                    ${!n.read ? `
                        <button onclick="window._notifModalMarkSingle('${n.id}')" class="btn-icon-wa" title="Marcar como leída" style="width:28px; height:28px; border-radius:6px; color:#22c55e; background:rgba(34,197,94,0.1); margin-top:2px; flex-shrink:0;">
                            <i class="fas fa-check" style="font-size:0.8rem;"></i>
                        </button>
                    ` : ''}
                </div>
            `;
        }).join('');

        // Auto-mark notifications as read immediately after opening the modal
        if (hasUnread) {
            const unreadIds = notifications.filter(n => !n.read).map(n => n.id);
            await fetch(`/api/backoffice/notifications/read?token=${encodeURIComponent(token)}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids: unreadIds })
            });
            if (typeof updateNotificationDots === 'function') {
                updateNotificationDots();
            }
        }
    } catch (e) {
        console.error(e);
        document.getElementById('notif-modal-list').innerHTML = `
            <div style="text-align:center; padding:30px; color:#ef4444;">
                <i class="fas fa-triangle-exclamation" style="font-size:1.5rem; margin-bottom:8px;"></i>
                <p style="margin:0; font-size:0.85rem;">Error al cargar notificaciones de sistema.</p>
            </div>
        `;
    }
};

window.closeNotificationsModal = function() {
    const overlay = document.getElementById('notif-modal-overlay');
    if (overlay) overlay.style.display = 'none';
};

window._notifModalMarkSingle = async function(id) {
    const token = localStorage.getItem('backoffice_token') || '';
    try {
        await fetch(`/api/backoffice/notifications/read?token=${encodeURIComponent(token)}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids: [id] })
        });
        if (typeof showToast === 'function') showToast('Notificación leída', 'success');
        // Refresh modal list
        window.openNotificationsModal();
    } catch (e) {
        console.error(e);
    }
};

window._notifModalMarkAll = async function() {
    const token = localStorage.getItem('backoffice_token') || '';
    try {
        const res = await fetch(`/api/backoffice/notifications?token=${encodeURIComponent(token)}&limit=100`);
        const result = await res.json();
        const unreadIds = (result.data || []).filter(n => !n.read).map(n => n.id);
        
        if (unreadIds.length > 0) {
            await fetch(`/api/backoffice/notifications/read?token=${encodeURIComponent(token)}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids: unreadIds })
            });
        }
        if (typeof showToast === 'function') showToast('Todas leídas', 'success');
        window.openNotificationsModal();
    } catch (e) {
        console.error(e);
    }
};

window._escNotif = function(str) {
    return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
};
