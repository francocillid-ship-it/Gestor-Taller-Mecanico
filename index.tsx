
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const KEYBOARD_THRESHOLD = 100;
const HEIGHT_JITTER_TOLERANCE = 8;
const SAFE_AREA_TOLERANCE = 1;
const SAFE_AREA_STABLE_FRAMES = 2;
let lastStableHeight = 0;
let keyboardOpen = false;
let rotationFreezeUntil = 0;
let intervalId: number | null = null;
let safeAreaProbe: HTMLDivElement | null = null;
let safeAreaReady = false;
let stableSafeAreaFrames = 0;
let lastSafeArea = { top: 0, right: 0, bottom: 0, left: 0 };

const isTextInput = (target: EventTarget | null) => {
    if (!(target instanceof HTMLElement)) return false;
    const tag = target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
    return target.isContentEditable;
};

const getViewportHeight = () => {
    if (window.visualViewport) {
        return window.visualViewport.height + window.visualViewport.offsetTop;
    }
    return window.innerHeight;
};

const ensureSafeAreaProbe = () => {
    if (safeAreaProbe) return safeAreaProbe;
    safeAreaProbe = document.createElement('div');
    safeAreaProbe.setAttribute('data-safe-area-probe', 'true');
    safeAreaProbe.style.position = 'fixed';
    safeAreaProbe.style.top = '0';
    safeAreaProbe.style.left = '0';
    safeAreaProbe.style.width = '0';
    safeAreaProbe.style.height = '0';
    safeAreaProbe.style.paddingTop = 'env(safe-area-inset-top)';
    safeAreaProbe.style.paddingRight = 'env(safe-area-inset-right)';
    safeAreaProbe.style.paddingBottom = 'env(safe-area-inset-bottom)';
    safeAreaProbe.style.paddingLeft = 'env(safe-area-inset-left)';
    safeAreaProbe.style.pointerEvents = 'none';
    safeAreaProbe.style.visibility = 'hidden';
    const host = document.body || document.documentElement;
    host.appendChild(safeAreaProbe);
    return safeAreaProbe;
};

const parsePxValue = (value: string) => {
    const parsed = Number.parseFloat(value || '0');
    return Number.isFinite(parsed) ? parsed : 0;
};

const readSafeAreaInsets = () => {
    const probe = ensureSafeAreaProbe();
    const styles = window.getComputedStyle(probe);
    return {
        top: parsePxValue(styles.paddingTop),
        right: parsePxValue(styles.paddingRight),
        bottom: parsePxValue(styles.paddingBottom),
        left: parsePxValue(styles.paddingLeft)
    };
};

const setSafeAreaInsets = () => {
    const insets = readSafeAreaInsets();
    const root = document.documentElement;
    root.style.setProperty('--safe-top', `${Math.max(0, Math.round(insets.top))}px`);
    root.style.setProperty('--safe-right', `${Math.max(0, Math.round(insets.right))}px`);
    root.style.setProperty('--safe-bottom', `${Math.max(0, Math.round(insets.bottom))}px`);
    root.style.setProperty('--safe-left', `${Math.max(0, Math.round(insets.left))}px`);

    if (safeAreaReady) {
        lastSafeArea = insets;
        return;
    }

    const stable =
        Math.abs(insets.top - lastSafeArea.top) <= SAFE_AREA_TOLERANCE &&
        Math.abs(insets.right - lastSafeArea.right) <= SAFE_AREA_TOLERANCE &&
        Math.abs(insets.bottom - lastSafeArea.bottom) <= SAFE_AREA_TOLERANCE &&
        Math.abs(insets.left - lastSafeArea.left) <= SAFE_AREA_TOLERANCE;

    lastSafeArea = insets;
    stableSafeAreaFrames = stable ? stableSafeAreaFrames + 1 : 0;
    if (stableSafeAreaFrames >= SAFE_AREA_STABLE_FRAMES) {
        safeAreaReady = true;
        root.dataset.safeAreaReady = 'true';
        window.dispatchEvent(new Event('safeareaready'));
    }
};

const setRealViewportHeight = () => {
    const viewportHeight = getViewportHeight();
    const vh = Math.round(viewportHeight || 0);
    if (vh <= 0) return;

    if (Date.now() < rotationFreezeUntil) {
        return;
    }

    if (!keyboardOpen) {
        if (lastStableHeight !== 0 && Math.abs(vh - lastStableHeight) <= HEIGHT_JITTER_TOLERANCE) {
            return;
        }
        lastStableHeight = vh;
        document.documentElement.style.setProperty('--real-vh', `${vh}px`);
        return;
    }

    if (lastStableHeight === 0) {
        lastStableHeight = vh;
        document.documentElement.style.setProperty('--real-vh', `${vh}px`);
        return;
    }

    if (vh >= lastStableHeight - 10) {
        keyboardOpen = false;
        lastStableHeight = vh;
        document.documentElement.style.setProperty('--real-vh', `${vh}px`);
        return;
    }

    if (vh < lastStableHeight - KEYBOARD_THRESHOLD) {
        return;
    }

    document.documentElement.style.setProperty('--real-vh', `${vh}px`);
};

const isIOSStandalone = () => {
    const isIOS = /iP(ad|hone|od)/.test(navigator.userAgent || '');
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone;
    return isIOS && isStandalone;
};

const updateEnvironmentMetrics = () => {
    setRealViewportHeight();
    setSafeAreaInsets();
};

const initViewportFix = () => {
    updateEnvironmentMetrics();
    setTimeout(() => {
        if (!safeAreaReady) {
            safeAreaReady = true;
            document.documentElement.dataset.safeAreaReady = 'true';
            window.dispatchEvent(new Event('safeareaready'));
        }
    }, 800);
    window.addEventListener('resize', updateEnvironmentMetrics);
    window.addEventListener('orientationchange', () => {
        rotationFreezeUntil = Date.now() + 500;
        setTimeout(updateEnvironmentMetrics, 550);
    });
    window.addEventListener('pageshow', updateEnvironmentMetrics);
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) updateEnvironmentMetrics();
    });
    if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', updateEnvironmentMetrics);
    }
    document.addEventListener('focusin', (event) => {
        if (isTextInput(event.target)) {
            keyboardOpen = true;
            setTimeout(updateEnvironmentMetrics, 0);
        }
    });
    document.addEventListener('focusout', (event) => {
        if (isTextInput(event.target)) {
            keyboardOpen = false;
            setTimeout(updateEnvironmentMetrics, 0);
        }
    });
    requestAnimationFrame(updateEnvironmentMetrics);
    requestAnimationFrame(() => requestAnimationFrame(updateEnvironmentMetrics));
    setTimeout(updateEnvironmentMetrics, 50);
    setTimeout(updateEnvironmentMetrics, 150);
    setTimeout(updateEnvironmentMetrics, 300);

    if (isIOSStandalone()) {
        if (intervalId) window.clearInterval(intervalId);
        intervalId = window.setInterval(updateEnvironmentMetrics, 8000);
    }
};

if (typeof window !== 'undefined') {
    window.addEventListener('load', initViewportFix);
    if (document.readyState !== 'loading') {
        initViewportFix();
    }
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
