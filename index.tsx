const isTextInput = (target: EventTarget | null) => {
    if (!(target instanceof HTMLElement)) return false;
    const tag = target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
    return target.isContentEditable;
};

const updateViewportHeight = () => {
    if (typeof window === 'undefined') return;

    // Simple, direct viewport height calculation
    const vh = window.visualViewport ? window.visualViewport.height : window.innerHeight;
    const root = document.documentElement;

    root.style.setProperty('--real-vh', `${vh}px`);
    root.style.setProperty('--app-dvh', `${vh}px`);
    // Use slightly different logic for small/large viewports if needed, but keeping them synced is often more stable for PWAs
    root.style.setProperty('--app-svh', `${vh}px`);
    root.style.setProperty('--app-lvh', `${vh}px`);
};

// iOS Safe Area detection
const updateSafeArea = () => {
    const root = document.documentElement;
    const safeAreaProbe = document.createElement('div');

    Object.assign(safeAreaProbe.style, {
        position: 'fixed',
        top: '0',
        left: '0',
        zIndex: '-1',
        pointerEvents: 'none',
        paddingTop: 'env(safe-area-inset-top)',
        paddingRight: 'env(safe-area-inset-right)',
        paddingBottom: 'env(safe-area-inset-bottom)',
        paddingLeft: 'env(safe-area-inset-left)',
    });

    document.body.appendChild(safeAreaProbe);
    const computed = window.getComputedStyle(safeAreaProbe);

    const safeTop = parseFloat(computed.paddingTop) || 0;
    const safeRight = parseFloat(computed.paddingRight) || 0;
    const safeBottom = parseFloat(computed.paddingBottom) || 0;
    const safeLeft = parseFloat(computed.paddingLeft) || 0;

    document.body.removeChild(safeAreaProbe);

    root.style.setProperty('--safe-top', `${safeTop}px`);
    root.style.setProperty('--safe-right', `${safeRight}px`);
    root.style.setProperty('--safe-bottom', `${safeBottom}px`);
    root.style.setProperty('--safe-left', `${safeLeft}px`);

    // Mark as ready immediately
    if (root.dataset.safeAreaReady !== 'true') {
        root.dataset.safeAreaReady = 'true';
        window.dispatchEvent(new Event('safeareaready'));
    }
};

const handleResize = () => {
    updateViewportHeight();
    // Small delay to allow layout to settle after rotation/keyboard
    setTimeout(updateViewportHeight, 100);
    setTimeout(updateSafeArea, 100);
};

const initViewportFix = () => {
    updateViewportHeight();
    updateSafeArea();

    if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', handleResize);
        window.visualViewport.addEventListener('scroll', handleResize);
    }

    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', () => setTimeout(handleResize, 200));

    // Handle keyboard focus/blur to ensure viewports are updated
    document.addEventListener('focusin', (e) => {
        if (isTextInput(e.target)) setTimeout(handleResize, 300);
    });
    document.addEventListener('focusout', (e) => {
        if (isTextInput(e.target)) setTimeout(handleResize, 300);
    });
};

if (typeof window !== 'undefined') {
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        initViewportFix();
    } else {
        window.addEventListener('DOMContentLoaded', initViewportFix);
    }
    window.addEventListener('load', initViewportFix);
}

const rootElement = document.getElementById('root');
if (!rootElement) {
    throw new Error("Could not find root element to mount to");
}

// Registro del Service Worker para soporte de Notificaciones en Móvil/PWA
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        const swUrl = `${import.meta.env.BASE_URL}sw.js`;
        navigator.serviceWorker.register(swUrl).catch(err => {
            console.log('Error al registrar Service Worker:', err);
        });
    });
}

const root = ReactDOM.createRoot(rootElement);
root.render(
    <React.StrictMode>
        <App />
    </React.StrictMode>
);
