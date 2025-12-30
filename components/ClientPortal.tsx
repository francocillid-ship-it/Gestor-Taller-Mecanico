import React, { useState, useMemo, useEffect } from 'react';
import type { Cliente, Trabajo, TallerInfo } from '../types';
import { 
    WrenchScrewdriverIcon, 
    BookOpenIcon, 
    ClockIcon, 
    Cog6ToothIcon, 
    XMarkIcon,
    ArrowRightOnRectangleIcon,
    KeyIcon,
    MagnifyingGlassPlusIcon,
    CheckCircleIcon
} from '@heroicons/react/24/solid';
import VehicleInfoCard from './VehicleInfoCard';
import TrabajoListItem from './TrabajoListItem';
import TrabajoHistorialModal from './TrabajoHistorialModal';
import ChangePasswordModal from './ChangePasswordModal';
import { applyAppTheme } from '../constants';

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

    useEffect(() => {
        localStorage.setItem('client_font_size', fontSize);
    }, [fontSize]);

    useEffect(() => {
        applyAppTheme();
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
                                {trabajosRecientes.map(trabajo => (
                                    <TrabajoListItem key={trabajo.id} trabajo={trabajo} vehiculo={client.vehiculos.find(v => v.id === trabajo.vehiculoId)} cliente={client} tallerInfo={tallerInfo} />
                                ))}
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
                                <div className="space-y-3 pt-4">
                                    <button onClick={() => setIsChangePasswordModalOpen(true)} className="w-full flex items-center justify-center gap-2 p-3 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-xl font-bold"><KeyIcon className="h-5 w-5" /> Cambiar Contraseña</button>
                                    <button onClick={onLogout} className="w-full flex items-center justify-center gap-2 p-3 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-xl font-bold"><ArrowRightOnRectangleIcon className="h-5 w-5" /> Cerrar Sesión</button>
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