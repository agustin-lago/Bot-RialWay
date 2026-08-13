/* global navigate, openSupportWidget, toggleTheme, logout */
(function() {
    const MOBILE_BREAKPOINT = 1023;
    const STORAGE_KEYS = {
        messaging: 'backoffice_last_route_messaging',
        integrations: 'backoffice_last_route_integrations',
    };
    const SECTION_LABELS = {
        messaging: { label: 'Gestion', icon: 'fas fa-mobile-screen-button', dotId: 'dot-messaging' },
        integrations: { label: 'Integraciones', icon: 'fas fa-puzzle-piece', dotId: 'dot-integraciones' },
    };

    function getConfig() {
        return window.__NAV_SECTION_TAB_CONFIG || {};
    }

    function isMobile() {
        return window.innerWidth <= MOBILE_BREAKPOINT;
    }

    function visible(tab) {
        if (typeof window.__NAV_SECTION_TAB_VISIBLE === 'function') return window.__NAV_SECTION_TAB_VISIBLE(tab);
        if (tab.requires === 'backoffice') return window.__BACKOFFICE_VISIBLE !== false;
        if (tab.requires === 'crm') return window.__CRM_VISIBLE !== false;
        if (tab.requires === 'epc') return window.__EPC_VISIBLE === true;
        if (tab.requires === 'system_config') return window.__SYSTEM_CONFIG_VISIBLE !== false;
        return true;
    }

    function active(tab, path, params) {
        if (typeof window.__NAV_SECTION_TAB_ACTIVE === 'function') return window.__NAV_SECTION_TAB_ACTIVE(tab, path, params);
        if (Array.isArray(tab.matchRoutes) && tab.matchRoutes.includes(path)) return true;
        return tab.route === path;
    }

    function getVisibleTabs(section) {
        return (getConfig()[section] || []).filter(visible);
    }

    function getRoutesForSection(section) {
        const routes = [];
        getVisibleTabs(section).forEach(tab => {
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

    function getSectionForPath(path) {
        const config = getConfig();
        return Object.keys(config).find(section => getRoutesForSection(section).includes(path)) || '';
    }

    function getDefaultSectionRoute(section) {
        const visibleTabs = getVisibleTabs(section);
        if (!visibleTabs.length) return '/dashboard';
        if (section === 'integrations' && window.__CRM_VISIBLE === false) {
            return visibleTabs.find(tab => tab.route === '/meta')?.route || visibleTabs[0].route || '/meta';
        }
        return visibleTabs[0].route || '/dashboard';
    }

    function rememberSectionRoute(path) {
        const section = getSectionForPath(path);
        if (!section || !STORAGE_KEYS[section]) return;
        try {
            localStorage.setItem(STORAGE_KEYS[section], path);
        } catch {
            // Storage is a convenience; navigation still works without it.
        }
    }

    function navigateToLastSectionRoute(section) {
        const allowedRoutes = getRoutesForSection(section);
        let route = '';
        try {
            route = localStorage.getItem(STORAGE_KEYS[section]) || '';
        } catch {
            route = '';
        }
        if (!allowedRoutes.includes(route)) route = getDefaultSectionRoute(section);
        if (typeof window.navigate === 'function') window.navigate(route);
        else window.location.href = route;
    }

    function dotMarkup(dotId) {
        return dotId ? `<span class="nav-dot mobile-nav-dot" data-dot-sync="${dotId}" style="display:none;"></span>` : '';
    }

    function itemButton(tab, level = 0) {
        const route = tab.route || '';
        const matchRoutes = Array.isArray(tab.matchRoutes) ? tab.matchRoutes.join(',') : '';
        const hasChildren = Array.isArray(tab.children) && tab.children.filter(visible).length > 0;
        const action = hasChildren ? 'section-label' : 'navigate';
        return `
            <button class="mobile-nav-link${level ? ' mobile-nav-child-link' : ''}" type="button" data-mobile-nav-action="${action}" data-route="${route}" data-match-routes="${matchRoutes}">
                <span><i class="${tab.icon}"></i><span>${tab.label}</span></span>
                ${dotMarkup(tab.dotId)}
            </button>
        `;
    }

    function renderChildGroup(tab) {
        const children = (tab.children || []).filter(visible);
        return `
            <div class="mobile-nav-child-group open" data-mobile-nav-child-group>
                <div class="mobile-nav-subheading">
                    <span><i class="${tab.icon}"></i><span>${tab.label}</span></span>
                </div>
                <div class="mobile-nav-child-list">
                    ${children.map(child => itemButton(child, 1)).join('')}
                </div>
            </div>
        `;
    }

    function renderSection(section) {
        const meta = SECTION_LABELS[section];
        if (!meta) return '';
        const tabs = getVisibleTabs(section);
        if (!tabs.length) return '';
        return `
            <div class="mobile-nav-section open" data-mobile-nav-section="${section}">
                <div class="mobile-nav-section-toggle" data-section="${section}">
                    <span><i class="${meta.icon}"></i><span>${meta.label}</span></span>
                    ${dotMarkup(meta.dotId)}
                </div>
                <div class="mobile-nav-section-panel">
                    ${tabs.map(tab => Array.isArray(tab.children) && tab.children.length ? renderChildGroup(tab) : itemButton(tab)).join('')}
                </div>
            </div>
        `;
    }

    function renderMobileShell() {
        let overlay = document.getElementById('mobile-nav-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'mobile-nav-overlay';
            overlay.className = 'mobile-nav-overlay';
            document.body.appendChild(overlay);
        }
        const currentScrollEl = getMobileScrollElement(overlay);
        const previousScrollTop = currentScrollEl ? currentScrollEl.scrollTop : 0;

        const isDark = (document.documentElement.getAttribute('data-theme') || 'light') === 'dark';
        const canShowSystemConfig = window.__SYSTEM_CONFIG_VISIBLE !== false && localStorage.getItem('is_superadmin') === 'true';

        overlay.innerHTML = `
            <aside class="mobile-nav-drawer" role="dialog" aria-modal="true" aria-label="Menu principal">
                <div class="mobile-nav-scroll">
                    <div class="mobile-nav-head">
                        <div class="mobile-nav-brand">
                            <i class="fas fa-brain"></i>
                        </div>
                        <button class="mobile-nav-close" type="button" data-mobile-nav-action="close" aria-label="Cerrar menu">
                            <i class="fas fa-xmark"></i>
                        </button>
                    </div>
                    ${renderSection('messaging')}
                    ${renderSection('integrations')}
                    <div class="mobile-nav-footer">
                        <button class="mobile-nav-link" type="button" data-mobile-nav-action="support">
                            <span><i class="fas fa-headset"></i><span>Soporte</span></span>
                        </button>
                        <button class="mobile-nav-link" type="button" data-mobile-nav-action="navigate" data-route="/usuarios">
                            <span><i class="fas fa-user-plus"></i><span>Nuevo Usuario</span></span>
                        </button>
                        <button class="mobile-nav-link" type="button" data-mobile-nav-action="theme">
                            <span><i class="fas ${isDark ? 'fa-moon' : 'fa-sun'}"></i><span>${isDark ? 'Tema: Oscuro' : 'Tema: Claro'}</span></span>
                        </button>
                        ${canShowSystemConfig ? `
                            <button class="mobile-nav-link" type="button" data-mobile-nav-action="navigate" data-route="/system-config">
                                <span><i class="fas fa-gears"></i><span>Configuracion</span></span>
                            </button>
                        ` : ''}
                        <button class="mobile-nav-link mobile-nav-logout" type="button" data-mobile-nav-action="logout">
                            <span><i class="fas fa-power-off"></i><span>Salir</span></span>
                        </button>
                    </div>
                </div>
            </aside>
        `;

        bindMobileOverlay(overlay);
        updateActiveState(window.location.pathname);
        if (typeof window.applyCachedNotificationDots === 'function') window.applyCachedNotificationDots();
        if (previousScrollTop > 0) {
            restoreMobileScroll(overlay, previousScrollTop);
        }
    }

    function getMobileScrollElement(overlay = document.getElementById('mobile-nav-overlay')) {
        return overlay || null;
    }

    function restoreMobileScroll(overlay, scrollTop) {
        const apply = () => {
            const scrollEl = getMobileScrollElement(overlay);
            if (scrollEl) scrollEl.scrollTop = scrollTop;
        };
        requestAnimationFrame(() => {
            apply();
            requestAnimationFrame(apply);
        });
    }

    function setPanelOpen(sectionEl, open) {
        const panel = sectionEl?.querySelector(':scope > .mobile-nav-section-panel');
        if (!sectionEl || !panel) return;
        sectionEl.classList.toggle('open', open);
        panel.style.height = open ? `${panel.scrollHeight}px` : '0px';
    }

    function setChildOpen(groupEl, open) {
        const panel = groupEl?.querySelector(':scope > .mobile-nav-child-list');
        if (!groupEl || !panel) return;
        groupEl.classList.toggle('open', open);
        panel.style.height = open ? `${panel.scrollHeight}px` : '0px';
        const sectionPanel = groupEl.closest('.mobile-nav-section-panel');
        const sectionEl = groupEl.closest('.mobile-nav-section');
        if (sectionPanel && sectionEl?.classList.contains('open')) {
            sectionPanel.style.height = `${sectionPanel.scrollHeight}px`;
        }
    }

    function openMobileMenu() {
        renderMobileShell();
        document.body.classList.add('mobile-nav-open');
    }

    function closeMobileMenu() {
        document.body.classList.remove('mobile-nav-open');
    }

    function toggleMobileMenu() {
        if (document.body.classList.contains('mobile-nav-open')) closeMobileMenu();
        else openMobileMenu();
    }

    function bindMobileOverlay(overlay) {
        if (overlay.dataset.bound === 'true') return;
        overlay.dataset.bound = 'true';
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                closeMobileMenu();
                return;
            }
            const control = e.target.closest('[data-mobile-nav-action]');
            if (!control) return;
            const action = control.dataset.mobileNavAction;
            if (action === 'close') return closeMobileMenu();
            if (action === 'section-label') {
                return;
            }
            if (action === 'support') {
                if (typeof window.openSupportWidget === 'function') window.openSupportWidget(e);
                closeMobileMenu();
                return;
            }
            if (action === 'theme') {
                const scrollEl = getMobileScrollElement(overlay);
                const scrollTop = scrollEl ? scrollEl.scrollTop : 0;
                if (typeof window.toggleTheme === 'function') window.toggleTheme();
                restoreMobileScroll(overlay, scrollTop);
                return;
            }
            if (action === 'logout') {
                if (typeof window.logout === 'function') window.logout();
                return;
            }
            if (action === 'navigate') {
                const route = control.dataset.route;
                if (route) {
                    if (typeof window.navigate === 'function') window.navigate(route);
                    else window.location.href = route;
                    closeMobileMenu();
                }
            }
        });
    }

    function updateActiveState(path = window.location.pathname) {
        const overlay = document.getElementById('mobile-nav-overlay');
        if (!overlay) return;
        const params = new URLSearchParams(window.location.search);
        overlay.querySelectorAll('.mobile-nav-section').forEach(sectionEl => {
            setPanelOpen(sectionEl, true);
        });

        overlay.querySelectorAll('.mobile-nav-link[data-route]').forEach(link => {
            const route = link.dataset.route || '';
            const matchRoutes = (link.dataset.matchRoutes || '').split(',').filter(Boolean);
            const activeLink = route === path || matchRoutes.includes(path) || (route === '/conversaciones' && path === '/conversaciones' && !params.get('openPanel'));
            link.classList.toggle('active', activeLink);
        });

        overlay.querySelectorAll('[data-mobile-nav-child-group]').forEach(group => {
            setChildOpen(group, true);
        });
    }

    function init() {
        renderMobileShell();
        const button = document.getElementById('sidebar-menu-btn');
        if (button && button.dataset.navigationRouterBound !== 'true') {
            button.dataset.navigationRouterBound = 'true';
            button.addEventListener('click', (e) => {
                if (!isMobile()) return;
                e.preventDefault();
                toggleMobileMenu();
            });
        }
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && document.body.classList.contains('mobile-nav-open')) {
                e.preventDefault();
                closeMobileMenu();
            }
        });
        window.addEventListener('resize', () => {
            if (!isMobile()) closeMobileMenu();
            updateActiveState(window.location.pathname);
        });
        window.addEventListener('themeChanged', renderMobileShell);
    }

    window.navigationRouter = {
        init,
        render: renderMobileShell,
        openMobileMenu,
        closeMobileMenu,
        toggleMobileMenu,
        updateActiveState,
        getRoutesForSection,
        getSectionForPath,
        getDefaultSectionRoute,
        rememberSectionRoute,
        navigateToLastSectionRoute,
    };

    document.addEventListener('DOMContentLoaded', init);
})();
