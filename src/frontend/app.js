/* global toggleLeadsPanel, toggleTicketsPanel, toggleMetaPanel, io, showToast */
// app.js - Client-side SPA router
// Carga views dinamicamente y maneja la navegacion sin recargar la pagina

const ROUTES = window.__APP_ROUTES || {};
const APP_DOCUMENT_TITLE = 'Backoffice - Neurolinks';

const _loadedScripts = {};
let _currentView = null;
let _mountNonce = 0;
const NOTIFICATION_DOT_STORAGE_KEY = 'backoffice_notification_dot_state';
const SECTION_LAST_ROUTE_KEYS = {
    messaging: 'backoffice_last_route_messaging',
    integrations: 'backoffice_last_route_integrations'
};
function collectSectionRoutes(section) {
    const config = window.__NAV_SECTION_TAB_CONFIG || {};
    const visible = typeof window.__NAV_SECTION_TAB_VISIBLE === 'function'
        ? window.__NAV_SECTION_TAB_VISIBLE
        : () => true;
    const routes = [];
    (config[section] || []).filter(visible).forEach(tab => {
        if (tab.route) routes.push(tab.route);
        if (Array.isArray(tab.matchRoutes)) routes.push(...tab.matchRoutes);
        if (Array.isArray(tab.children)) {
            tab.children.filter(visible).forEach(child => {
                if (child.route) routes.push(child.route);
                if (Array.isArray(child.matchRoutes)) routes.push(...child.matchRoutes);
            });
        }
    });
    return Array.from(new Set(routes));
}

const SECTION_ROUTES = {
    messaging: collectSectionRoutes('messaging'),
    integrations: collectSectionRoutes('integrations')
};

function isConversationsPath(path) {
    return path === '/conversaciones';
}

function readNotificationDotState() {
    try {
        return JSON.parse(localStorage.getItem(NOTIFICATION_DOT_STORAGE_KEY) || '{}') || {};
    } catch {
        return {};
    }
}

const _notificationDotState = readNotificationDotState();

function persistNotificationDotState() {
    try {
        localStorage.setItem(NOTIFICATION_DOT_STORAGE_KEY, JSON.stringify(_notificationDotState));
    } catch {
        // localStorage can fail in restricted contexts; visual state can still be applied in memory.
    }
}

function getDefaultSectionRoute(section) {
    if (section === 'integrations') return window.__CRM_VISIBLE === false ? '/meta' : '/crm';
    return '/dashboard';
}

function getSectionForPath(path) {
    if (SECTION_ROUTES.messaging.includes(path)) return 'messaging';
    if (SECTION_ROUTES.integrations.includes(path)) return 'integrations';
    return null;
}


function rememberSectionRoute(path) {
    const section = getSectionForPath(path);
    if (!section) return;
    try {
        localStorage.setItem(SECTION_LAST_ROUTE_KEYS[section], path);
    } catch {
        // Navigation still works if storage is unavailable.
    }
}


window.navigateToLastSectionRoute = function(section) {
    const allowedRoutes = SECTION_ROUTES[section] || [];
    let route = '';
    try {
        route = localStorage.getItem(SECTION_LAST_ROUTE_KEYS[section]) || '';
    } catch {
        route = '';
    }
    if (!allowedRoutes.includes(route)) route = getDefaultSectionRoute(section);
    if (section === 'integrations' && window.__CRM_VISIBLE === false && ['/crm', '/crm-tareas'].includes(route)) route = '/meta';
    if (section === 'messaging' && window.__BACKOFFICE_VISIBLE === false && ['/conversaciones', '/contactos', '/webchat'].includes(route)) route = '/dashboard';
    navigate(route);
};

function loadViewScript(src) {
    if (_loadedScripts[src]) return Promise.resolve();
    return new Promise((resolve) => {
        const el = document.createElement('script');
        el.src = src + '?v=' + (window.BOT_NAME ? encodeURIComponent(window.BOT_NAME) : '10');
        const done = () => { _loadedScripts[src] = true; resolve(); };
        // Timeout de 30s: safety net para CDN lento; scripts locales no deben llegar a esto
        const t = setTimeout(() => {
            console.warn('[Router] Timeout cargando script, continuando:', src);
            done();
        }, 30000);
        el.onload = () => { clearTimeout(t); done(); };
        el.onerror = () => { clearTimeout(t); console.warn('[Router] Error cargando script:', src); done(); };
        document.head.appendChild(el);
    });
}
window.loadViewScript = loadViewScript;

window.openSupportWidget = async function(e) {
    if (e) {
        e.preventDefault();
        e.stopPropagation();
    }
    if (window.notificationsWidget && typeof window.notificationsWidget.close === 'function') {
        window.notificationsWidget.close();
    }
    await loadViewScript('/js/tickets/support.widget.js');
    if (window.supportWidget) {
        window.supportWidget.init();
        window.supportWidget.toggleOpen();
    }
};

window.openNotificationsModal = async function(e) {
    if (e) {
        e.preventDefault();
        e.stopPropagation();
    }
    await loadViewScript('/js/notifications/notifications.modal.js');
    if (window.notificationsWidget) {
        window.notificationsWidget.init();
        window.notificationsWidget.toggleOpen();
    }
};

function getViewName(scriptPath) {
    // '/js/views/crm-tareas.view.js' -> 'crmTareasView'
    const base = scriptPath.split('/').pop().replace('.view.js', '');
    return base.replace(/-([a-z])/g, (_, c) => c.toUpperCase()) + 'View';
}

function highlightActiveNav(path) {
    const params = new URLSearchParams(window.location.search);
    document.querySelectorAll('.app-sidemenu-link[data-route]').forEach(item => {
        const route = item.getAttribute('data-route') || '';
        const matchRoutes = (item.getAttribute('data-match-routes') || '').split(',').filter(Boolean);
        const routeMatch = route === path || (route === '/docs' && path === '/documentacion');
        item.classList.toggle('active', Boolean(routeMatch || matchRoutes.includes(path)));
    });
    document.querySelectorAll('.app-sidemenu-details').forEach(details => {
        const active = Boolean(details.querySelector('.app-sidemenu-link.active'));
        details.classList.toggle('active', active);
        if (active) details.open = true;
    });
    document.querySelectorAll('.section-tabs .section-tab').forEach(tab => {
        const route = tab.getAttribute('data-route') || '';
        const panel = tab.getAttribute('data-panel') || '';
        const matchRoutes = (tab.getAttribute('data-match-routes') || '').split(',').filter(Boolean);
        const routeMatch = route === path || (route === '/docs' && path === '/documentacion');
        const groupMatch = matchRoutes.includes(path);
        const panelMatch = panel && isConversationsPath(path) && params.get('openPanel') === panel;
        const backofficeRootMatch = isConversationsPath(route) && isConversationsPath(path) && !params.get('openPanel');
        tab.classList.toggle('active', Boolean(groupMatch || panelMatch || backofficeRootMatch || (routeMatch && !isConversationsPath(route))));
    });
    document.querySelectorAll('.section-tabs .section-tab-menu-item[data-route]').forEach(item => {
        item.classList.toggle('active', item.getAttribute('data-route') === path);
    });
}
window.highlightActiveNav = highlightActiveNav;

async function mountView(path) {
    const nonce = ++_mountNonce;

    // Normalizar path (quitar trailing slash)
    const rawPath = path.replace(/\/$/, '') || '/conversaciones';
    const cleanPath = rawPath === '/conexion' ? '/conexion-chatbot' : rawPath;
    const viewScript = ROUTES[cleanPath];
    if (rawPath === '/conexion') {
        history.replaceState(null, '', '/conexion-chatbot');
    }

    if (!viewScript) {
        navigate('/conversaciones');
        return;
    }

    // Validar que exista el token correspondiente antes de proceder al montaje o llamadas a la API
    const isSystemConfig = cleanPath === '/system-config';
    let token = isSystemConfig
        ? localStorage.getItem('system_config_token')
        : localStorage.getItem('backoffice_token');

    if (!token) {
        console.warn(`[Router] No hay token para la ruta ${cleanPath}. Abortando montaje y redirigiendo.`);
        window.location.href = isSystemConfig ? '/login?target=system-config' : '/login';
        return;
    }

    if (isSystemConfig && localStorage.getItem('is_superadmin') !== 'true') {
        window.location.href = '/login?target=system-config';
        return;
    }


    rememberSectionRoute(cleanPath);

    if (typeof window.updateSectionHeader === 'function') {
        window.updateSectionHeader(cleanPath);
    }

    // Destruir view actual
    if (_currentView && typeof _currentView.destroy === 'function') {
        _currentView.destroy();
    }

    const root = document.getElementById('view-content-root') || document.getElementById('view-root');
    if (!root) return;

    root.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;width:100%;"><i class="fas fa-circle-notch fa-spin" style="font-size:2rem;color:var(--accent-color,#0099FF);"></i></div>';

    try {
        // Para crm-tareas: pre-cargar crm.view.js para que _getCRMModals este disponible
        if (cleanPath === '/crm-tareas') {
            await loadViewScript('/js/crm/crm.view.js');
        }
        if (nonce !== _mountNonce) return;

        await loadViewScript(viewScript);
        if (nonce !== _mountNonce) return;

        const viewName = getViewName(viewScript);
        const view = window[viewName];

        if (!view) {
            console.error(`[Router] View "${viewName}" no encontrada despues de cargar ${viewScript}`);
            return;
        }

        root.innerHTML = view.getHTML ? view.getHTML() : '';
        if (nonce !== _mountNonce) return;

        document.title = APP_DOCUMENT_TITLE;
        highlightActiveNav(cleanPath);
        applyCachedNotificationDots();
        _currentView = view;

        // Guardar visitas para que el proximo summary confirme si esos pendientes ya fueron leidos.
        // No apagamos visualmente aca: se evita el parpadeo al reconstruir tabs entre views.
        if (cleanPath === '/conversaciones') {
            localStorage.setItem('last_visited_conversaciones', Date.now().toString());
        } else if (cleanPath === '/reportes') {
            localStorage.setItem('last_visited_reportes', Date.now().toString());
        } else if (cleanPath === '/crm') {
            localStorage.setItem('last_visited_crm', Date.now().toString());
        } else if (cleanPath === '/crm-tareas') {
            localStorage.setItem('last_visited_tareas', Date.now().toString());
        }

        // Actualizar desde el servidor
        if (typeof window.updateNotificationDots === 'function') {
            window.updateNotificationDots();
        }

        if (typeof view.init === 'function') {
            await view.init();
        }
    } catch (err) {
        if (nonce !== _mountNonce) return;
        console.error('[Router] Error montando view:', err);
        root.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100%;width:100%;color:#ef4444;"><i class="fas fa-exclamation-triangle" style="margin-right:8px;"></i> Error cargando la pagina.</div>`;
    }
}

// Funcion global de navegacion SPA
function navigate(path) {
    // Separar path de query string para comparacion
    const [pathname] = path.split('?');
    const current = window.location.pathname;

    // Si el path es el mismo no hacer nada (pero si hay query string, actualizar)
    if (pathname === current && !path.includes('?')) return;

    history.pushState({}, '', path);
    mountView(pathname);
}
window.navigate = navigate;

// Manejar navegacion con el boton atras/adelante del browser
window.addEventListener('popstate', () => {
    mountView(window.location.pathname);
});

function setNotificationDot(id, visible, displayMode = 'inline-block') {
    _notificationDotState[id] = { visible: Boolean(visible), displayMode };
    persistNotificationDotState();
    applyNotificationDotElement(id, visible, displayMode);
}

function applyNotificationDotElement(id, visible, displayMode = 'inline-block') {
    const elements = [];
    const el = document.getElementById(id);
    if (el) elements.push(el);
    const selectorId = String(id).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    document.querySelectorAll(`[data-dot-sync="${selectorId}"]`).forEach(syncEl => elements.push(syncEl));
    if (!elements.length) return;

    elements.forEach(dotEl => {
        if (dotEl.classList.contains('section-tab-dot')) {
            dotEl.style.display = 'inline-block';
            dotEl.style.visibility = visible ? 'visible' : 'hidden';
            dotEl.style.opacity = visible ? '1' : '0';
            dotEl.dataset.visible = visible ? 'true' : 'false';
            return;
        }

        dotEl.style.display = visible ? displayMode : 'none';
        dotEl.style.visibility = '';
        dotEl.style.opacity = '';
        delete dotEl.dataset.visible;
    });
}

function isNotificationDotVisible(id) {
    if (_notificationDotState[id]) {
        return _notificationDotState[id].visible === true;
    }

    return false;
}

function applyCachedNotificationDots() {
    Object.entries(_notificationDotState).forEach(([id, state]) => {
        applyNotificationDotElement(id, state.visible === true, state.displayMode || 'inline-block');
    });
}
window.applyCachedNotificationDots = applyCachedNotificationDots;

// Funcion global para actualizar puntos de notificacion en el sidebar
async function updateNotificationDots() {
    const token = localStorage.getItem('backoffice_token') || '';
    if (!token || token === 'undefined') return;

    try {
        const res = await fetch(`/api/backoffice/notifications/summary?token=${encodeURIComponent(token)}`);
        const data = await res.json();
        if (!data || !data.success) return;

        const currentPath = window.location.pathname;

        // --- Notificaciones ---
        const showNotificationsBadge = data.unread_notifications_count > 0 && currentPath !== '/notifications';
        const badgeNotifications = document.getElementById('badge-notifications-count');
        const desktopBadgeNotifications = document.getElementById('desktop-badge-notifications-count');
        const notificationsLabel = data.unread_notifications_count > 99 ? '+99' : data.unread_notifications_count;
        if (badgeNotifications) {
            badgeNotifications.innerText = notificationsLabel;
            badgeNotifications.style.display = showNotificationsBadge ? 'inline-flex' : 'none';
        }
        if (desktopBadgeNotifications) {
            desktopBadgeNotifications.innerText = notificationsLabel;
            desktopBadgeNotifications.style.display = showNotificationsBadge ? 'inline-flex' : 'none';
        }
        document.querySelectorAll('[data-notifications-badge]').forEach(badge => {
            badge.innerText = notificationsLabel;
            badge.style.display = showNotificationsBadge ? 'inline-flex' : 'none';
        });

        // --- Conversaciones ---
        // En chats el pendiente real es el unread count, incluso si la pestaÃ±a
        // Conversaciones esta montada: puede haber chats sin leer dentro.
        const showConversaciones = data.unread_chats_count > 0;
        setNotificationDot('dot-conversaciones', showConversaciones);
        // --- Tickets (Ahora en Support Widget, manejado de forma independiente) ---


        // --- Reportes ---
        const lastReportesVisit = parseInt(localStorage.getItem('last_visited_reportes') || '0');
        const latestReporteTime = data.latest_reporte_time ? new Date(data.latest_reporte_time).getTime() : 0;
        const showReportes = latestReporteTime > lastReportesVisit && currentPath !== '/reportes';
        setNotificationDot('dot-reportes', showReportes);

        // --- CRM / Tareas ---
        const lastCrmVisit = parseInt(localStorage.getItem('last_visited_crm') || '0');
        const latestLeadTime = data.latest_crm_lead_time ? new Date(data.latest_crm_lead_time).getTime() : 0;
        const lastTareasVisit = parseInt(localStorage.getItem('last_visited_tareas') || '0');
        const latestTareaTime = data.latest_tarea_time ? new Date(data.latest_tarea_time).getTime() : 0;
        const crmLeadsCount = Number(data.crm_leads_count || 0);
        const crmTasksCount = Number(data.crm_tasks_count || 0);
        const showCrmLeads = crmLeadsCount > 0 || latestLeadTime > lastCrmVisit;
        setNotificationDot('dot-crm-leads', showCrmLeads);

        const showCrm = showCrmLeads ||
            (crmTasksCount > 0 || latestTareaTime > lastTareasVisit);
        setNotificationDot('dot-crm', showCrm);

        // --- Tareas ---
        const showTareas = crmTasksCount > 0 || latestTareaTime > lastTareasVisit;
        setNotificationDot('dot-tareas', showTareas);

        // --- Gestion (Padre) ---
        const showMessaging = showConversaciones || showReportes;
        setNotificationDot('dot-messaging', showMessaging);

        // --- Integraciones (Padre) ---
        const showIntegraciones = showCrm || showTareas;
        setNotificationDot('dot-integraciones', showIntegraciones);

    } catch (e) {
        console.error('[Router] Error al actualizar puntos de notificacion:', e);
    }
}
window.updateNotificationDots = updateNotificationDots;

// Iniciar en DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
    mountView(window.location.pathname);

    // Cargar Support Widget Globalmente
    loadViewScript('/js/tickets/support.widget.js').then(() => {
        if (window.supportWidget) {
            window.supportWidget.init();
        }
    });

    // Verificar si el cliente EPC estÃ¡ activo para mostrar el menÃº CBU/CVU/ALIAS
    const backofficeTokenForSlug = localStorage.getItem('backoffice_token');
    if (backofficeTokenForSlug) {
        fetch(`/api/dashboard-status?token=${encodeURIComponent(backofficeTokenForSlug)}`)
            .then(res => res.json())
            .then(data => {
                window.__EPC_VISIBLE = data.clientSlug === 'cas-epc' || data.clientSlug === 'casepc';
                if (typeof window.renderSideMenu === 'function') {
                    window.renderSideMenu();
                }
                if (typeof window.updateSectionHeader === 'function') {
                    window.updateSectionHeader(window.location.pathname, { force: true });
                }
            })
            .catch(err => console.error('[Router] Error checking client slug:', err));
    }

    // Escuchar cambios de settings en tiempo real
    const _appSocket = io();
    _appSocket.on('setting_changed', ({ key }) => {
        if (key === 'GLOBAL_BOT_ENABLED' && typeof window.updateSectionHeader === 'function') {
            window.updateSectionHeader(window.location.pathname, { force: true });
        }
    });

    // Escuchar eventos en tiempo real para actualizar los puntos de notificacion
    _appSocket.on('new_message', (msg) => {
        const normChatId = (id) => String(id || '').split('@')[0];
        const activeBackofficeChatId = window.__activeBackofficeChatId || null;
        const incomingChatId = msg?.chat_id || msg?.chatId || null;
        if (window.location.pathname === '/conversaciones' && activeBackofficeChatId && normChatId(activeBackofficeChatId) === normChatId(incomingChatId)) {
            return;
        }
        updateNotificationDots();
    });
    _appSocket.on('notification_created', () => {
        updateNotificationDots();
        if (window.notificationsWidget && typeof window.notificationsWidget.isOpen === 'function' && window.notificationsWidget.isOpen()) {
            window.notificationsWidget.load();
        }
    });
    _appSocket.on('whatsapp_line_changed', () => {
        if (typeof window.refreshDesktopLineSelector === 'function') {
            window.refreshDesktopLineSelector();
        }
        if (typeof window.refreshConexionStatus === 'function') {
            window.refreshConexionStatus();
        }
    });
    _appSocket.on('baileys_status_changed', () => {
        if (typeof window.refreshConexionStatus === 'function') {
            window.refreshConexionStatus();
        }
        if (typeof window.refreshDesktopLineSelector === 'function') {
            window.refreshDesktopLineSelector();
        }
    });
    _appSocket.on('contact_updated', () => {
        updateNotificationDots();
    });
    _appSocket.on('ticket_updated', () => {
        updateNotificationDots();
    });
    _appSocket.on('reporte_created', () => {
        updateNotificationDots();
    });

    // Actualizacion inicial corta y polling de seguridad de 30 segundos
    setTimeout(updateNotificationDots, 1000);
    setInterval(updateNotificationDots, 30000);
});
