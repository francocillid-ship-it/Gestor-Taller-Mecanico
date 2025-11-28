
import React, { useState, useMemo, useEffect } from 'react';
import type { Cliente, Trabajo, TallerInfo } from '../types';
import { ArrowRightOnRectangleIcon, WrenchScrewdriverIcon, BookOpenIcon, ClockIcon,  ComputerDesktopIcon } from '@heroicons/react/24/solid';
import VehicleInfoCard from './VehicleInfoCard';
import TrabajoListItem from './TrabajoListItem';
import TrabajoHistorialModal from './TrabajoHistorialModal';

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
    
    // Estado para el tamaño de fuente, inicializado desde localStorage
    const [fontSize, setFontSize] = useState<FontSize>(() => {
        return (localStorage.getItem('client_font_size') as FontSize) || 'normal';
    });
    
    const [showFontMenu, setShowFontMenu] = useState(false);

    useEffect(() => {
        localStorage.setItem('client_font_size', fontSize);
    }, [fontSize]);

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

    // Lógica para inyectar estilos dinámicos que sobrescriben las clases de Tailwind
    // Esto permite que toda la interfaz escale proporcionalmente
    const getFontStyles = () => {
        if (fontSize === 'normal') return '';

        // Definimos los escalas. 
        // Large sube 1 nivel aprox.
        // XL sube 2 niveles aprox.
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
                            <WrenchScrewdriverIcon className="h-8 w-8 text-taller-primary flex-shrink-0"/>
                            <h1 className="text-xl font-bold text-taller-dark dark:text-taller-light truncate">
                                {tallerInfo?.nombre || 'Portal Cliente'}
                            </h1>
                        </div>
                        
                        <div className="flex items-center gap-2 sm:gap-4">
                            {/* Selector de Apariencia */}
                            <div className="relative">
                                <button
                                    onClick={() => setShowFontMenu(!showFontMenu)}
                                    className="p-2 text-taller-gray hover:text-taller-primary dark:text-gray-400 dark:hover:text-white rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                                    title="Tamaño de letra"
                                >
                                    <span className="font-serif font-bold text-lg">Aa</span>
                                </button>
                                
                                {showFontMenu && (
                                    <>
                                        <div className="fixed inset-0 z-10" onClick={() => setShowFontMenu(false)} />
                                        <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-700 rounded-md shadow-lg z-20 border dark:border-gray-600 py-1">
                                            <p className="px-4 py-2 text-xs font-semibold text-taller-gray dark:text-gray-400 uppercase tracking-wider">
                                                Tamaño de letra
                                            </p>
                                            <button
                                                onClick={() => { setFontSize('normal'); setShowFontMenu(false); }}
                                                className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-600 flex items-center justify-between ${fontSize === 'normal' ? 'text-taller-primary font-bold bg-blue-50 dark:bg-blue-900/30' : 'text-taller-dark dark:text-gray-200'}`}
                                            >
                                                <span>Normal</span>
                                            </button>
                                            <button
                                                onClick={() => { setFontSize('large'); setShowFontMenu(false); }}
                                                className={`w-full text-left px-4 py-2 text-base hover:bg-gray-100 dark:hover:bg-gray-600 flex items-center justify-between ${fontSize === 'large' ? 'text-taller-primary font-bold bg-blue-50 dark:bg-blue-900/30' : 'text-taller-dark dark:text-gray-200'}`}
                                            >
                                                <span>Grande</span>
                                            </button>
                                            <button
                                                onClick={() => { setFontSize('xl'); setShowFontMenu(false); }}
                                                className={`w-full text-left px-4 py-2 text-lg hover:bg-gray-100 dark:hover:bg-gray-600 flex items-center justify-between ${fontSize === 'xl' ? 'text-taller-primary font-bold bg-blue-50 dark:bg-blue-900/30' : 'text-taller-dark dark:text-gray-200'}`}
                                            >
                                                <span>Muy Grande</span>
                                            </button>
                                        </div>
                                    </>
                                )}
                            </div>

                            <button 
                                onClick={onLogout}
                                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-red-700 bg-red-100 rounded-lg hover:bg-red-200 dark:bg-red-900/50 dark:text-red-300 dark:hover:bg-red-900"
                            >
                                <ArrowRightOnRectangleIcon className="h-5 w-5" />
                                <span className="hidden sm:inline">Salir</span>
                            </button>
                        </div>
                    </div>
                </header>
                
                <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                    <div className="mb-8">
                        <h2 className="text-3xl font-bold text-taller-dark dark:text-taller-light">Bienvenido, {client.nombre}</h2>
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
            
            {/* El modal debe estar fuera del wrapper portal-wrapper si no queremos que herede el tamaño gigante en su estructura base, 
                pero si queremos que el contenido del modal sea grande, debemos envolver su contenido o aplicarle la clase. 
                En este caso, dejamos que herede para mantener consistencia. */}
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
        </>
    );
};

export default ClientPortal;
