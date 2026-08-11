/* global Swal, Sortable */
// Interceptor de Fetch global para codificar automáticamente el token en query strings
(function() {
    const originalFetch = window.fetch;
    window.fetch = function(input, init) {
        if (typeof input === 'string') {
            const tokenIdx = input.indexOf('token=');
            if (tokenIdx !== -1) {
                const prefix = input.substring(0, tokenIdx + 6);
                const remainder = input.substring(tokenIdx + 6);
                const ampIdx = remainder.indexOf('&');
                let rawToken, suffix;
                if (ampIdx !== -1) {
                    rawToken = remainder.substring(0, ampIdx);
                    suffix = remainder.substring(ampIdx);
                } else {
                    rawToken = remainder;
                    suffix = '';
                }
                const decodedToken = decodeURIComponent(rawToken);
                const encodedToken = encodeURIComponent(decodedToken);
                input = prefix + encodedToken + suffix;
            }
        } else if (input && typeof input === 'object' && typeof input.toString === 'function') {
            let inputStr = input.toString();
            const tokenIdx = inputStr.indexOf('token=');
            if (tokenIdx !== -1) {
                const prefix = inputStr.substring(0, tokenIdx + 6);
                const remainder = inputStr.substring(tokenIdx + 6);
                const ampIdx = remainder.indexOf('&');
                let rawToken, suffix;
                if (ampIdx !== -1) {
                    rawToken = remainder.substring(0, ampIdx);
                    suffix = remainder.substring(ampIdx);
                } else {
                    rawToken = remainder;
                    suffix = '';
                }
                const decodedToken = decodeURIComponent(rawToken);
                const encodedToken = encodeURIComponent(decodedToken);
                input = prefix + encodedToken + suffix;
            }
        }
        return originalFetch(input, init);
    };
})();

// --- Funciones Globales para Textareas de Chat ---
window.handleChatTextareaKey = function(e, sendCallback) {
    if (e.key === 'Enter') {
        if (window.innerWidth <= 1024) {
            // Mobile/Tablet: Enter hace un salto de línea normal
            return;
        } else {
            // Desktop: Enter envía, Shift+Enter hace salto de línea
            if (!e.shiftKey) {
                e.preventDefault();
                if (typeof sendCallback === 'function') sendCallback();
            }
        }
    }
};

window.autoResizeChatTextarea = function(el) {
    el.style.height = 'auto';
    
    // padding aproximado (puede variar un poco según la vista, pero 16px es estándar)
    const paddingY = 16;
    const lineHeight = 20; 
    
    // 5 líneas en Mobile/Tablet, 8 en Desktop
    const maxLines = window.innerWidth <= 1024 ? 5 : 8;
    const maxHeight = paddingY + (lineHeight * maxLines);
    
    el.style.height = Math.min(el.scrollHeight, maxHeight) + 'px';
};

window.resetChatTextarea = function(el) {
    if (!el) return;
    el.value = '';
    el.style.height = 'auto';
};

// --- Lógica Común de Navegación y Estilo ---

// ── Custom Select Dropdown (CSD) helpers ─────────────────────────────
function _csdCloseAll() {
    document.querySelectorAll('.csd-menu.open').forEach(m => {
        m.classList.remove('open', 'csd-sm');
        m.style.cssText = '';
        if (m._csdWrap) {
            m._csdWrap.appendChild(m);
            const b = m._csdWrap.querySelector('.csd-btn');
            if (b) b.classList.remove('open');
            delete m._csdWrap;
        }
    });
}
function _csdToggle(btn) {
    const wrap = btn.closest('.csd-wrap');
    const isOpen = btn.classList.contains('open');
    _csdCloseAll();
    if (isOpen) return;
    const menu = wrap.querySelector('.csd-menu');
    if (!menu) return;

    menu._csdWrap = wrap;
    if (wrap.classList.contains('csd-sm')) menu.classList.add('csd-sm');
    document.body.appendChild(menu);

    // Measure actual height off-screen before positioning
    menu.style.cssText = 'position:fixed;visibility:hidden;top:-9999px;left:-9999px;';
    menu.classList.add('open');
    const menuH = menu.offsetHeight || 228;

    const rect = btn.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const openAbove = spaceBelow < menuH;
    const top = openAbove ? Math.max(4, rect.top - menuH - 4) : rect.bottom + 4;

    menu.style.cssText = `position:fixed;top:${top}px;left:${rect.left}px;width:${rect.width}px;right:auto;z-index:99999;`;
    btn.classList.add('open');

    setTimeout(() => {
        function h(e) {
            if (!wrap.contains(e.target) && !menu.contains(e.target)) {
                _csdCloseAll();
                document.removeEventListener('click', h, { capture: true });
                document.removeEventListener('scroll', h, { capture: true });
            }
        }
        document.addEventListener('click', h, { capture: true });
        document.addEventListener('scroll', h, { capture: true });
    }, 0);
}
function _csdSelect(item, value) {
    const menu = item.closest('.csd-menu');
    const wrap = (menu && menu._csdWrap) || item.closest('.csd-wrap');
    if (!wrap) return;
    const sel = wrap.querySelector('select');
    const label = wrap.querySelector('.csd-label');
    if (sel) { sel.value = value; sel.dispatchEvent(new Event('change')); }
    if (label) label.textContent = item.textContent.trim();
    if (menu) menu.querySelectorAll('.csd-item').forEach(i => i.classList.toggle('selected', i === item));
    _csdCloseAll();
}
function _csdSync(id) {
    const sel = document.getElementById(id);
    if (!sel) return;
    const wrap = sel.closest('.csd-wrap');
    if (!wrap) return;
    const label = wrap.querySelector('.csd-label');
    const opt = sel.options[sel.selectedIndex];
    if (label && opt) label.textContent = opt.text;
    const menu = wrap.querySelector('.csd-menu');
    if (menu) menu.querySelectorAll('.csd-item').forEach(i => i.classList.toggle('selected', i.dataset.val === sel.value));
}
function _csdRebuild(id) {
    const sel = document.getElementById(id);
    if (!sel) return;
    const wrap = sel.closest('.csd-wrap');
    if (!wrap) return;
    const menu = wrap.querySelector('.csd-menu');
    if (!menu) return;
    menu.innerHTML = Array.from(sel.options).map(o =>
        `<button class="csd-item" type="button" data-val="${o.value}" onclick="_csdSelect(this,'${o.value.replace(/'/g,"\\'")}')">  ${o.text}</button>`
    ).join('');
}

function updateThemeNavState(theme) {
    const isDark = theme === 'dark';
    const cb = document.getElementById('theme-toggle-input');
    if (cb) cb.checked = isDark;

    const icon = document.getElementById('theme-mode-icon');
    if (icon) {
        icon.classList.toggle('fa-sun', !isDark);
        icon.classList.toggle('fa-moon', isDark);
    }

    const label = document.getElementById('theme-flyout-label');
    if (label) label.textContent = isDark ? 'Tema: Oscuro' : 'Tema: Claro';
}

function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeNavState(savedTheme);
}

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    updateThemeNavState(newTheme);
    window.dispatchEvent(new Event('themeChanged'));
}

function updateSystemConfigNavVisibility() {
    const navItem = document.querySelector('[data-route="/system-config"]')?.closest('li');
    if (!navItem) return;
    const enabled = window.__SYSTEM_CONFIG_VISIBLE !== false;
    const isSuperAdmin = localStorage.getItem('is_superadmin') === 'true';
    const canShow = enabled && isSuperAdmin;
    navItem.classList.toggle('hidden-item', !canShow);
    navItem.style.display = canShow ? '' : 'none';
}
window.updateSystemConfigNavVisibility = updateSystemConfigNavVisibility;

function logout() {
    localStorage.removeItem('backoffice_token');
    localStorage.removeItem('system_config_token');
    localStorage.removeItem('is_superadmin');
    localStorage.removeItem('user_role');
    localStorage.removeItem('user_id');
    localStorage.removeItem('user_name');
    window.location.href = '/login';
}

/**
 * Retorna el token de autenticación del backoffice listo para usar en URLs.
 * Usa encodeURIComponent para evitar que caracteres especiales (#, &, etc.)
 * rompan la query string.
 */
window.getAuthToken = function() {
    const raw = localStorage.getItem('system_config_token') || localStorage.getItem('backoffice_token') || '';
    return encodeURIComponent(raw);
};

const SECTION_TAB_CONFIG = {
    messaging: [
        { label: 'Dashboard', icon: 'fas fa-chart-simple', route: '/dashboard' },
        { label: 'Conversaciones', icon: 'fas fa-comments', route: '/conversaciones', dotId: 'dot-conversaciones', requires: 'backoffice' },
        { label: 'Contactos', icon: 'fas fa-user-group', route: '/contactos', requires: 'backoffice' },
        { label: 'Reportes', icon: 'fas fa-file-lines', route: '/reportes', dotId: 'dot-reportes' },
        { label: 'Conexion', icon: 'fas fa-plug-circle-bolt', route: '/conexion' },
        { label: 'Webchat', icon: 'fas fa-headset', route: '/webchat', requires: 'backoffice' },
    ],
    integrations: [
        { label: 'CRM', icon: 'fas fa-id-card-clip', route: '/crm', dotId: 'dot-crm', requires: 'crm' },
        { label: 'Tareas', icon: 'fas fa-calendar-check', route: '/crm-tareas', dotId: 'dot-tareas', requires: 'crm' },
        { label: 'Meta', icon: 'fab fa-meta', route: '/meta', requires: 'backoffice' },
        {
            label: 'Mercado Libre',
            icon: 'fas fa-handshake',
            route: '/mercado-libre-productos',
            matchRoutes: ['/mercado-libre', '/mercado-libre-productos', '/mercado-libre-bot', '/mercado-pago'],
            children: [
                { label: 'Productos', icon: 'fas fa-boxes', route: '/mercado-libre-productos' },
                { label: 'Bot', icon: 'fas fa-robot', route: '/mercado-libre-bot' },
                { label: 'Mercado Pago', icon: 'fas fa-wallet', route: '/mercado-pago' },
            ],
        },
        { label: 'Lista Negra', icon: 'fas fa-ban', route: '/lista-negra' },
        { label: 'Webhooks', icon: 'fas fa-satellite-dish', route: '/webhooks' },
        { label: 'CBU/CVU EPC', icon: 'fas fa-building-columns', route: '/epc-cbu-cvu', requires: 'epc' },
    ],
};

function _sectionTabVisible(tab) {
    if (tab.requires === 'backoffice') return window.__BACKOFFICE_VISIBLE !== false;
    if (tab.requires === 'crm') return window.__CRM_VISIBLE !== false;
    if (tab.requires === 'system_config') return window.__SYSTEM_CONFIG_VISIBLE !== false;
    if (tab.requires === 'epc') return window.__EPC_VISIBLE === true;
    return true;
}

function _sectionTabActive(tab, path, params) {
    const isConversationsPath = (value) => value === '/conversaciones';
    if (tab.activePanel) return isConversationsPath(path) && params.get('openPanel') === tab.activePanel;
    if (Array.isArray(tab.matchRoutes) && tab.matchRoutes.includes(path)) return true;
    if (!tab.route) return false;
    if (tab.route === '/docs') return path === '/docs' || path === '/documentacion';
    if (isConversationsPath(tab.route)) return isConversationsPath(path) && !params.get('openPanel');
    return tab.route === path;
}

function _sectionTabAriaLabel(section) {
    if (section === 'messaging') return 'Gestion';
    if (section === 'integrations') return 'Integraciones';
    if (section === 'settings') return 'Ajustes';
    return 'Seccion';
}

window.renderSectionTabs = function(section, options = {}) {
    if (window.__PERSISTENT_SECTION_HEADER && !options.persistent) return '';

    const tabs = SECTION_TAB_CONFIG[section] || [];
    const path = window.location.pathname;
    const params = new URLSearchParams(window.location.search);
    const visibleTabs = tabs.filter(_sectionTabVisible);

    if (!visibleTabs.length) return '';

    return `
        <nav class="docs-nav section-tabs no-print" role="tablist" aria-label="${_sectionTabAriaLabel(section)}">
            ${visibleTabs.map((tab, index) => {
                const active = _sectionTabActive(tab, path, params) ? ' active' : '';
                const onclick = tab.action || `navigate('${tab.route}')`;
                const route = tab.route || '';
                const panel = tab.activePanel || '';
                const dot = tab.dotId
                    ? `<span class="nav-dot section-tab-dot" id="${tab.dotId}" style="display:inline-block; visibility:hidden; opacity:0;" data-visible="false"></span>`
                    : '<span class="section-tab-dot section-tab-dot-placeholder" aria-hidden="true"></span>';
                const matchRoutes = Array.isArray(tab.matchRoutes) ? tab.matchRoutes.join(',') : '';
                if (Array.isArray(tab.children) && tab.children.length) {
                    const menuId = `section-tab-menu-${section}-${index}`;
                    const children = tab.children.filter(_sectionTabVisible);
                    return `
                        <span class="section-tab-group${active}" data-section-tab-group>
                            <button class="docs-nav-tab section-tab section-tab-dropdown-toggle${active}" data-route="${route}" data-panel="${panel}" data-match-routes="${matchRoutes}" onclick="toggleSectionTabMenu(event, '${menuId}')" role="tab" aria-haspopup="menu" aria-expanded="false">
                                <i class="${tab.icon}"></i><span>${tab.label}</span>${dot}<i class="fas fa-chevron-down section-tab-chevron"></i>
                            </button>
                            <span class="section-tab-menu" id="${menuId}" role="menu">
                                ${children.map(child => {
                                    const childActive = _sectionTabActive(child, path, params) ? ' active' : '';
                                    return `
                                        <button class="section-tab-menu-item${childActive}" data-route="${child.route || ''}" onclick="closeSectionTabMenus(); navigate('${child.route}')" role="menuitem">
                                            <i class="${child.icon}"></i><span>${child.label}</span>
                                        </button>
                                    `;
                                }).join('')}
                            </span>
                        </span>
                    `;
                }
                return `
                    <button class="docs-nav-tab section-tab${active}" data-route="${route}" data-panel="${panel}" data-match-routes="${matchRoutes}" onclick="${onclick}" role="tab">
                        <i class="${tab.icon}"></i><span>${tab.label}</span>${dot}
                    </button>
                `;
            }).join('')}
        </nav>
    `;
};

window.closeSectionTabMenus = function() {
    document.querySelectorAll('.section-tab-menu.open').forEach(menu => menu.classList.remove('open'));
    document.querySelectorAll('.section-tab-dropdown-toggle[aria-expanded="true"]').forEach(btn => btn.setAttribute('aria-expanded', 'false'));
};

function _getSectionTabMenuHost() {
    let host = document.getElementById('section-tab-menu-host');
    if (!host) {
        host = document.createElement('div');
        host.id = 'section-tab-menu-host';
        document.body.appendChild(host);
    }
    return host;
}

window.toggleSectionTabMenu = function(e, menuId) {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    const button = e?.currentTarget;
    const group = button?.closest('[data-section-tab-group]');
    const menu = group?.querySelector(`#${menuId}`) || document.getElementById(menuId);
    if (!menu || !button) return;
    const isOpen = menu.classList.contains('open');
    window.closeSectionTabMenus();
    if (isOpen) return;
    _getSectionTabMenuHost().appendChild(menu);
    const rect = button.getBoundingClientRect();
    const maxLeft = window.innerWidth - Math.max(rect.width, menu.offsetWidth || rect.width) - 12;
    menu.style.top = `${rect.bottom + 8}px`;
    menu.style.left = `${Math.max(12, Math.min(rect.left, maxLeft))}px`;
    menu.style.minWidth = `${rect.width}px`;
    menu.classList.add('open');
    button.setAttribute('aria-expanded', 'true');
};

if (!window.__sectionTabMenuCloseBound) {
    window.__sectionTabMenuCloseBound = true;
    document.addEventListener('click', (e) => {
        if (!e.target.closest('[data-section-tab-group]')) window.closeSectionTabMenus();
    });
    window.addEventListener('resize', () => window.closeSectionTabMenus());
}

// Resaltado automático de la página actual en el Nav
function highlightActiveNav() {
    const path = window.location.pathname;
    const messagingPaths = ['/dashboard', '/conversaciones', '/contactos', '/reportes', '/conexion', '/webchat'];
    const integrationPaths = ['/crm', '/crm-tareas', '/meta', '/mercado-libre', '/mercado-libre-productos', '/mercado-libre-bot', '/mercado-pago', '/lista-negra', '/webhooks'];
    const settingsPaths = ['/usuarios'];
    const navItems = document.querySelectorAll('.nav-item');

    navItems.forEach(item => {
        item.classList.remove('active');
        const route = item.getAttribute('data-route');
        if (route) {
            if (route === path) item.classList.add('active');
            return;
        }
        const onclick = item.getAttribute('onclick') || '';
        if (path === '/conversaciones' && onclick.includes('/conversaciones')) item.classList.add('active');
        if (path === '/dashboard' && onclick.includes('/dashboard')) item.classList.add('active');
        if (path === '/crm' && onclick.includes("'/crm'")) item.classList.add('active');
        if (path === '/crm-tareas' && onclick.includes("'/crm-tareas'")) item.classList.add('active');
        if (path === '/webchat' && onclick.includes('/webchat')) item.classList.add('active');
        if (path === '/system-config' && onclick.includes('/system-config')) item.classList.add('active');
    });
    document.querySelectorAll('.section-tabs .section-tab').forEach(tab => {
        const matchRoutes = (tab.getAttribute('data-match-routes') || '').split(',').filter(Boolean);
        if (matchRoutes.includes(path)) tab.classList.add('active');
    });
    document.querySelectorAll('.section-tabs .section-tab-menu-item[data-route]').forEach(item => {
        item.classList.toggle('active', item.getAttribute('data-route') === path);
    });

    const msgBtn = document.getElementById('nav-messaging-btn');
    if (msgBtn) msgBtn.classList.toggle('active', messagingPaths.includes(path));
    const intBtn = document.getElementById('nav-integraciones-btn');
    if (intBtn) intBtn.classList.toggle('active', integrationPaths.includes(path));
    const userBtn = document.getElementById('nav-usuarios-btn');
    if (userBtn) userBtn.classList.toggle('active', settingsPaths.includes(path));
}

// ── Dropdown Mensajeria ────────────────────────────────────────────
function _closeAllNavDropdowns() {
    document.querySelectorAll('#navbar .nav-dropdown.open').forEach(el => {
        el.classList.remove('open');
        const menu = el.querySelector('.nav-dropdown-menu');
        if (menu) menu.style.height = '0';
    });
}

window.toggleMessagingFlyout = function(e) {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    const container = document.getElementById('nav-messaging-btn');
    if (!container) return;
    const menu = container.querySelector('.nav-dropdown-menu');
    if (!menu) return;

    const isOpen = container.classList.contains('open');
    _closeAllNavDropdowns();
    if (!isOpen) {
        container.classList.add('open');
        menu.style.height = menu.scrollHeight + 'px';
        // Mark active links
        const path = window.location.pathname;
        document.querySelectorAll('#nav-messaging-btn .nav-dropdown-link[data-route]').forEach(item => {
            item.classList.toggle('active', item.getAttribute('data-route') === path);
        });
    }
};

window.closeMessagingFlyout = function() {
    const container = document.getElementById('nav-messaging-btn');
    if (!container) return;
    container.classList.remove('open');
    const menu = container.querySelector('.nav-dropdown-menu');
    if (menu) menu.style.height = '0';
};

window.toggleIntegracionesFlyout = function(e) {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    const container = document.getElementById('nav-integraciones-btn');
    if (!container) return;
    const menu = container.querySelector('.nav-dropdown-menu');
    if (!menu) return;
    const isOpen = container.classList.contains('open');
    _closeAllNavDropdowns();
    if (!isOpen) {
        container.classList.add('open');
        menu.style.height = menu.scrollHeight + 'px';
        const path = window.location.pathname;
        container.querySelectorAll('.nav-dropdown-link[data-route]').forEach(item => {
            item.classList.toggle('active', item.getAttribute('data-route') === path);
        });
    }
};

window.closeIntegracionesFlyout = function() {
    const container = document.getElementById('nav-integraciones-btn');
    if (!container) return;
    container.classList.remove('open');
    const menu = container.querySelector('.nav-dropdown-menu');
    if (menu) menu.style.height = '0';
    
    // Cerrar también el sub-dropdown de Mercado Libre para que no se quede abierto la próxima vez
    const meliSub = document.getElementById('nav-mercado-libre-sub');
    if (meliSub) {
        meliSub.classList.remove('open');
        const subMenu = meliSub.querySelector('.nav-sub-dropdown-menu');
        const chevron = meliSub.querySelector('.nav-sub-dropdown-icon');
        if (subMenu) subMenu.style.height = '0';
        if (chevron) chevron.style.transform = 'rotate(0deg)';
    }
};

window.toggleMeliSubMenu = function(e) {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    const container = document.getElementById('nav-mercado-libre-sub');
    if (!container) return;
    const menu = container.querySelector('.nav-sub-dropdown-menu');
    if (!menu) return;
    const chevron = container.querySelector('.nav-sub-dropdown-icon');

    const isOpen = container.classList.contains('open');
    if (isOpen) {
        container.classList.remove('open');
        menu.style.height = '0';
        if (chevron) chevron.style.transform = 'rotate(0deg)';
    } else {
        container.classList.add('open');
        menu.style.height = menu.scrollHeight + 'px';
        if (chevron) chevron.style.transform = 'rotate(180deg)';
        
        // Ajustar altura del contenedor padre (Integraciones) para evitar recortes
        const parentMenu = document.querySelector('#nav-integraciones-btn .nav-dropdown-menu');
        if (parentMenu) {
            parentMenu.style.height = 'auto';
        }
    }
};

// Manejo inteligente de Paneles laterales desde cualquier página
window.toggleLeadsPanel = (e) => {
    if (e && e.stopPropagation) e.stopPropagation();
    if (typeof window.navigate === 'function') window.navigate('/contactos');
    else window.location.href = '/contactos';
};

window.toggleTicketsPanel = (e) => {
    if (window.location.pathname !== '/conversaciones') {
        if (typeof window.navigate === 'function') window.navigate('/conversaciones?openPanel=tickets');
        else window.location.href = '/conversaciones?openPanel=tickets';
        return;
    }
    if (typeof window.realToggleTickets === 'function') window.realToggleTickets(e);
};

// Meta vive en /meta view - navegar directamente
window.toggleMetaPanel = (e) => {
    if (e && e.stopPropagation) e.stopPropagation();
    if (typeof window.navigate === 'function') window.navigate('/meta');
    else window.location.href = '/meta';
};
window.realToggleMeta = window.toggleMetaPanel;


async function _refreshMetaPanelStatus() {
    try {
        const token = localStorage.getItem('system_config_token') || localStorage.getItem('backoffice_token');
        if (!token) return;
        const res = await fetch(`/api/backoffice/whatsapp/config?token=${token}`);
        const data = await res.json();
        const config = (data && data.config) || {};
        const isConnected = !!(config.waba_id && config.phone_number_id);

        const statusEl = document.getElementById('meta-panel-status');
        if (statusEl) {
            statusEl.textContent = isConnected ? 'Meta Cloud API vinculado' : 'Meta Cloud API no vinculado';
            statusEl.style.color = isConnected ? '#10b981' : 'rgba(255,255,255,0.4)';
        }

        const metaPanel = document.getElementById('meta-panel');
        if (!metaPanel) return;
        const content = metaPanel.querySelector('.tickets-list');
        if (!content) return;

        if (isConnected) {
            window.isMetaConnected = true;
            content.innerHTML = `
                <div style="background: linear-gradient(135deg, #10b981, #059669); width: 100px; height: 100px; border-radius: 24px; display: flex; align-items: center; justify-content: center; font-size: 3rem; color: white; box-shadow: 0 15px 30px rgba(16, 185, 129, 0.4); margin-top: 40px;">
                    <i class="fas fa-check-double"></i>
                </div>
                <div>
                    <h2 style="margin: 0; color: var(--text-main); font-size: 1.6rem; font-weight: 700;">Meta Conectado</h2>
                    <div style="height: 3px; width: 50px; background: #10b981; margin: 10px auto; border-radius: 10px;"></div>
                    <p style="color: var(--text-muted); font-size: 1rem; margin-top: 15px; line-height: 1.6;">
                        Tu cuenta de <strong>WhatsApp Business</strong> está vinculada correctamente.
                    </p>
                </div>
                <div style="background: var(--bg-header); padding: 24px; border-radius: 20px; border: 1px solid var(--border); width: 100%; text-align: left;">
                    <h4 style="margin: 0 0 15px 0; color: #10b981; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 1.5px; font-weight: 700;">Detalles de la conexión:</h4>
                    <div style="font-size: 0.9rem; color: var(--text-main); line-height: 1.8;">
                        <div><strong>WABA ID:</strong> ${config.waba_id}</div>
                        <div><strong>ID de Teléfono:</strong> ${config.phone_number_id}</div>
                        ${config.verified_name ? `<div><strong>Nombre:</strong> ${config.verified_name}</div>` : ''}
                    </div>
                </div>
                <button class="btn-primary w-full" onclick="navigate('/meta');" style="margin-top: 20px;">
                    <i class="fas fa-layer-group"></i> Abrir Envío Masivo
                </button>
                <button class="btn-secondary w-full" onclick="launchMetaOnboarding()" style="margin-top:10px;">
                    Actualizar Configuración
                </button>
            `;
        } else {
            window.isMetaConnected = false;
            if (content && !content.querySelector('.fab.fa-meta')) {
                content.innerHTML = `
                    <div style="color: #0668E1; font-size: 4rem; margin-top: 40px; margin-bottom: 20px;">
                        <i class="fas fa-infinity"></i>
                    </div>
                    <div>
                        <h2 style="margin: 0; color: var(--text-main); font-size: 1.6rem; font-weight: 700;">Conexión Oficial</h2>
                        <div style="height: 3px; width: 50px; background: #0668E1; margin: 10px auto; border-radius: 10px;"></div>
                        <p style="color: var(--text-muted); font-size: 1rem; margin-top: 15px; line-height: 1.6;">
                            Conecta tu cuenta de <strong>WhatsApp Business</strong> oficial para habilitar funciones profesionales.
                        </p>
                    </div>
                    <div style="background: var(--bg-header); padding: 24px; border-radius: 20px; border: 1px solid var(--border); width: 100%; text-align: left;">
                        <h4 style="margin: 0 0 15px 0; color: #0668E1; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 1.5px; font-weight: 700;">Beneficios activos:</h4>
                        <ul style="font-size: 0.9rem; padding-left: 20px; color: var(--text-main); line-height: 2.2;">
                            <li>Integración por <strong>Coexistencia</strong>.</li>
                            <li>Registro via <strong>Popup de Facebook</strong>.</li>
                            <li>Envío de <strong>Mensajes Masivos (HSM)</strong>.</li>
                            <li>Soporte para <strong>Imágenes y Audios</strong> oficiales.</li>
                        </ul>
                    </div>
                    <button class="btn-primary w-full" onclick="launchMetaOnboarding()" style="margin-top: 20px;">
                        <i class="fab fa-meta"></i> Vincular con Meta Cloud API
                    </button>
                `;
            }
        }
    } catch (_) { /* silencioso */ }
}

async function updateMetaNavButton() {
    const navBtn = document.getElementById('nav-meta-btn');
    if (!navBtn) return;

    try {
        const activeToken = localStorage.getItem('system_config_token') || localStorage.getItem('backoffice_token');
        if (!activeToken) return;

        const res = await fetch(`/api/backoffice/whatsapp/config?token=${activeToken}`);
        const data = await res.json();

        // Si hay una configuración activa de Meta (WABA / Token)
        if (data && data.config && data.config.access_token) {
            // icon.className = 'fas fa-layer-group'; // Comentado para evitar cambios no deseados de iconos
            navBtn.title = "Meta Info & Envio Masivo";
            // Opcional: Cambiar color o añadir un indicador si lo deseas
            navBtn.style.color = '#10b981'; // Un verde esmeralda para indicar "activo/masivo"
        }
    } catch (e) {
        console.error('[CRM-Common] Error al verificar estado de Meta:', e);
    }
}

// --- Lógica de Configuración CRM ---
window.crmConfig = [
    { id: 'crm-ticket-title', label: 'Titulo del Ticket', visible: true, order: 0 },
    { id: 'crm-name', label: 'Nombre del Contacto', visible: true, order: 1 },
    { id: 'crm-phone', label: 'Teléfono', visible: true, order: 2 },
    { id: 'crm-cuit', label: 'Cuil / Cuit / DNI', visible: true, order: 3 },
    { id: 'crm-email', label: 'Correo Electrónico', visible: true, order: 4 },
    { id: 'crm-address', label: 'Domicilio', visible: true, order: 5 },
    { id: 'crm-tax-status', label: 'Situación Impositiva', visible: true, order: 6 },
    { id: 'crm-product', label: 'Producto Ofrecido', visible: true, order: 7 },
    { id: 'crm-source', label: 'Fuente / Canal', visible: true, order: 8 },
    { id: 'crm-notes', label: 'Historial de Notas', visible: true, order: 9 },
    { id: 'crm-due-date', label: 'Fecha Alerta / Seguimiento', visible: true, order: 10 },
    { id: 'crm-priority', label: 'Prioridad', visible: true, order: 11 },
    { id: 'crm-status', label: 'Estado del Lead (CRM)', visible: true, order: 12 }
];

window.fetchCRMConfig = async () => {
    const token = localStorage.getItem('backoffice_token');
    if (!token) return;
    try {
        const res = await fetch(`/api/backoffice/get-setting?key=CRM_FIELDS_CONFIG&token=${token}`);
        const data = await res.json();
        if (data.success && data.value) {
            window.crmConfig = JSON.parse(data.value);
        }
    } catch (e) {
        console.error('[CRM Config] Error fetching:', e);
    }
};

window.applyCRMConfig = () => {
    const container = document.getElementById('crm-fields-container');
    if (!container) return;

    window.crmConfig.forEach(f => {
        const el = container.querySelector(`[data-field="${f.id}"]`);
        if (el) {
            el.style.order = f.order;
            el.style.display = f.visible ? 'flex' : 'none';
        }
    });
};

window.toggleCRMConfigModal = () => {
    const modal = document.getElementById('crm-config-modal');
    modal.classList.toggle('active');
    if (modal.classList.contains('active')) {
        window.renderCRMConfigFields();
    }
};

window.saveCRMConfig = async () => {
    const activeToken = localStorage.getItem('backoffice_token');
    try {
        const res = await fetch(`/api/backoffice/save-setting?token=${activeToken}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                key: 'CRM_FIELDS_CONFIG',
                value: JSON.stringify(window.crmConfig)
            })
        });
        if (res.ok) {
            if (typeof window.showToast === 'function') window.showToast('Configuración guardada', 'success');
            window.toggleCRMConfigModal();
            window.applyCRMConfig();
            if (typeof window.distributeCards === 'function') {
                window.distributeCards();
            }
        }
    } catch (e) {
        console.error(e);
    }
}

window.renderCRMConfigFields = () => {
    const list = document.getElementById('crm-fields-list');
    if (!list) return;

    list.innerHTML = '';
    window.crmConfig.sort((a, b) => a.order - b.order).forEach((field, index) => {
        const item = document.createElement('div');
        item.className = 'sortable-item';
        item.dataset.id = field.id;
        item.dataset.index = index;
        
        item.innerHTML = `
            <i class="fas fa-grip-lines sort-handle"></i>
            <div style="flex:1; display:flex; align-items:center; gap:10px;">
                <input type="checkbox" ${field.visible ? 'checked' : ''} onchange="window.updateFieldVisibility('${field.id}', this.checked)">
                <span style="font-size:0.9rem; font-weight:600;">${field.label}</span>
            </div>
        `;

        list.appendChild(item);
    });

    if (typeof Sortable !== 'undefined' && !Sortable.get(list)) {
        new Sortable(list, {
            animation: 150,
            handle: '.sort-handle',
            onEnd: () => {
                const newOrder = Array.from(list.children).map(child => child.dataset.id);
                newOrder.forEach((id, index) => {
                    const field = window.crmConfig.find(f => f.id === id);
                    if (field) field.order = index;
                });
            }
        });
    }
}

window.updateFieldVisibility = (id, visible) => {
    const field = window.crmConfig.find(f => f.id === id);
    if (field) field.visible = visible;
};

// ── Sidebar toggle ────────────────────────────────────────────────
function _clearFlyoutStyles() {
    document.querySelectorAll('#navbar .nav-dropdown-menu').forEach(m => {
        m.classList.remove('flyout-active');
    });
}

function _setSidebarCollapsed(collapsed) {
    const nav = document.getElementById('navbar');
    if (!nav) return;
    _closeAllNavDropdowns();
    const forceCollapsed = window.innerWidth > 1024;
    const nextCollapsed = forceCollapsed ? true : collapsed;
    nav.classList.toggle('collapsed', nextCollapsed);
    document.body.classList.toggle('sidebar-collapsed', nextCollapsed);
    localStorage.setItem('sidebar-collapsed', '1');
    _clearFlyoutStyles();
}

function _initFlyoutHover() {
    document.querySelectorAll('#navbar .nav-item').forEach(item => {
        const link = item.querySelector(':scope > .nav-link');
        const menu = item.querySelector(':scope > .nav-dropdown-menu');
        if (!link || !menu) return;
        let _t = null;
        const show = () => {
            const nav = document.getElementById('navbar');
            if (!nav || !nav.classList.contains('collapsed')) return;
            if (window.innerWidth <= 768) return;
            clearTimeout(_t);
            menu.classList.add('flyout-active');
        };
        const hide = (delay) => {
            clearTimeout(_t);
            _t = setTimeout(() => menu.classList.remove('flyout-active'), delay);
        };
        link.addEventListener('mouseenter', show);
        link.addEventListener('mouseleave', () => hide(120));
        menu.addEventListener('mouseenter', () => clearTimeout(_t));
        menu.addEventListener('mouseleave', () => hide(80));
    });
}

// Inicialización
document.addEventListener('DOMContentLoaded', async () => {
    initTheme();
    updateSystemConfigNavVisibility();
    highlightActiveNav();
    updateMetaNavButton();


    await window.fetchCRMConfig();
    window.applyCRMConfig();


    _setSidebarCollapsed(true);

    _initFlyoutHover();

    const mobileBtn = document.getElementById('sidebar-menu-btn');
    const nav = document.getElementById('navbar');
    if (mobileBtn && nav) {
        mobileBtn.addEventListener('click', () => {
            if (window.innerWidth > 1024) return;
            _closeAllNavDropdowns();
            _setSidebarCollapsed(!nav.classList.contains('collapsed'));
        });
    }

    // Mobile: cerrar sidebar al navegar a una seccion
    if (nav) {
        nav.addEventListener('click', (e) => {
            if (window.innerWidth > 768) return;
            const link = e.target.closest('.nav-link');
            if (!link) return;
            if (link.closest('.nav-item.nav-dropdown') && !link.classList.contains('nav-dropdown-link')) return;
            _setSidebarCollapsed(true);
        });
    }
});

window.autoFitColumns = () => {
    document.querySelectorAll('.kanban-column').forEach(col => {
        let maxCardWidth = 320;
        col.querySelectorAll('.kanban-card, .kanban-card-expanded').forEach(card => {
            const width = card.scrollWidth + 32;
            if (width > maxCardWidth) maxCardWidth = width;
        });
        const newWidth = Math.min(Math.max(maxCardWidth, 280), 800) + 'px';
        col.style.width = newWidth;
        if (col.dataset.id) {
            localStorage.setItem('col_width_' + col.dataset.id, newWidth);
        }
    });
    if (typeof window.showToast === 'function') window.showToast('Columnas autoajustadas', 'success');
};

window.observeKanbanColumn = (colEl, colId) => {
    const savedWidth = localStorage.getItem('col_width_' + colId);
    if (savedWidth) {
        colEl.style.width = savedWidth;
    }
    if (typeof window.ResizeObserver !== 'undefined') {
        const observer = new window.ResizeObserver(entries => {
            for (let entry of entries) {
                if (entry.target.style.width) {
                    localStorage.setItem('col_width_' + colId, entry.target.style.width);
                } else {
                    localStorage.setItem('col_width_' + colId, entry.contentRect.width + 'px');
                }
            }
        });
        observer.observe(colEl);
    }
};

window.resetColumnWidth = (colId, e) => {
    if (e) e.stopPropagation();
    localStorage.removeItem('col_width_' + colId);
    const col = document.querySelector(`.kanban-column-wrapper[data-id="${colId}"]`);
    if (col) {
        col.style.width = '445px';
    }
    if (typeof window.showToast === 'function') window.showToast('Tamaño de columna restaurado', 'success');
};

window.openNewUserModal = async () => {
    const modal = document.getElementById('modal-users');
    if (modal) modal.classList.add('active');
    await window.loadGlobalTeam();
};

window.loadGlobalTeam = async () => {
    try {
        const activeToken = localStorage.getItem('system_config_token') || localStorage.getItem('backoffice_token');
        if (!activeToken) return;
        const res = await fetch(`/api/backoffice/users?token=${activeToken}`);
        const teamUsers = await res.json();
        
        const list = document.getElementById('team-list-container');
        if (list) {
            list.innerHTML = `
                <style>
                    .user-card-item { display: flex; flex-direction: column; gap: 1rem; padding: 1rem; border-bottom: 1px solid var(--border); }
                    .user-card-item:last-child { border-bottom: none; }
                    .user-card-left { display: flex; align-items: center; justify-content: center; gap: 0.75rem; width: 100%; }
                    .user-card-avatar { display: none; }
                    .user-card-info { min-width: 0; text-align: center; }
                    .user-card-right { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.85rem; width: 100%; }
                    .user-card-csd { width: 100%; max-width: 280px; margin: 0 auto; }
                    .user-card-actions { display: flex; align-items: center; justify-content: center; gap: 0.5rem; width: 100%; }

                    @media (min-width: 640px) and (max-width: 1023px) {
                        .user-card-item { flex-direction: column; gap: 1.25rem; padding: 1.25rem; }
                        .user-card-left { justify-content: flex-start; }
                        .user-card-avatar { display: flex; align-items: center; justify-content: center; width: 42px; height: 42px; background: var(--bg); border-radius: 50%; color: var(--accent); flex-shrink: 0; }
                        .user-card-info { text-align: left; }
                        .user-card-right { flex-direction: row; align-items: center; justify-content: space-between; width: 100%; }
                        .user-card-csd { margin: 0; flex: 1; max-width: 320px; }
                        .user-card-actions { width: auto; justify-content: flex-end; }
                    }

                    @media (min-width: 1024px) {
                        .user-card-item { flex-direction: row; align-items: center; justify-content: space-between; gap: 1.5rem; padding: 1rem 1.25rem; }
                        .user-card-left { width: auto; justify-content: flex-start; }
                        .user-card-avatar { display: flex; align-items: center; justify-content: center; width: 40px; height: 40px; background: var(--bg); border-radius: 50%; color: var(--accent); flex-shrink: 0; }
                        .user-card-info { text-align: left; }
                        .user-card-right { flex-direction: row; align-items: center; justify-content: flex-end; width: auto; gap: 1rem; }
                        .user-card-csd { margin: 0; width: auto; min-width: 200px; }
                        .user-card-actions { width: auto; justify-content: flex-end; }
                    }
                </style>
            ` + (teamUsers.map(u => `
                <div class="user-card-item">
                    <div class="user-card-left">
                        <div class="user-card-avatar">
                            <i class="fas fa-user"></i>
                        </div>
                        <div class="user-card-info">
                            <strong style="color:var(--text); font-size: 1.05rem; display: block; text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">${u.username}</strong>
                            <div style="font-size: 0.75rem; color: var(--text-dim);">${u.role === 'admin' ? 'Administrador' : 'Operador'}</div>
                        </div>
                    </div>
                    <div class="user-card-right">
                        <div class="csd-wrap csd-sm user-card-csd">
                            <select hidden onchange="window.updateUserRole('${u.id}', this.value)">
                                <option value="subuser" ${u.role === 'subuser' ? 'selected' : ''}>Vendedor / Operador (Limitado)</option>
                                <option value="admin" ${u.role === 'admin' ? 'selected' : ''}>Administrador (Total)</option>
                            </select>
                            <button class="csd-btn w-full" type="button" onclick="_csdToggle(this)">
                                <span class="csd-label text-xs sm:text-sm truncate">${u.role === 'admin' ? 'Administrador (Total)' : 'Vendedor / Operador (Limitado)'}</span>
                                <i class="fas fa-chevron-down csd-chevron flex-shrink-0"></i>
                            </button>
                            <div class="csd-menu">
                                <button class="csd-item ${u.role === 'subuser' ? 'selected' : ''} text-xs sm:text-sm" type="button" data-val="subuser" onclick="_csdSelect(this,'subuser')">Vendedor / Operador (Limitado)</button>
                                <button class="csd-item ${u.role === 'admin' ? 'selected' : ''} text-xs sm:text-sm" type="button" data-val="admin" onclick="_csdSelect(this,'admin')">Administrador (Total)</button>
                            </div>
                        </div>
                        <div class="user-card-actions">
                            <button onclick="window.openEditUserModal('${u.id}', '${u.username}')" title="Editar Usuario" style="background: none; border: none; color: var(--accent); cursor: pointer; padding: 6px 14px; font-size: 16px; transition: opacity 0.2s;">
                                <i class="fas fa-pen"></i>
                            </button>
                            <button onclick="window.deleteUser('${u.id}')" title="Eliminar Usuario" style="background: none; border: none; color: #ef4444; cursor: pointer; padding: 6px 14px; font-size: 16px; transition: opacity 0.2s;">
                                <i class="fas fa-trash-alt"></i>
                            </button>
                        </div>
                    </div>
                </div>
            `).join('') || '<div style="padding: 30px; text-align: center; color: var(--text-dim);">No hay usuarios registrados</div>');
        }

        if (typeof window.loadTeam === 'function') {
            window.loadTeam();
        }
    } catch (e) {
        console.error('Error al cargar equipo global:', e);
    }
};

window.saveNewUser = async () => {
    const activeToken = localStorage.getItem('system_config_token') || localStorage.getItem('backoffice_token');
    const usernameEl = document.getElementById('new-user-name');
    const passwordEl = document.getElementById('new-user-pass');
    const roleEl = document.getElementById('new-user-role');
    
    if (!usernameEl || !passwordEl || !roleEl) return;
    
    const username = usernameEl.value.trim();
    const password = passwordEl.value.trim();
    const role = roleEl.value;

    if (!username || !password) {
        if (typeof window.showToast === 'function') window.showToast('Completa usuario y contraseña', 'warning');
        return;
    }

    try {
        const res = await fetch(`/api/backoffice/users?token=${activeToken}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password, role })
        });
        const data = await res.json();
        if (data.success) {
            if (typeof window.showToast === 'function') window.showToast('Usuario creado con éxito', 'success');
            usernameEl.value = '';
            passwordEl.value = '';
            await window.loadGlobalTeam();
        } else {
            if (typeof window.showToast === 'function') window.showToast('Error: ' + data.error, 'error');
        }
    } catch (e) {
        console.error(e);
        if (typeof window.showToast === 'function') window.showToast('Error de conexión', 'error');
    }
};

window.updateUserRole = async (id, role) => {
    const activeToken = localStorage.getItem('system_config_token') || localStorage.getItem('backoffice_token');
    try {
        const res = await fetch(`/api/backoffice/users/${id}?token=${activeToken}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ role })
        });
        const data = await res.json();
        if (data.success) {
            if (typeof window.showToast === 'function') window.showToast('Rol de usuario actualizado exitosamente', 'success');
            await window.loadGlobalTeam();
        } else {
            if (typeof window.showToast === 'function') window.showToast('Error: ' + data.error, 'error');
            await window.loadGlobalTeam();
        }
    } catch (e) {
        console.error(e);
        if (typeof window.showToast === 'function') window.showToast('Error de conexión', 'error');
    }
};

window.deleteUser = async (id) => {
    if (typeof Swal !== 'undefined') {
        const resSwal = await Swal.fire({
            title: '¿Eliminar usuario?',
            text: '¿Estás seguro de que deseas eliminar este usuario del equipo?',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            cancelButtonColor: '#6b7280',
            confirmButtonText: 'Sí, eliminar',
            cancelButtonText: 'Cancelar'
        });
        if (!resSwal.isConfirmed) return;
    } else {
        if (!confirm('¿Estás seguro de que deseas eliminar este usuario?')) return;
    }

    const activeToken = localStorage.getItem('system_config_token') || localStorage.getItem('backoffice_token');
    try {
        const res = await fetch(`/api/backoffice/users/${id}?token=${activeToken}`, {
            method: 'DELETE'
        });
        const data = await res.json();
        if (data.success) {
            if (typeof window.showToast === 'function') window.showToast('Usuario eliminado con éxito', 'success');
            await window.loadGlobalTeam();
        } else {
            if (typeof window.showToast === 'function') window.showToast('Error: ' + data.error, 'error');
        }
    } catch (e) {
        console.error(e);
        if (typeof window.showToast === 'function') window.showToast('Error de conexión', 'error');
    }
};

window.openEditUserModal = (id, username) => {
    const modal = document.getElementById('edit-user-modal');
    const idInput = document.getElementById('edit-user-id');
    const usernameInput = document.getElementById('edit-user-username');
    const passwordInput = document.getElementById('edit-user-password');
    if (!modal || !idInput || !usernameInput || !passwordInput) return;
    
    idInput.value = id;
    usernameInput.value = username;
    passwordInput.value = '';
    modal.style.display = 'flex';
};

window.closeEditUserModal = () => {
    const modal = document.getElementById('edit-user-modal');
    if (modal) modal.style.display = 'none';
};

window.saveEditUser = async () => {
    const activeToken = localStorage.getItem('system_config_token') || localStorage.getItem('backoffice_token');
    const id = document.getElementById('edit-user-id')?.value;
    const usernameEl = document.getElementById('edit-user-username');
    const passwordEl = document.getElementById('edit-user-password');
    if (!id || !usernameEl || !passwordEl) return;

    const username = usernameEl.value.trim();
    const password = passwordEl.value.trim();

    if (!username) {
        if (typeof window.showToast === 'function') window.showToast('El nombre de usuario no puede estar vacío', 'warning');
        return;
    }

    const updates = { username };
    if (password) updates.password = password;

    try {
        const res = await fetch(`/api/backoffice/users/${id}?token=${activeToken}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updates)
        });
        const data = await res.json();
        if (data.success) {
            if (typeof window.showToast === 'function') window.showToast('Usuario actualizado exitosamente', 'success');
            window.closeEditUserModal();
            await window.loadGlobalTeam();
        } else {
            if (typeof window.showToast === 'function') window.showToast('Error: ' + data.error, 'error');
        }
    } catch (e) {
        console.error(e);
        if (typeof window.showToast === 'function') window.showToast('Error de conexión', 'error');
    }
};
