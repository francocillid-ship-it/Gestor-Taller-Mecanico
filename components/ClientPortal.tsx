import React, { useState, useMemo } from 'react';
import type { Cliente, Trabajo, TallerInfo } from '../types';
import { ArrowRightOnRectangleIcon, WrenchScrewdriverIcon, BookOpenIcon, ClockIcon } from '@heroicons/react/24/solid';
import VehicleInfoCard from './VehicleInfoCard';
import TrabajoListItem from './TrabajoListItem';
import TrabajoHistorialModal from './TrabajoHistorialModal';

interface ClientPortalProps {
    client: Cliente;
    trabajos: Trabajo[];
    onLogout: () => void;
    tallerInfo: TallerInfo | null;
}

const ClientPortal: React.FC<ClientPortalProps> = ({ client, trabajos, onLogout, tallerInfo }) => {
    const [isHistorialModalOpen, setIsHistorialModalOpen] = useState(false);
    const [modalTrabajos, setModalTrabajos] = useState<Trabajo[]>([]);
    const [modalTitle, setModalTitle] = useState('');

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

    return (
        <>
            <div className="min-h-screen bg-taller-light dark:bg-taller-dark text-taller-dark dark:text-taller-light">
                <header className="bg-white dark:bg-gray-800 shadow-md sticky top-0 z-20">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
                        <div className="flex items-center gap-3">
                            <WrenchScrewdriverIcon className="h-8 w-8 text-taller-primary"/>
                            <h1 className="text-xl font-bold text-taller-dark dark:text-taller-light">{tallerInfo?.nombre || 'Portal Cliente'}</h1>
                        </div>
                        <button 
                            onClick={onLogout}
                            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-red-700 bg-red-100 rounded-lg hover:bg-red-200 dark:bg-red-900/50 dark:text-red-300 dark:hover:bg-red-900"
                        >
                            <ArrowRightOnRectangleIcon className="h-5 w-5" />
                            <span className="hidden sm:inline">Salir</span>
                        </button>
                    </div>
                </header>
                
                <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                    <div className="mb-8">
                        <h2 className="text-3xl font-bold text-taller-dark dark:text-taller-light">Bienvenido, {client.nombre}</h2>
                        <p className="text-taller-gray dark:text-gray-400 mt-1">Aquí puede ver el estado de sus trabajos y vehículos.</p>
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
            {isHistorialModalOpen && (
                <TrabajoHistorialModal 
                    trabajos={modalTrabajos}
                    title={modalTitle}
                    onClose={closeHistorialModal}
                    cliente={client}
                    tallerInfo={tallerInfo}
                />
            )}
        </>
    );
};

export default ClientPortal;
