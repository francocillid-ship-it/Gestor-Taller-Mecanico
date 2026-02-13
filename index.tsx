
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const KEYBOARD_THRESHOLD = 100;
const HEIGHT_JITTER_TOLERANCE = 8;
let lastStableHeight = 0;
let keyboardOpen = false;
let rotationFreezeUntil = 0;
let intervalId: number | null = null;

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

const initViewportFix = () => {
    setRealViewportHeight();
    window.addEventListener('resize', setRealViewportHeight);
    window.addEventListener('orientationchange', () => {
        rotationFreezeUntil = Date.now() + 500;
        setTimeout(setRealViewportHeight, 550);
    });
    window.addEventListener('pageshow', setRealViewportHeight);
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) setRealViewportHeight();
    });
    if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', setRealViewportHeight);
    }
    document.addEventListener('focusin', (event) => {
        if (isTextInput(event.target)) {
            keyboardOpen = true;
            setTimeout(setRealViewportHeight, 0);
        }
    });
    document.addEventListener('focusout', (event) => {
        if (isTextInput(event.target)) {
            keyboardOpen = false;
            setTimeout(setRealViewportHeight, 0);
        }
    });
    requestAnimationFrame(setRealViewportHeight);
    requestAnimationFrame(() => requestAnimationFrame(setRealViewportHeight));
    setTimeout(setRealViewportHeight, 50);
    setTimeout(setRealViewportHeight, 150);
    setTimeout(setRealViewportHeight, 300);

    if (isIOSStandalone()) {
        if (intervalId) window.clearInterval(intervalId);
        intervalId = window.setInterval(setRealViewportHeight, 8000);
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
