
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
    MagnifyingGlassPlusIcon
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
    
    // Settings State
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isChangePasswordModalOpen, setIsChangePasswordModalOpen] = useState(false);

    // Estado para el tamaño de fuente, inicializado desde localStorage
    const [fontSize, setFontSize] = useState<FontSize>(() => {
        return (localStorage.getItem('client_font_size') as FontSize) || 'normal';
    });
    
    // Estado para el tema del cliente (local override)
    const [clientTheme, setClientTheme] = useState<string>(() => {
        return localStorage.getItem('client_custom_theme') || tallerInfo?.appTheme || 'slate';
    });

    useEffect(() => {
        localStorage.setItem('client_font_size', fontSize);
    }, [fontSize]);

    // Apply theme on mount and change
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

    const closeHistorialModal = () => {
        setIsHistorialModalOpen(false);
    };

    const trabajosRecientes = useMemo(() => {
        return trabajos.slice(0, 5);
    }, [trabajos]);

    const getFontStyles = () => {
        if (fontSize === 'normal') return '';

        if (fontSize === 'large') {
            return `
                .portal-wrapper .text-xs { font-size: 0.85rem !important; line-height: 1.2rem !important; }
                .portal-wrapper .text-sm { font-size: 1rem !important; line-height: 1.5rem !important; }
                .portal-wrapper .text-base, .portal-wrapper .text-sm.font-medium { font-size: 1.125rem !important; line-height: 1.75rem !important; }
                .portal-wrapper .text-lg { font-size: 1.25rem !important; line-height: 1.75rem !important; }
                .portal-wrapper .text-xl { font-size: 1.5rem !important; line-height: 2rem !important; }
                .portal-wrapper .text-2xl { font-size: 1.875rem !important; line-height: 2.25rem !important; }
                .portal-wrapper .text-3xl { font-size: 2.25rem !important; line-height: 2.5rem !important; }
            `;
        }

        if (fontSize === 'xl') {
            return `
                .portal-wrapper .text-xs { font-size: 1rem !important; line-height: 1.5rem !important; }
                .portal-wrapper .text-sm { font-size: 1.15rem !important; line-height: 1.75rem !important; }
                .portal-wrapper .text-base, .portal-wrapper .text-sm.font-medium { font-size: 1.3rem !important; line-height: 1.8rem !important; }
                .portal-wrapper .text-lg { font-size: 1.5rem !important; line-height: 2rem !important; }
                .portal-wrapper .text-xl { font-size: 1.875rem !important; line-height: 2.25rem !important; }
                .portal-wrapper .text-2xl { font-size: 2.25rem !important; line-height: 2.5rem !important; }
                .portal-wrapper .text-3xl { font-size: 3rem !important; line-height: 1; }
            `;
        }
    };

    return (
        <>
            <style>{getFontStyles()}</style>
            <div className="portal-wrapper min-h-screen bg-taller-light dark:bg-taller-dark text-taller-dark dark:text-taller-light transition-all duration-200">
                <header className="bg-white dark:bg-gray-800 shadow-md sticky top-0 z-20">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
                        <div className="flex items-center gap-3 overflow-hidden">
                            {tallerInfo?.logoUrl ? (
                                <img src={tallerInfo.logoUrl} alt={tallerInfo.nombre} className="h-14 md:h-16 object-contain" />
                            ) : (
                                <>
                                    <WrenchScrewdriverIcon className="h-8 w-8 text-taller-primary flex-shrink-0"/>
                                    <h1 className="text-xl font-bold text-taller-dark dark:text-taller-light truncate">
                                        {tallerInfo?.nombre || 'Portal Cliente'}
                                    </h1>
                                </>
                            )}
                        </div>
                        
                        <div className="flex items-center gap-2 sm:gap-4">
                            <button
                                onClick={() => setIsSettingsOpen(true)}
                                className="p-2 text-taller-gray hover:text-taller-primary dark:text-gray-400 dark:hover:text-white rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                                title="Ajustes"
                            >
                                <Cog6ToothIcon className="h-7 w-7" />
                            </button>
                        </div>
                    </div>
                </header>
                
                <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                    <div className="mb-8">
                        <h2 className="text-3xl font-bold text-taller-dark dark:text-taller-light">Hola, {client.nombre}</h2>
                        <p className="text-taller-gray dark:text-gray-400 mt-1 text-base">Aquí puede ver el estado de sus trabajos y vehículos.</p>
                    </div>

                    <section className="mb-10">
                        <h3 className="text-xl font-bold text-taller-dark dark:text-taller-light mb-4">Sus Vehículos</h3>
                        <div className="space-y-4">
                            {client.vehiculos.map(vehiculo => {
                                const vehiculoTrabajos = trabajos.filter(t => t.vehiculoId === vehiculo.id);
                                return (
                                    <VehicleInfoCard 
                                        key={vehiculo.id}
                                        vehiculo={vehiculo}
                                        trabajos={vehiculoTrabajos}
                                        onViewHistory={() => openHistorialModal(vehiculoTrabajos, `Historial de ${vehiculo.marca} ${vehiculo.modelo}`)}
                                        tallerInfo={tallerInfo}
                                        cliente={client}
                                    />
                                );
                            })}
                        </div>
                    </section>
                    
                    <section>
                        <h3 className="text-xl font-bold text-taller-dark dark:text-taller-light mb-4 flex items-center gap-2">
                            <ClockIcon className="h-6 w-6 text-taller-primary" />
                            Actividad Reciente
                        </h3>
                         {trabajosRecientes.length > 0 ? (
                             <div className="space-y-3">
                                {trabajosRecientes.map(trabajo => {
                                    const vehiculo = client.vehiculos.find(v => v.id === trabajo.vehiculoId);
                                    return <TrabajoListItem key={trabajo.id} trabajo={trabajo} vehiculo={vehiculo} cliente={client} tallerInfo={tallerInfo} />;
                                })}
                                 <div className="pt-4 flex justify-center">
                                    <button 
                                        onClick={() => openHistorialModal(trabajos, 'Historial Completo de Trabajos')}
                                        className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-taller-primary rounded-lg shadow-md hover:bg-taller-secondary"
                                    >
                                        <BookOpenIcon className="h-5 w-5" />
                                        Ver Historial Completo
                                    </button>
                                </div>
                            </div>
                         ) : (
                             <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-8 text-center">
                                <p className="text-taller-gray dark:text-gray-400">No tiene trabajos registrados en este momento.</p>
                            </div>
                         )}
                    </section>
                </main>
            </div>
            
            {/* Historial Modal */}
            {isHistorialModalOpen && (
                <div className={`portal-wrapper ${fontSize !== 'normal' ? 'font-scaled' : ''}`}>
                    <TrabajoHistorialModal 
                        trabajos={modalTrabajos}
                        title={modalTitle}
                        onClose={closeHistorialModal}
                        cliente={client}
                        tallerInfo={tallerInfo}
                    />
                </div>
            )}

            {/* Settings Modal */}
            {isSettingsOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
                         <div className="flex justify-between items-center p-4 border-b dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-800 z-10">
                            <h2 className="text-lg font-bold text-taller-dark dark:text-taller-light flex items-center gap-2">
                                <Cog6ToothIcon className="h-5 w-5 text-taller-primary" />
                                Ajustes
                            </h2>
                            <button onClick={() => setIsSettingsOpen(false)} className="text-taller-gray dark:text-gray-400 hover:text-taller-dark dark:hover:text-white">
                                <XMarkIcon className="h-6 w-6" />
                            </button>
                        </div>
                        
                        <div className="p-4 space-y-6">
                            
                            {/* Theme Selection */}
                            <div>
                                <h3 className="text-sm font-semibold text-taller-gray dark:text-gray-400 mb-3 flex items-center gap-2">
                                    <SwatchIcon className="h-4 w-4" /> Tema de la Aplicación
                                </h3>
                                <div className="grid grid-cols-2 gap-2">
                                    {Object.entries(APP_THEMES).map(([key, themeDef]) => (
                                        <button
                                            key={key}
                                            onClick={() => handleThemeChange(key)}
                                            className={`flex items-center gap-2 p-2 rounded-lg border text-sm font-medium transition-all ${
                                                clientTheme === key
                                                    ? 'border-taller-primary bg-taller-light dark:bg-gray-700 ring-1 ring-taller-primary'
                                                    : 'border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                                            }`}
                                        >
                                            <div className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: `rgb(${themeDef.primary})` }}></div>
                                            <span className="text-taller-dark dark:text-taller-light">{themeDef.name}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Font Size Selection */}
                            <div>
                                <h3 className="text-sm font-semibold text-taller-gray dark:text-gray-400 mb-3 flex items-center gap-2">
                                    <MagnifyingGlassPlusIcon className="h-4 w-4" /> Tamaño de la Fuente
                                </h3>
                                <div className="flex gap-2 bg-gray-100 dark:bg-gray-700/50 p-1 rounded-lg">
                                    {[
                                        { id: 'normal', label: 'Normal' },
                                        { id: 'large', label: 'Grande' },
                                        { id: 'xl', label: 'Extra' }
                                    ].map((opt) => (
                                        <button
                                            key={opt.id}
                                            onClick={() => setFontSize(opt.id as FontSize)}
                                            className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-all ${
                                                fontSize === opt.id
                                                    ? 'bg-white dark:bg-gray-600 text-taller-primary shadow-sm'
                                                    : 'text-taller-gray dark:text-gray-400 hover:text-taller-dark dark:hover:text-white'
                                            }`}
                                        >
                                            {opt.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Account Actions */}
                            <div className="border-t dark:border-gray-700 pt-4 space-y-3">
                                <h3 className="text-sm font-semibold text-taller-gray dark:text-gray-400 mb-2">Cuenta</h3>
                                
                                <button
                                    onClick={() => setIsChangePasswordModalOpen(true)}
                                    className="w-full flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-700/30 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-left"
                                >
                                    <span className="flex items-center gap-2 text-sm font-medium text-taller-dark dark:text-taller-light">
                                        <KeyIcon className="h-4 w-4 text-taller-gray dark:text-gray-400" />
                                        Cambiar Contraseña
                                    </span>
                                </button>

                                <button 
                                    onClick={onLogout}
                                    className="w-full flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold text-white bg-red-600 rounded-lg shadow-sm hover:bg-red-700 transition-colors"
                                >
                                    <ArrowRightOnRectangleIcon className="h-5 w-5" />
                                    Cerrar Sesión
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {isChangePasswordModalOpen && (
                <ChangePasswordModal onClose={() => setIsChangePasswordModalOpen(false)} />
            )}
        </>
    );
};

export default ClientPortal;
