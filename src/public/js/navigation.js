(() => {
    'use strict';
    const root = document.querySelector('[data-site-navigation]');
    if (!root || root.dataset.enhanced) return;
    const toggle = root.querySelector('.th-site-nav__toggle');
    const panel = root.querySelector('.th-site-nav__panel');
    const mobile = window.matchMedia('(max-width: 1199px)');
    const setOpen = open => {
        root.dataset.open = String(open);
        toggle.setAttribute('aria-expanded', String(open));
        toggle.setAttribute('aria-label', open ? 'Cerrar men? principal' : 'Abrir men? principal');
    };
    toggle.hidden = false;
    root.dataset.enhanced = 'true';
    setOpen(false);
    toggle.addEventListener('click', () => setOpen(toggle.getAttribute('aria-expanded') !== 'true'));
    document.addEventListener('keydown', event => {
        if (event.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') {
            setOpen(false);
            toggle.focus();
        }
    });
    document.addEventListener('click', event => {
        if (!root.contains(event.target)) setOpen(false);
    });
    panel.addEventListener('click', event => {
        if (event.target.closest('a') && mobile.matches) setOpen(false);
    });
    mobile.addEventListener('change', () => {
        if (mobile.matches && panel.contains(document.activeElement)) toggle.focus();
        if (!mobile.matches && document.activeElement === toggle) root.querySelector('a').focus();
        setOpen(false);
    });
})();
