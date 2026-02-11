
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const setRealViewportHeight = () => {
    const vh = window.innerHeight;
    document.documentElement.style.setProperty('--real-vh', `${vh}px`);
};

const initViewportFix = () => {
    setRealViewportHeight();
    window.addEventListener('resize', setRealViewportHeight);
    setTimeout(setRealViewportHeight, 50);
    setTimeout(setRealViewportHeight, 150);
    setTimeout(setRealViewportHeight, 300);
};

if (typeof window !== 'undefined') {
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
