
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import type { Cliente, Trabajo, TallerInfo, Vehiculo } from '../types';
import {
    WrenchScrewdriverIcon,
    BookOpenIcon,
    ClockIcon,
    Cog6ToothIcon,
    XMarkIcon,
    ArrowRightOnRectangleIcon,
    KeyIcon,
    MagnifyingGlassPlusIcon,
    CheckCircleIcon,
    BellIcon,
    BellAlertIcon,
    InformationCircleIcon,
    ShareIcon
} from '@heroicons/react/24/solid';
import VehicleInfoCard from './VehicleInfoCard';
import TrabajoListItem from './TrabajoListItem';
import TrabajoHistorialModal from './TrabajoHistorialModal';
import ChangePasswordModal from './ChangePasswordModal';
import { applyAppTheme, MAINTENANCE_TYPES } from '../constants';

interface ClientPortalProps {
    client: Cliente;
    trabajos: Trabajo[];
    onLogout: () => void;
    tallerInfo: TallerInfo | null;
}

type FontSize = 'normal' | 'large' | 'xl';

const ClientPortal: React.FC<ClientPortalProps> = ({ client, trabajos, onLogout, tallerInfo }) => {
    const [isHistorialModalOpen, setIsHistorialModalOpen] = useState(false);
    const [modalTrabajos, setModalTrabajos] = useState<Trabajo[]>([]);
    const [modalTitle, setModalTitle] = useState('');
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isSettingsVisible, setIsSettingsVisible] = useState(false);
    const [isChangePasswordModalOpen, setIsChangePasswordModalOpen] = useState(false);
    const [fontSize, setFontSize] = useState<FontSize>(() => (localStorage.getItem('client_font_size') as FontSize) || 'normal');

    // --- Push Notifications State ---
    const [notificationsEnabled, setNotificationsEnabled] = useState(() => localStorage.getItem('notifications_enabled') === 'true');
    const [showInvitation, setShowInvitation] = useState(false);

    // Helpers para detección de plataforma
    const isIOS = useMemo(() => {
        return /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    }, []);

    const isStandalone = useMemo(() => {
        return window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone;
    }, []);

    useEffect(() => {
        localStorage.setItem('client_font_size', fontSize);
    }, [fontSize]);

    useEffect(() => {
        applyAppTheme();

        // Verificar si debemos mostrar la invitación de notificaciones
        const neverShowAgain = localStorage.getItem('notifications_never_show') === 'true';
        const isEnabled = localStorage.getItem('notifications_enabled') === 'true';

        if (!isEnabled && !neverShowAgain) {
            const timer = setTimeout(() => setShowInvitation(true), 1500);
            return () => clearTimeout(timer);
        }
    }, []);

    const openHistorialModal = (trabajosParaMostrar: Trabajo[], title: string) => {
        setModalTrabajos(trabajosParaMostrar);
        setModalTitle(title);
        setIsHistorialModalOpen(true);
    };

    const closeHistorialModal = () => setIsHistorialModalOpen(false);
    const openSettings = () => { setIsSettingsOpen(true); requestAnimationFrame(() => setIsSettingsVisible(true)); };
    const closeSettings = () => { setIsSettingsVisible(false); setTimeout(() => setIsSettingsOpen(false), 300); };

    const trabajosRecientes = useMemo(() => trabajos.slice(0, 5), [trabajos]);

    const getFontStyles = () => {
        if (fontSize === 'normal') return '';
        const baseSize = fontSize === 'large' ? 1.15 : 1.3;
        return `.portal-wrapper .text-sm { font-size: ${baseSize}rem !important; } .portal-wrapper .text-base { font-size: ${baseSize + 0.1}rem !important; }`;
    };

    // --- Lógica de Notificaciones Móvil ---
    const sendLocalNotification = async (title: string, body: string) => {
        if (!notificationsEnabled) return;

        if ('serviceWorker' in navigator) {
            try {
                const registration = await navigator.serviceWorker.ready;
                // Fix: cast to any to avoid TypeScript error as 'vibrate' may not be in all NotificationOptions definitions
                registration.showNotification(title, {
                    body,
                    icon: "/favicon.svg",
                    badge: "/favicon.svg",
                    vibrate: [100, 50, 100],
                } as any);
            } catch (err) {
                console.error("No se pudo mostrar la notificación vía Service Worker", err);
            }
        } else if ("Notification" in window && Notification.permission === "granted") {
            new Notification(title, { body, icon: "/favicon.svg" });
        }
    };

    const requestNotificationPermission = async () => {
        // En iOS, las notificaciones SOLO están disponibles si la app es añadida a la pantalla de inicio
        if (isIOS && !isStandalone) {
            alert("Para activar notificaciones en iPhone:\n\n1. Toca el botón 'Compartir' de tu navegador (el cuadrado con flecha).\n2. Selecciona 'Añadir a pantalla de inicio'.\n3. Abre la aplicación desde tu pantalla de inicio.");
            return false;
        }

        if (!("Notification" in window)) {
            alert("Este dispositivo o navegador no soporta notificaciones nativas.");
            return false;
        }

        try {
            const permission = await Notification.requestPermission();
            if (permission === "granted") {
                setNotificationsEnabled(true);
                localStorage.setItem('notifications_enabled', 'true');
                localStorage.removeItem('notifications_never_show');
                return true;
            } else {
                alert("Permiso denegado. Por favor, activa las notificaciones en los ajustes de tu navegador o dispositivo.");
                return false;
            }
        } catch (error) {
            console.error("Error solicitando permisos", error);
            alert("Hubo un problema al intentar activar las notificaciones.");
            return false;
        }
    };

    const disableNotifications = () => {
        setNotificationsEnabled(false);
        localStorage.setItem('notifications_enabled', 'false');
    };

    const handleEnableNotifications = async () => {
        const success = await requestNotificationPermission();
        if (success) {
            setShowInvitation(false);
            // Notificación de prueba usando el Service Worker para asegurar compatibilidad
            setTimeout(() => {
                sendLocalNotification("¡Notificaciones Activas!", "Te avisaremos 30 días antes de que venza un mantenimiento.");
            }, 500);
        }
    };

    const handleDismissInvitation = (permanent: boolean) => {
        setShowInvitation(false);
        if (permanent) {
            localStorage.setItem('notifications_never_show', 'true');
        }
    };

    // Lógica para detectar mantenimientos próximos (30 días)
    useEffect(() => {
        if (!notificationsEnabled) return;

        const checkUpcomingMaintenance = () => {
            const upcomingItems: string[] = [];

            client.vehiculos.forEach(vehiculo => {
                const vehicleJobs = trabajos.filter(t => t.vehiculoId === vehiculo.id && t.status === 'Finalizado');
                const checkConfigs = [
                    { key: 'oil', label: 'Aceite' },
                    { key: 'timing_belt', label: 'Distribución' },
                    { key: 'coolant', label: 'Refrigerante' },
                    { key: 'brakes', label: 'Frenos' }
                ];

                checkConfigs.forEach(config => {
                    const custom = vehiculo.maintenance_config?.[config.key];
                    if (custom && !custom.enabled) return;

                    const intervalMonths = custom ? custom.months : 12;
                    const lastJob = vehicleJobs.find(t =>
                        t.partes.some(p => p.maintenanceType === config.key)
                    );

                    if (lastJob) {
                        const date = new Date(lastJob.fechaSalida || lastJob.fechaEntrada);
                        const nextDate = new Date(date);
                        nextDate.setMonth(nextDate.getMonth() + intervalMonths);

                        const today = new Date();
                        const diffTime = nextDate.getTime() - today.getTime();
                        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                        if (diffDays <= 30 && diffDays > 0) {
                            upcomingItems.push(`${config.label} (${vehiculo.marca} ${vehiculo.modelo})`);
                        }
                    }
                });
            });

            if (upcomingItems.length > 0) {
                sendLocalNotification("Mantenimiento Próximo", `Es momento de agendar: ${upcomingItems.join(', ')}.`);
            }
        };

        checkUpcomingMaintenance();
    }, [notificationsEnabled, client.vehiculos, trabajos]);

    return (
        <>
            <style>{getFontStyles()}</style>
            <div className="portal-wrapper app-height w-full bg-taller-light dark:bg-taller-dark text-taller-dark dark:text-taller-light transition-all duration-200 flex flex-col overflow-hidden relative">

                {/* --- MODAL INVITACIÓN NOTIFICACIONES --- */}
                {showInvitation && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
                        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden animate-in zoom-in-95 duration-300">
                            <div className="p-6 text-center">
                                <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <BellAlertIcon className="h-8 w-8 text-taller-primary dark:text-blue-400" />
                                </div>
                                <h3 className="text-xl font-bold mb-2">¡No olvides los Services!</h3>
                                <p className="text-sm text-taller-gray dark:text-gray-400 mb-6">
                                    Activa las notificaciones para recibir recordatorios 30 días antes de que venza el mantenimiento de tus vehículos.
                                </p>

                                {isIOS && !isStandalone ? (
                                    <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-100 dark:border-blue-800 mb-6">
                                        <p className="text-xs font-semibold text-taller-primary dark:text-blue-300 flex items-center gap-2 justify-center mb-2">
                                            <ShareIcon className="h-4 w-4" /> REQUERIDO PARA IPHONE
                                        </p>
                                        <p className="text-[10px] text-taller-gray dark:text-gray-400">
                                            Toca "Compartir" y luego "Añadir a pantalla de inicio" para habilitar las alertas.
                                        </p>
                                    </div>
                                ) : null}

                                <div className="space-y-3">
                                    <button
                                        onClick={handleEnableNotifications}
                                        className="w-full py-3 bg-taller-primary text-white rounded-xl font-bold shadow-lg shadow-taller-primary/20 hover:bg-taller-secondary transition-all active:scale-95"
                                    >
                                        {(isIOS && !isStandalone) ? 'Ver Instrucciones' : 'Sí, activar'}
                                    </button>
                                    <div className="grid grid-cols-2 gap-3">
                                        <button
                                            onClick={() => handleDismissInvitation(false)}
                                            className="py-2 text-sm font-semibold text-taller-gray hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                                        >
                                            Más tarde
                                        </button>
                                        <button
                                            onClick={() => handleDismissInvitation(true)}
                                            className="py-2 text-sm font-semibold text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-lg transition-colors"
                                        >
                                            Ocultar siempre
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                <header className="bg-white dark:bg-gray-800 shadow-md flex-shrink-0 z-20">
                    <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
                        <div className="flex items-center gap-3">
                            {tallerInfo?.logoUrl ? <img src={tallerInfo.logoUrl} alt="Logo" className="h-14 object-contain" /> : <h1 className="text-xl font-bold truncate">{tallerInfo?.nombre || 'Portal Cliente'}</h1>}
                        </div>
                        <button onClick={openSettings} className="p-2 text-taller-gray hover:text-taller-primary rounded-full hover:bg-gray-100 transition-colors relative">
                            <Cog6ToothIcon className="h-7 w-7" />
                            {notificationsEnabled && <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-green-500 border-2 border-white dark:border-gray-800 rounded-full"></span>}
                        </button>
                    </div>
                </header>

                <main className="flex-1 overflow-y-auto overscroll-contain">
                    <div className="max-w-7xl mx-auto px-4 py-8">
                        <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4">
                            <div>
                                <h2 className="text-3xl font-bold">Hola, {client.nombre}</h2>
                                <p className="text-taller-gray dark:text-gray-400 mt-1">Bienvenido a su historial mecánico digital.</p>
                            </div>

                            {notificationsEnabled ? (
                                <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 rounded-full text-xs font-bold border border-green-200 dark:border-green-800/30 animate-in fade-in slide-in-from-right-4 duration-500">
                                    <BellIcon className="h-4 w-4" /> Notificaciones Activas
                                </div>
                            ) : (
                                <button
                                    onClick={handleEnableNotifications}
                                    className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/20 text-taller-primary dark:text-blue-400 rounded-full text-xs font-bold border border-blue-200 dark:border-blue-800/30 hover:bg-blue-100 transition-all"
                                >
                                    <BellAlertIcon className="h-4 w-4" /> Activar Recordatorios
                                </button>
                            )}
                        </div>

                        <section className="mb-10 space-y-4">
                            <h3 className="text-xl font-bold mb-4">Sus Vehículos</h3>
                            {client.vehiculos.map(vehiculo => (
                                <VehicleInfoCard
                                    key={vehiculo.id}
                                    vehiculo={vehiculo}
                                    cliente={client}
                                    tallerInfo={tallerInfo}
                                    trabajos={trabajos.filter(t => t.vehiculoId === vehiculo.id)}
                                    onViewHistory={() => openHistorialModal(trabajos.filter(t => t.vehiculoId === vehiculo.id), `Historial ${vehiculo.marca} ${vehiculo.modelo}`)}
                                />
                            ))}
                        </section>

                        <section className="mb-10">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-xl font-bold">Trabajos Recientes</h3>
                                <button onClick={() => openHistorialModal(trabajos, 'Historial Completo')} className="text-taller-primary font-semibold flex items-center gap-1"><BookOpenIcon className="h-4 w-4" /> Ver Todo</button>
                            </div>
                            <div className="space-y-3">
                                {trabajosRecientes.length > 0 ? (
                                    trabajosRecientes.map(trabajo => (
                                        <TrabajoListItem key={trabajo.id} trabajo={trabajo} vehiculo={client.vehiculos.find(v => v.id === trabajo.vehiculoId)} cliente={client} tallerInfo={tallerInfo} />
                                    ))
                                ) : (
                                    <div className="bg-white dark:bg-gray-800 rounded-xl p-8 text-center border dark:border-gray-700">
                                        <InformationCircleIcon className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                                        <p className="text-taller-gray">No se registran trabajos recientes.</p>
                                    </div>
                                )}
                            </div>
                        </section>
                    </div>
                </main>

                {isSettingsOpen && (
                    <div className="fixed inset-0 z-50 flex justify-end">
                        <div className={`fixed inset-0 bg-black/50 transition-opacity duration-300 ${isSettingsVisible ? 'opacity-100' : 'opacity-0'}`} onClick={closeSettings} />
                        <div className={`bg-white dark:bg-gray-800 w-full max-w-xs shadow-2xl flex flex-col transform transition-transform duration-300 ${isSettingsVisible ? 'translate-x-0' : 'translate-x-full'}`}>
                            <div className="p-4 border-b dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-900/50">
                                <h4 className="font-bold">Ajustes</h4>
                                <button onClick={closeSettings} className="p-1"><XMarkIcon className="h-6 w-6" /></button>
                            </div>
                            <div className="flex-1 p-6 space-y-8 overflow-y-auto">

                                {/* Notificaciones Toggle */}
                                <div>
                                    <label className="block text-sm font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2"><BellIcon className="h-4 w-4" /> Avisos y Alertas</label>
                                    <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900/50 rounded-xl border dark:border-gray-700">
                                        <div>
                                            <p className="text-sm font-bold">Alertas de Service</p>
                                            <p className="text-[10px] text-taller-gray">Avisar 30 días antes</p>
                                        </div>
                                        <button
                                            onClick={notificationsEnabled ? disableNotifications : handleEnableNotifications}
                                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${notificationsEnabled ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}`}
                                        >
                                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${notificationsEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                                        </button>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2"><MagnifyingGlassPlusIcon className="h-4 w-4" /> Tamaño de Texto</label>
                                    <div className="grid grid-cols-1 gap-2">
                                        {(['normal', 'large', 'xl'] as FontSize[]).map(size => (
                                            <button key={size} onClick={() => setFontSize(size)} className={`flex items-center justify-between p-3 rounded-xl border-2 transition-all ${fontSize === size ? 'border-taller-primary bg-blue-50 dark:bg-blue-900/20 text-taller-primary' : 'border-gray-100 dark:border-gray-700 hover:bg-gray-50'}`}>
                                                <span className="capitalize">{size === 'normal' ? 'Normal' : size === 'large' ? 'Grande' : 'Extra Grande'}</span>
                                                {fontSize === size && <CheckCircleIcon className="h-5 w-5" />}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div className="space-y-3 pt-4 border-t dark:border-gray-700">
                                    <button onClick={() => setIsChangePasswordModalOpen(true)} className="w-full flex items-center justify-center gap-2 p-3 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-xl font-bold transition-all active:scale-[0.98]"><KeyIcon className="h-5 w-5" /> Cambiar Contraseña</button>
                                    <button onClick={onLogout} className="w-full flex items-center justify-center gap-2 p-3 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-xl font-bold transition-all active:scale-[0.98]"><ArrowRightOnRectangleIcon className="h-5 w-5" /> Cerrar Sesión</button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {isHistorialModalOpen && <TrabajoHistorialModal trabajos={modalTrabajos} title={modalTitle} onClose={closeHistorialModal} cliente={client} tallerInfo={tallerInfo} />}
                {isChangePasswordModalOpen && <ChangePasswordModal onClose={() => setIsChangePasswordModalOpen(false)} />}
            </div>
        </>
    );
};

export default ClientPortal;
