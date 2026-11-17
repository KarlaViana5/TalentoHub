(() => {
    'use strict';
    const meta = document.querySelector('meta[name="csrf-token"]');
    const vista = document.querySelector('meta[name="registro-vista"]');
    if (meta && vista) fetch(vista.content, { method: 'POST', credentials: 'same-origin', headers: { 'X-CSRF-Token': meta.content } }).catch(() => {});
    window.talentoHubFetch = (url, options = {}) => {
        const destino = new URL(url, window.location.href);
        if (destino.origin !== window.location.origin) return Promise.reject(new Error('Solo se permiten solicitudes al mismo sitio.'));
        const headers = new Headers(options.headers);
        if (meta) headers.set('X-CSRF-Token', meta.content);
        return fetch(destino.href, { ...options, headers, credentials: 'same-origin' });
    };
})();
