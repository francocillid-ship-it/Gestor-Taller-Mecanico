import React, { useState, useMemo, useEffect } from 'react';
import type { Cliente, Trabajo, TallerInfo } from '../types';
import { 
    WrenchScrewdriverIcon, 
    BookOpenIcon, 
    ClockIcon, 
    Cog6ToothIcon, 
    XMarkIcon,
    SwatchIcon,
    ArrowRightOnRectangleIcon,
    KeyIcon,
    MagnifyingGlassPlusIcon,
    // Fix: Added missing CheckCircleIcon import
    CheckCircleIcon
} from '@heroicons/react/24/solid';
import VehicleInfoCard from './VehicleInfoCard';
import TrabajoListItem from './TrabajoListItem';
import TrabajoHistorialModal from './TrabajoHistorialModal';
import ChangePasswordModal from './ChangePasswordModal';
import { APP_THEMES, applyAppTheme } from '../constants';

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
    const [clientTheme, setClientTheme] = useState<string>(() => localStorage.getItem('client_custom_theme') || tallerInfo?.appTheme || 'slate');

    useEffect(() => {
        localStorage.setItem('client_font_size', fontSize);
    }, [fontSize]);

    useEffect(() => {
        const savedTheme = localStorage.getItem('client_custom_theme');
        if (savedTheme) {
            applyAppTheme(savedTheme);
            setClientTheme(savedTheme);
        } else if (tallerInfo?.appTheme) {
            applyAppTheme(tallerInfo.appTheme);
            setClientTheme(tallerInfo.appTheme);
        }
    }, [tallerInfo]);

    const handleThemeChange = (themeKey: string) => {
        setClientTheme(themeKey);
        applyAppTheme(themeKey);
        localStorage.setItem('client_custom_theme', themeKey);
    };

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

    return (
        <>
            <style>{getFontStyles()}</style>
            <div className="portal-wrapper h-[100dvh] w-full bg-taller-light dark:bg-taller-dark text-taller-dark dark:text-taller-light transition-all duration-200 flex flex-col overflow-hidden">
                <header className="bg-white dark:bg-gray-800 shadow-md flex-shrink-0 z-20">
                    <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
                        <div className="flex items-center gap-3">
                            {tallerInfo?.logoUrl ? <img src={tallerInfo.logoUrl} alt="Logo" className="h-14 object-contain" /> : <h1 className="text-xl font-bold truncate">{tallerInfo?.nombre || 'Portal Cliente'}</h1>}
                        </div>
                        <button onClick={openSettings} className="p-2 text-taller-gray hover:text-taller-primary rounded-full hover:bg-gray-100 transition-colors"><Cog6ToothIcon className="h-7 w-7" /></button>
                    </div>
                </header>
                
                <main className="flex-1 overflow-y-auto overscroll-contain">
                    <div className="max-w-7xl mx-auto px-4 py-8">
                        <h2 className="text-3xl font-bold mb-8">Hola, {client.nombre}</h2>
                        <section className="mb-10 space-y-4">
                            <h3 className="text-xl font-bold mb-4">Sus Vehículos</h3>
                            {client.vehiculos.map(vehiculo => (
                                <VehicleInfoCard key={vehiculo.id} vehiculo={vehiculo} trabajos={trabajos.filter(t => t.vehiculoId === vehiculo.id)} onViewHistory={() => openHistorialModal(trabajos.filter(t => t.vehiculoId === vehiculo.id), `Historial de ${vehiculo.marca}`)} tallerInfo={tallerInfo} cliente={client} />
                            ))}
                        </section>
                        <section>
                            <h3 className="text-xl font-bold mb-4 flex items-center gap-2"><ClockIcon className="h-6 w-6 text-taller-primary" />Actividad Reciente</h3>
                            {trabajosRecientes.length > 0 ? (
                                <div className="space-y-3">
                                    {trabajosRecientes.map(trabajo => <TrabajoListItem key={trabajo.id} trabajo={trabajo} vehiculo={client.vehiculos.find(v => v.id === trabajo.vehiculoId)} cliente={client} tallerInfo={tallerInfo} />)}
                                    <div className="pt-4 flex justify-center"><button onClick={() => openHistorialModal(trabajos, 'Historial Completo')} className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-taller-primary rounded-lg shadow-md">Ver Todo</button></div>
                                </div>
                            ) : <p className="text-center py-8">No tiene trabajos registrados.</p>}
                        </section>
                    </div>
                </main>
            </div>
            
            {isHistorialModalOpen && <TrabajoHistorialModal trabajos={modalTrabajos} title={modalTitle} onClose={closeHistorialModal} cliente={client} tallerInfo={tallerInfo} />}

            {isSettingsOpen && (
                <div className="fixed inset-0 z-50 flex justify-center items-center p-4">
                    <div className={`fixed inset-0 bg-black/50 transition-opacity ${isSettingsVisible ? 'opacity-100' : 'opacity-0'}`} onClick={closeSettings}/>
                    <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md max-h-[80dvh] overflow-y-auto relative z-10 transform transition-all ${isSettingsVisible ? 'scale-100 opacity-100' : 'scale-95 opacity-0'}`}>
                         <div className="flex justify-between items-center p-4 border-b sticky top-0 bg-white dark:bg-gray-800 z-10"><h2 className="text-lg font-bold flex items-center gap-2"><Cog6ToothIcon className="h-5 w-5 text-taller-primary" />Ajustes</h2><button onClick={closeSettings}><XMarkIcon className="h-6 w-6" /></button></div>
                        <div className="p-4 space-y-6">
                            <div>
                                <h3 className="text-sm font-semibold text-taller-gray mb-3 flex items-center gap-2"><SwatchIcon className="h-4 w-4" /> Color del Portal</h3>
                                <div className="flex flex-wrap gap-4 justify-center">
                                    {Object.entries(APP_THEMES).map(([key, themeDef]) => (
                                        <button
                                            key={key}
                                            onClick={() => handleThemeChange(key)}
                                            title={themeDef.name}
                                            className={`relative w-10 h-10 rounded-full transition-all transform hover:scale-110 shadow-sm
                                                ${clientTheme === key ? 'ring-4 ring-taller-primary ring-offset-2 scale-110' : ''}
                                            `}
                                            style={{ backgroundColor: `rgb(${themeDef.primary})` }}
                                        >
                                            {clientTheme === key && <CheckCircleIcon className="h-6 w-6 text-white mx-auto" />}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <h3 className="text-sm font-semibold text-taller-gray mb-3 flex items-center gap-2"><MagnifyingGlassPlusIcon className="h-4 w-4" /> Tamaño de Letra</h3>
                                <div className="flex gap-2 bg-gray-100 dark:bg-gray-700/50 p-1 rounded-lg">
                                    {['normal', 'large', 'xl'].map((opt) => (
                                        <button key={opt} onClick={() => setFontSize(opt as any)} className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-all ${fontSize === opt ? 'bg-white dark:bg-gray-600 text-taller-primary shadow-sm' : 'text-taller-gray'}`}>
                                            {opt === 'normal' ? 'Normal' : opt === 'large' ? 'Grande' : 'XL'}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="border-t pt-4 space-y-3">
                                <button onClick={() => setIsChangePasswordModalOpen(true)} className="w-full flex items-center gap-2 p-3 rounded-lg bg-gray-50 dark:bg-gray-700/30 text-sm font-medium"><KeyIcon className="h-4 w-4" />Cambiar Contraseña</button>
                                <button onClick={onLogout} className="w-full flex items-center justify-center gap-2 p-3 text-sm font-semibold text-white bg-red-600 rounded-lg">Cerrar Sesión</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {isChangePasswordModalOpen && <ChangePasswordModal onClose={() => setIsChangePasswordModalOpen(false)} />}
        </>
    );
};

export default ClientPortal;