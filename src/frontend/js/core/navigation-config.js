/* global navigate */
(function() {
    const APP_ROUTES = {
        '/conversaciones':           '/js/backoffice/backoffice.view.js',
        '/contactos':                '/js/contactos/contactos.view.js',
        '/dashboard':                '/js/dashboard/dashboard.view.js',
        '/conexion-chatbot':         '/js/conexion/conexion.view.js',
        '/conexion':                 '/js/conexion/conexion.view.js',
        '/crm':                      '/js/crm/crm.view.js',
        '/crm-tareas':               '/js/crm/crm-tareas.view.js',
        '/system-config':            '/js/system-config/system-config.view.js',
        '/docs':                     '/js/docs/docs.view.js',
        '/documentacion':            '/js/docs/docs.view.js',
        '/webchat':                  '/js/webchat/webchat.view.js',
        '/meta':                     '/js/meta/meta.view.js',
        '/mercado-libre':            '/js/mercado-libre/mercado-libre.view.js',
        '/mercado-libre-productos':  '/js/mercado-libre/mercado-libre-productos.view.js',
        '/mercado-libre-bot':        '/js/mercado-libre/mercado-libre-bot.view.js',
        '/mercado-pago':             '/js/mercado-libre/mercado-pago.view.js',
        '/lista-negra':              '/js/lista-negra/lista-negra.view.js',
        '/reportes':                 '/js/reportes/reportes.view.js',
        '/usuarios':                 '/js/usuarios/usuarios.view.js',
        '/webhooks':                 '/js/webhook-config/webhook-config.view.js',
        '/epc-cbu-cvu':              '/js/epc-cbu-cvu/epc-cbu-cvu.view.js',
    };

    const SECTION_TAB_CONFIG = {
        messaging: [
            { label: 'Dashboard', icon: 'fas fa-chart-simple', route: '/dashboard' },
            { label: 'Conversaciones', icon: 'fas fa-comments', route: '/conversaciones', dotId: 'dot-conversaciones', requires: 'backoffice' },
            { label: 'Contactos', icon: 'fas fa-user-group', route: '/contactos', requires: 'backoffice' },
            { label: 'Reportes', icon: 'fas fa-file-lines', route: '/reportes', dotId: 'dot-reportes' },
            { label: 'Conexión & Chatbot', icon: 'fas fa-plug-circle-bolt', route: '/conexion-chatbot', matchRoutes: ['/conexion', '/conexion-chatbot'] },
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

    function sectionTabVisible(tab) {
        if (tab.requires === 'backoffice') return window.__BACKOFFICE_VISIBLE !== false;
        if (tab.requires === 'crm') return window.__CRM_VISIBLE !== false;
        if (tab.requires === 'system_config') return window.__SYSTEM_CONFIG_VISIBLE !== false;
        if (tab.requires === 'epc') return window.__EPC_VISIBLE === true;
        return true;
    }

    function isConversationsPath(value) {
        return value === '/conversaciones';
    }

    function sectionTabActive(tab, path, params) {
        if (tab.activePanel) return isConversationsPath(path) && params.get('openPanel') === tab.activePanel;
        if (Array.isArray(tab.matchRoutes) && tab.matchRoutes.includes(path)) return true;
        if (!tab.route) return false;
        if (tab.route === '/docs') return path === '/docs' || path === '/documentacion';
        if (isConversationsPath(tab.route)) return isConversationsPath(path) && !params.get('openPanel');
        return tab.route === path;
    }

    function sidebarDotMarkup(dotId) {
        return dotId ? `<span class="nav-dot nav-dropdown-dot" id="${dotId}" style="display:none;"></span>` : '';
    }

    function sidebarDropdownItem(tab, child = false) {
        const route = tab.route || '';
        const matchRoutes = Array.isArray(tab.matchRoutes) ? tab.matchRoutes.join(',') : '';
        return `
            <li class="nav-item${child ? ' nav-dropdown-child-item' : ''}" data-route="${route}" data-match-routes="${matchRoutes}">
                <a href="#" class="nav-link nav-dropdown-link${child ? ' nav-dropdown-child-link' : ''}" data-nav-label="${tab.label}" aria-label="${tab.label}" onclick="event.preventDefault(); navigate('${route}')">
                    <i class="${tab.icon}"></i>
                    <span class="nav-label">${tab.label}</span>
                    ${sidebarDotMarkup(tab.dotId)}
                </a>
            </li>
        `;
    }

    function slugifyNavLabel(label) {
        return String(label || '')
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');
    }

    function sidebarDropdownGroup(tab) {
        const children = (tab.children || []).filter(sectionTabVisible);
        const groupId = `nav-${slugifyNavLabel(tab.label)}-sub`;
        return `
            <li class="nav-item nav-dropdown-group" id="${groupId}" data-match-routes="${Array.isArray(tab.matchRoutes) ? tab.matchRoutes.join(',') : ''}">
                <button type="button" class="nav-link nav-dropdown-link nav-dropdown-group-title" data-nav-label="${tab.label}" aria-label="${tab.label}" onclick="window.toggleSidebarSubMenu(event, '${groupId}')">
                    <i class="${tab.icon}"></i>
                    <span class="nav-label">${tab.label}</span>
                    <i class="fas fa-chevron-right nav-dropdown-group-icon"></i>
                </button>
                <ul class="nav-sub-dropdown-menu">
                    ${children.map(child => sidebarDropdownItem(child, true)).join('')}
                </ul>
            </li>
        `;
    }

    function renderSidebarSectionMenu(section, title) {
        const containerId = section === 'messaging' ? 'nav-messaging-btn' : 'nav-integraciones-btn';
        const container = document.getElementById(containerId);
        const menu = container?.querySelector(':scope > .nav-dropdown-menu');
        if (!menu) return;

        const tabs = (SECTION_TAB_CONFIG[section] || []).filter(sectionTabVisible);
        menu.innerHTML = `
            <li class="nav-item"><span class="nav-link nav-dropdown-title">${title}</span></li>
            ${tabs.map(tab => Array.isArray(tab.children) && tab.children.length ? sidebarDropdownGroup(tab) : sidebarDropdownItem(tab)).join('')}
        `;
    }

    function setSidebarDropdownOpen(container, open) {
        if (!container) return;
        const menu = container.querySelector(':scope > .nav-dropdown-menu');
        if (!menu) return;
        container.classList.toggle('open', open);
        menu.style.height = open ? `${menu.scrollHeight}px` : '0';
    }

    function pathMatchesSidebarSection(section, path) {
        const tabs = (SECTION_TAB_CONFIG[section] || []).filter(sectionTabVisible);
        return tabs.some(tab => {
            if (tab.route === path) return true;
            if (Array.isArray(tab.matchRoutes) && tab.matchRoutes.includes(path)) return true;
            if (!Array.isArray(tab.children)) return false;
            return tab.children.some(child => child.route === path || (Array.isArray(child.matchRoutes) && child.matchRoutes.includes(path)));
        });
    }

    function sectionTabAriaLabel(section) {
        if (section === 'messaging') return 'Gestion';
        if (section === 'integrations') return 'Integraciones';
        if (section === 'settings') return 'Ajustes';
        return 'Seccion';
    }

    function getSectionTabMenuHost() {
        let host = document.getElementById('section-tab-menu-host');
        if (!host) {
            host = document.createElement('div');
            host.id = 'section-tab-menu-host';
            document.body.appendChild(host);
        }
        return host;
    }

    function projectInitials(name) {
        const cleanName = String(name || '').replace(/{{|}}/g, '').trim();
        const words = cleanName
            .split(/[^A-Za-z0-9]+/)
            .map(word => word.trim())
            .filter(Boolean);
        const relevantWords = words.filter(word => !['bot', 'railway'].includes(word.toLowerCase()));
        const source = relevantWords.length ? relevantWords : words;
        const initials = source.slice(0, 2).map(word => word.charAt(0).toUpperCase()).join('');
        return initials || 'NL';
    }

    function initDesktopProjectAvatar() {
        const avatar = document.getElementById('desktop-project-avatar');
        if (!avatar) return;
        const name = avatar.dataset.projectName || avatar.textContent || '';
        avatar.textContent = projectInitials(name);
    }

    function escapeHtml(value) {
        return String(value ?? '').replace(/[&<>"']/g, (char) => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;',
        }[char]));
    }

    function closeDesktopLineMenu() {
        const menu = document.getElementById('desktop-line-menu');
        const button = document.getElementById('desktop-line-selector-btn');
        if (menu) menu.classList.remove('open');
        if (button) button.setAttribute('aria-expanded', 'false');
    }

    function setDesktopLineEmpty() {
        const button = document.getElementById('desktop-line-selector-btn');
        const label = document.getElementById('desktop-line-selector-label');
        const status = document.getElementById('desktop-line-menu-status');
        if (button) button.classList.remove('is-loading');
        if (label) label.textContent = 'Sin linea vinculada';
        if (status) status.innerHTML = '<span class="desktop-line-menu-empty">Sin linea vinculada</span>';
    }

    async function refreshDesktopLineSelector() {
        const button = document.getElementById('desktop-line-selector-btn');
        const label = document.getElementById('desktop-line-selector-label');
        const status = document.getElementById('desktop-line-menu-status');
        if (!label || !status) return;

        const token = localStorage.getItem('backoffice_token');
        if (!token) {
            setDesktopLineEmpty();
            return;
        }

        if (button) button.classList.add('is-loading');
        label.textContent = 'Cargando linea';
        status.innerHTML = '<span class="desktop-line-menu-empty">Cargando linea...</span>';

        try {
            const response = await fetch(`/api/backoffice/whatsapp/lines?token=${encodeURIComponent(token)}`);
            const data = await response.json();
            const lines = Array.isArray(data.lines) ? data.lines : [];
            const line = data.activeLine || lines[0] || null;

            if (!line) {
                setDesktopLineEmpty();
                return;
            }

            const number = line.displayNumber || line.number || 'Linea vinculada';
            const provider = line.provider ? `Via ${line.provider}` : 'Linea vinculada';
            if (button) button.classList.remove('is-loading');
            label.textContent = number;
            status.innerHTML = `
                <span class="desktop-line-menu-primary">${escapeHtml(number)}</span>
                <span class="desktop-line-menu-secondary">${escapeHtml(provider)}</span>
            `;
        } catch {
            setDesktopLineEmpty();
        }
    }

    function updateThemeNavState(theme) {
        const isDark = theme === 'dark';
        const cb = document.getElementById('theme-toggle-input');
        if (cb) cb.checked = isDark;

        document.querySelectorAll('#theme-mode-icon, #desktop-theme-icon').forEach(icon => {
            icon.classList.toggle('fa-sun', !isDark);
            icon.classList.toggle('fa-moon', isDark);
        });
        const desktopThemeBtn = document.getElementById('desktop-theme-btn');
        if (desktopThemeBtn) desktopThemeBtn.classList.remove('active');

        const flyoutLabel = document.getElementById('theme-flyout-label');
        if (flyoutLabel) flyoutLabel.textContent = isDark ? 'Tema: Oscuro' : 'Tema: Claro';

        const desktopLabel = document.getElementById('desktop-theme-label');
        if (desktopLabel) desktopLabel.textContent = isDark ? 'Tema: Oscuro' : 'Tema: Claro';
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
        const enabled = window.__SYSTEM_CONFIG_VISIBLE !== false;
        const isSuperAdmin = localStorage.getItem('is_superadmin') === 'true';
        const canShow = enabled && isSuperAdmin;
        if (navItem) {
            navItem.classList.toggle('hidden-item', !canShow);
            navItem.style.display = canShow ? '' : 'none';
        }
        const accountItem = document.getElementById('desktop-system-config-account-item');
        if (accountItem) {
            accountItem.style.display = canShow ? '' : 'none';
        }
    }

    function logout() {
        localStorage.removeItem('backoffice_token');
        localStorage.removeItem('system_config_token');
        localStorage.removeItem('is_superadmin');
        localStorage.removeItem('user_role');
        localStorage.removeItem('user_id');
        localStorage.removeItem('user_name');
        window.location.href = '/login';
    }

    window.__APP_ROUTES = APP_ROUTES;
    window.__NAV_SECTION_TAB_CONFIG = SECTION_TAB_CONFIG;
    window.__NAV_SECTION_TAB_VISIBLE = sectionTabVisible;
    window.__NAV_SECTION_TAB_ACTIVE = sectionTabActive;
    window.initTheme = initTheme;
    window.toggleTheme = toggleTheme;
    window.updateSystemConfigNavVisibility = updateSystemConfigNavVisibility;
    window.refreshDesktopLineSelector = refreshDesktopLineSelector;
    window.logout = logout;

    function closeDesktopAccountMenu() {
        const menu = document.getElementById('desktop-account-menu');
        const avatar = document.getElementById('desktop-project-avatar');
        if (menu) menu.classList.remove('open');
        if (avatar) avatar.setAttribute('aria-expanded', 'false');
    }

    window.toggleDesktopAccountMenu = function(e) {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }
        closeDesktopLineMenu();
        const menu = document.getElementById('desktop-account-menu');
        const avatar = document.getElementById('desktop-project-avatar');
        if (!menu || !avatar) return;
        const open = !menu.classList.contains('open');
        menu.classList.toggle('open', open);
        avatar.setAttribute('aria-expanded', open ? 'true' : 'false');
    };

    window.toggleDesktopLineMenu = function(e) {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }
        closeDesktopAccountMenu();
        const menu = document.getElementById('desktop-line-menu');
        const button = document.getElementById('desktop-line-selector-btn');
        if (!menu || !button) return;
        const open = !menu.classList.contains('open');
        menu.classList.toggle('open', open);
        button.setAttribute('aria-expanded', open ? 'true' : 'false');
    };

    window.showAddLineSoon = function(e) {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }
        closeDesktopLineMenu();
        if (window.Swal) {
            window.Swal.fire({
                title: 'Proximamente',
                text: 'Esta funcion estara disponible pronto.',
                icon: 'info',
                confirmButtonText: 'Aceptar',
                buttonsStyling: false,
                customClass: {
                    popup: 'app-standard-swal',
                    title: 'app-standard-swal-title',
                    htmlContainer: 'app-standard-swal-html',
                    actions: 'app-standard-swal-actions',
                    confirmButton: 'app-standard-swal-confirm'
                }
            });
        } else if (typeof window.showToast === 'function') {
            window.showToast('Proximamente', 'info');
        }
    };

    window.navigateFromDesktopAccount = function(route) {
        closeDesktopAccountMenu();
        navigate(route);
    };

    window.renderDesktopSidebarMenus = function() {
        renderSidebarSectionMenu('messaging', 'Gestion');
        renderSidebarSectionMenu('integrations', 'Integraciones');
        if (typeof window.applyCachedNotificationDots === 'function') window.applyCachedNotificationDots();
    };

    window.syncSidebarDropdownState = function(path = window.location.pathname) {
        const nav = document.getElementById('navbar');
        if (!nav || nav.classList.contains('collapsed') || window.innerWidth <= 1023) return;
        setSidebarDropdownOpen(document.getElementById('nav-messaging-btn'), true);
        setSidebarDropdownOpen(document.getElementById('nav-integraciones-btn'), true);
        document.getElementById('nav-messaging-btn')?.classList.toggle('active', pathMatchesSidebarSection('messaging', path));
        document.getElementById('nav-integraciones-btn')?.classList.toggle('active', pathMatchesSidebarSection('integrations', path));
    };

    window.expandDesktopSidebarSections = function() {
        const nav = document.getElementById('navbar');
        if (!nav || nav.classList.contains('collapsed') || window.innerWidth <= 1023) return;
        setSidebarDropdownOpen(document.getElementById('nav-messaging-btn'), true);
        setSidebarDropdownOpen(document.getElementById('nav-integraciones-btn'), true);
    };

    window.toggleSidebarDropdown = function(e, containerId) {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }
        const nav = document.getElementById('navbar');
        const container = document.getElementById(containerId);
        if (!nav || !container) return;

        if (nav.classList.contains('collapsed')) {
            if (containerId === 'nav-messaging-btn') window.navigateToLastSectionRoute('messaging');
            if (containerId === 'nav-integraciones-btn') window.navigateToLastSectionRoute('integrations');
            return;
        }

        if (window.innerWidth > 1023) {
            window.expandDesktopSidebarSections();
            return;
        }

        setSidebarDropdownOpen(container, !container.classList.contains('open'));
    };

    function closeAllNavDropdowns() {
        document.querySelectorAll('#navbar .nav-dropdown.open').forEach(el => {
            setSidebarDropdownOpen(el, false);
        });
    }

    window.toggleMessagingFlyout = function(e) {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }
        const container = document.getElementById('nav-messaging-btn');
        if (!container) return;
        const isOpen = container.classList.contains('open');
        closeAllNavDropdowns();
        if (!isOpen) setSidebarDropdownOpen(container, true);
    };

    window.closeMessagingFlyout = function() {
        setSidebarDropdownOpen(document.getElementById('nav-messaging-btn'), false);
    };

    window.toggleIntegracionesFlyout = function(e) {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }
        const container = document.getElementById('nav-integraciones-btn');
        if (!container) return;
        const isOpen = container.classList.contains('open');
        closeAllNavDropdowns();
        if (!isOpen) setSidebarDropdownOpen(container, true);
    };

    window.closeIntegracionesFlyout = function() {
        setSidebarDropdownOpen(document.getElementById('nav-integraciones-btn'), false);
    };

    window.toggleSidebarSubMenu = function(e, groupId) {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }
        const container = document.getElementById(groupId);
        if (!container) return;
        const menu = container.querySelector('.nav-sub-dropdown-menu');
        if (!menu) return;
        const chevron = container.querySelector('.nav-sub-dropdown-icon');
        const isOpen = container.classList.contains('open');
        container.classList.toggle('open', !isOpen);
        menu.style.height = isOpen ? '0' : `${menu.scrollHeight}px`;
        if (chevron) chevron.style.transform = isOpen ? 'rotate(0deg)' : 'rotate(180deg)';
    };
    window.toggleMeliSubMenu = (e) => window.toggleSidebarSubMenu(e, 'nav-mercado-libre-sub');

    function clearFlyoutStyles() {
        document.querySelectorAll('#navbar .nav-dropdown-menu').forEach(menu => {
            menu.classList.remove('flyout-active');
        });
        hideCollapsedNavTooltip();
        hideCollapsedSubMenu();
    }

    function setSidebarCollapsed(collapsed) {
        const nav = document.getElementById('navbar');
        if (!nav) return;
        const nextCollapsed = Boolean(collapsed);
        nav.classList.toggle('collapsed', nextCollapsed);
        document.body.classList.toggle('sidebar-collapsed', nextCollapsed);
        localStorage.setItem('sidebar-collapsed', nextCollapsed ? '1' : '0');
        const toggle = document.getElementById('sidebar-toggle-btn');
        if (toggle) {
            toggle.setAttribute('aria-expanded', nextCollapsed ? 'false' : 'true');
            toggle.setAttribute('aria-label', nextCollapsed ? 'Expandir menu' : 'Contraer menu');
        }
        if (nextCollapsed) closeAllNavDropdowns();
        else {
            window.expandDesktopSidebarSections();
            window.syncSidebarDropdownState();
        }
        clearFlyoutStyles();
    }

    function initFlyoutHover() {
        document.querySelectorAll('#navbar .nav-item').forEach(item => {
            const link = item.querySelector(':scope > .nav-link');
            const menu = item.querySelector(':scope > .nav-dropdown-menu');
            if (!link || !menu) return;
            let timeoutId = null;
            const show = () => {
                const nav = document.getElementById('navbar');
                if (!nav || !nav.classList.contains('collapsed')) return;
                if (window.innerWidth <= 768) return;
                clearTimeout(timeoutId);
                menu.classList.add('flyout-active');
            };
            const hide = (delay) => {
                clearTimeout(timeoutId);
                timeoutId = setTimeout(() => menu.classList.remove('flyout-active'), delay);
            };
            link.addEventListener('mouseenter', show);
            link.addEventListener('mouseleave', () => hide(120));
            menu.addEventListener('mouseenter', () => clearTimeout(timeoutId));
            menu.addEventListener('mouseleave', () => hide(80));
        });
    }

    function getCollapsedNavTooltip() {
        let tooltip = document.getElementById('nav-collapsed-tooltip');
        if (!tooltip) {
            tooltip = document.createElement('div');
            tooltip.id = 'nav-collapsed-tooltip';
            tooltip.className = 'nav-collapsed-tooltip';
            document.body.appendChild(tooltip);
        }
        return tooltip;
    }

    function hideCollapsedNavTooltip() {
        const tooltip = document.getElementById('nav-collapsed-tooltip');
        if (tooltip) tooltip.classList.remove('open');
    }

    function showCollapsedNavTooltip(link) {
        const nav = document.getElementById('navbar');
        if (!nav || !nav.classList.contains('collapsed') || window.innerWidth <= 1023) return;
        if (link.classList.contains('nav-dropdown-group-title')) return;
        const label = link.dataset.navLabel || link.querySelector('.nav-label')?.textContent?.trim();
        if (!label) return;
        const tooltip = getCollapsedNavTooltip();
        const rect = link.getBoundingClientRect();
        tooltip.textContent = label;
        tooltip.style.top = `${rect.top + (rect.height / 2)}px`;
        tooltip.classList.add('open');
    }

    let collapsedSubMenuHideTimeout = null;

    function hideCollapsedSubMenu(delay = 0) {
        clearTimeout(collapsedSubMenuHideTimeout);
        if (delay > 0) {
            collapsedSubMenuHideTimeout = setTimeout(() => hideCollapsedSubMenu(0), delay);
            return;
        }
        document.querySelectorAll('.nav-sub-dropdown-menu.nav-submenu-flyout-active').forEach(menu => {
            menu.classList.remove('nav-submenu-flyout-active');
            menu.style.left = '';
            menu.style.top = '';
            const sourceId = menu.dataset.flyoutSourceId;
            const source = sourceId ? document.getElementById(sourceId) : null;
            if (source && menu.parentElement !== source) {
                source.appendChild(menu);
            }
            delete menu.dataset.flyoutSourceId;
        });
    }

    function showCollapsedSubMenu(group) {
        const nav = document.getElementById('navbar');
        if (!nav || !nav.classList.contains('collapsed') || window.innerWidth <= 1023) return;
        const menu = group.querySelector(':scope > .nav-sub-dropdown-menu');
        const trigger = group.querySelector(':scope > .nav-dropdown-group-title');
        if (!menu || !trigger) return;
        clearTimeout(collapsedSubMenuHideTimeout);
        const navRect = nav.getBoundingClientRect();
        const triggerRect = trigger.getBoundingClientRect();
        menu.dataset.flyoutSourceId = group.id;
        if (menu.parentElement !== document.body) {
            document.body.appendChild(menu);
        }
        menu.style.left = `${navRect.right}px`;
        menu.style.top = `${Math.max(8, Math.min(triggerRect.top, window.innerHeight - menu.scrollHeight - 8))}px`;
        menu.classList.add('nav-submenu-flyout-active');
        hideCollapsedNavTooltip();
    }

    function initCollapsedNavOverlays() {
        const nav = document.getElementById('navbar');
        if (!nav || nav.dataset.collapsedOverlaysBound === 'true') return;
        nav.dataset.collapsedOverlaysBound = 'true';

        nav.addEventListener('mouseover', (e) => {
            const group = e.target.closest('.nav-dropdown-group');
            if (group && nav.contains(group)) {
                showCollapsedSubMenu(group);
                return;
            }
            const link = e.target.closest('.nav-link[data-nav-label]');
            if (link && nav.contains(link)) showCollapsedNavTooltip(link);
        });

        nav.addEventListener('mouseout', (e) => {
            const group = e.target.closest('.nav-dropdown-group');
            if (group && nav.contains(group) && !group.contains(e.relatedTarget)) hideCollapsedSubMenu(160);
            const link = e.target.closest('.nav-link[data-nav-label]');
            if (link && nav.contains(link) && !link.contains(e.relatedTarget)) hideCollapsedNavTooltip();
        });

        nav.addEventListener('focusin', (e) => {
            const group = e.target.closest('.nav-dropdown-group');
            if (group && nav.contains(group)) {
                showCollapsedSubMenu(group);
                return;
            }
            const link = e.target.closest('.nav-link[data-nav-label]');
            if (link && nav.contains(link)) showCollapsedNavTooltip(link);
        });

        nav.addEventListener('focusout', () => {
            hideCollapsedNavTooltip();
            hideCollapsedSubMenu();
        });

        nav.addEventListener('scroll', () => {
            hideCollapsedNavTooltip();
            hideCollapsedSubMenu();
        });

        document.addEventListener('mouseover', (e) => {
            const menu = e.target.closest('.nav-sub-dropdown-menu.nav-submenu-flyout-active');
            if (menu) {
                clearTimeout(collapsedSubMenuHideTimeout);
                hideCollapsedNavTooltip();
            }
        });

        document.addEventListener('mouseout', (e) => {
            const menu = e.target.closest('.nav-sub-dropdown-menu.nav-submenu-flyout-active');
            if (menu && !menu.contains(e.relatedTarget)) hideCollapsedSubMenu(80);
        });
    }

    document.addEventListener('DOMContentLoaded', () => {
        initTheme();
        updateSystemConfigNavVisibility();
        initDesktopProjectAvatar();
        refreshDesktopLineSelector();
        window.renderDesktopSidebarMenus();
        window.expandDesktopSidebarSections();
        if (typeof window.highlightActiveNav === 'function') window.highlightActiveNav(window.location.pathname);

        const savedCollapsed = localStorage.getItem('sidebar-collapsed');
        setSidebarCollapsed(savedCollapsed !== '0');
        initFlyoutHover();
        initCollapsedNavOverlays();

        const sidebarToggle = document.getElementById('sidebar-toggle-btn');
        const desktopNav = document.getElementById('navbar');
        if (sidebarToggle && desktopNav) {
            sidebarToggle.addEventListener('click', (e) => {
                e.preventDefault();
                setSidebarCollapsed(!desktopNav.classList.contains('collapsed'));
            });
        }

        const mobileBtn = document.getElementById('sidebar-menu-btn');
        const nav = document.getElementById('navbar');
        if (mobileBtn && nav && !window.navigationRouter) {
            mobileBtn.addEventListener('click', () => {
                if (window.innerWidth > 1024) return;
                closeAllNavDropdowns();
                setSidebarCollapsed(!nav.classList.contains('collapsed'));
            });
        }

        if (nav && !window.navigationRouter) {
            nav.addEventListener('click', (e) => {
                if (window.innerWidth > 768) return;
                const link = e.target.closest('.nav-link');
                if (!link) return;
                if (link.closest('.nav-item.nav-dropdown') && !link.classList.contains('nav-dropdown-link')) return;
                setSidebarCollapsed(true);
            });
        }
    });

    window.renderSectionTabs = function(section, options = {}) {
        if (window.__PERSISTENT_SECTION_HEADER && !options.persistent) return '';

        const tabs = SECTION_TAB_CONFIG[section] || [];
        const path = window.location.pathname;
        const params = new URLSearchParams(window.location.search);
        const visibleTabs = tabs.filter(sectionTabVisible);

        if (!visibleTabs.length) return '';

        return `
            <nav class="docs-nav section-tabs no-print" role="tablist" aria-label="${sectionTabAriaLabel(section)}">
                ${visibleTabs.map((tab, index) => {
                    const active = sectionTabActive(tab, path, params) ? ' active' : '';
                    const onclick = tab.action || `navigate('${tab.route}')`;
                    const route = tab.route || '';
                    const panel = tab.activePanel || '';
                    const dot = tab.dotId
                        ? `<span class="nav-dot section-tab-dot" id="${tab.dotId}" style="display:inline-block; visibility:hidden; opacity:0;" data-visible="false"></span>`
                        : '<span class="section-tab-dot section-tab-dot-placeholder" aria-hidden="true"></span>';
                    const matchRoutes = Array.isArray(tab.matchRoutes) ? tab.matchRoutes.join(',') : '';
                    if (Array.isArray(tab.children) && tab.children.length) {
                        const menuId = `section-tab-menu-${section}-${index}`;
                        const children = tab.children.filter(sectionTabVisible);
                        return `
                            <span class="section-tab-group${active}" data-section-tab-group>
                                <button class="docs-nav-tab section-tab section-tab-dropdown-toggle${active}" data-route="${route}" data-panel="${panel}" data-match-routes="${matchRoutes}" onclick="toggleSectionTabMenu(event, '${menuId}')" role="tab" aria-haspopup="menu" aria-expanded="false">
                                    <i class="${tab.icon}"></i><span>${tab.label}</span>${dot}<i class="fas fa-chevron-down section-tab-chevron"></i>
                                </button>
                                <span class="section-tab-menu" id="${menuId}" role="menu">
                                    ${children.map(child => {
                                        const childActive = sectionTabActive(child, path, params) ? ' active' : '';
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

    window.toggleSectionTabMenu = function(e, menuId) {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }
        const button = e?.currentTarget;
        const group = button?.closest('[data-section-tab-group]');
        const menu = group?.querySelector(`#${menuId}`) || document.getElementById(menuId);
        if (!menu || !button) return;
        const isOpen = menu.classList.contains('open');
        window.closeSectionTabMenus();
        if (isOpen) return;
        getSectionTabMenuHost().appendChild(menu);
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
            if (!e.target.closest('#desktop-account-menu') && !e.target.closest('#desktop-project-avatar')) closeDesktopAccountMenu();
            if (!e.target.closest('#desktop-line-menu') && !e.target.closest('#desktop-line-selector-btn')) closeDesktopLineMenu();
        });
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                closeDesktopAccountMenu();
                closeDesktopLineMenu();
            }
        });
        window.addEventListener('resize', () => window.closeSectionTabMenus());
    }
})();
