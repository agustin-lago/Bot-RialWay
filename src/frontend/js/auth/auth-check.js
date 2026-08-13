(function() {
    const path = window.location.pathname;
    
    // 1. Protección de Backoffice, CRM, Docs e Integraciones
    if (path.startsWith('/conversaciones') || path.startsWith('/crm') ||
        path.startsWith('/documentacion') || path.startsWith('/docs') ||
        path.startsWith('/dashboard') || path.startsWith('/conexion') ||
        path.startsWith('/webchat') || path.startsWith('/meta') ||
        path.startsWith('/reportes') || path.startsWith('/tickets') ||
        path.startsWith('/lista-negra') || path.startsWith('/mercado-libre') ||
        path.startsWith('/mercado-pago')) {
        const token = localStorage.getItem('backoffice_token');
        if (!token) window.location.href = '/login';
    }
    
    // 2. Proteccion de Configuracion Critica (Dashboard de Configuracion)
    if (path.startsWith('/system-config')) {
        const configToken = localStorage.getItem('system_config_token');
        const isSuperAdmin = localStorage.getItem('is_superadmin') === 'true';
        if (!configToken || !isSuperAdmin) {
            window.location.href = '/login?target=system-config';
        }
    }
})();
