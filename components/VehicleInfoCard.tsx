import React, { useState } from 'react';
import type { Vehiculo, Trabajo, Cliente, TallerInfo } from '../types';
import { ChevronDownIcon, DocumentTextIcon, Cog8ToothIcon, WrenchIcon, BookOpenIcon } from '@heroicons/react/24/solid';
import TrabajoListItem from './TrabajoListItem';

interface VehicleInfoCardProps {
    vehiculo: Vehiculo;
    trabajos: Trabajo[];
    onViewHistory: () => void;
    cliente: Cliente;
    tallerInfo: TallerInfo | null;
}

const VehicleInfoCard: React.FC<VehicleInfoCardProps> = ({ vehiculo, trabajos, onViewHistory, cliente, tallerInfo }) => {
    const [isExpanded, setIsExpanded] = useState(false);

    const ultimosTrabajos = trabajos.slice(0, 3);

    return (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden transition-all duration-300">
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full p-4 flex justify-between items-center text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 focus:outline-none"
            >
                <div>
                    <h4 className="font-bold text-lg text-taller-dark dark:text-taller-light">{vehiculo.marca} {vehiculo.modelo} ({vehiculo.año})</h4>
                    <p className="text-sm text-taller-gray dark:text-gray-400">{vehiculo.matricula}</p>
                </div>
                <div className="flex items-center">
                    <span className="text-sm font-semibold text-taller-primary mr-4">{trabajos.length} trabajos</span>
                    <ChevronDownIcon className={`h-6 w-6 text-taller-gray dark:text-gray-400 transform transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                </div>
            </button>
            {isExpanded && (
                <div className="p-4 border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 mb-6 text-sm">
                        <div className="flex items-start">
                            <DocumentTextIcon className="h-5 w-5 mr-3 mt-0.5 text-taller-gray dark:text-gray-400 flex-shrink-0"/>
                            <div>
                                <p className="font-semibold text-taller-dark dark:text-taller-light">Nº Chasis</p>
                                <p className="text-taller-gray dark:text-gray-300">{vehiculo.numero_chasis || 'No especificado'}</p>
                            </div>
                        </div>
                        <div className="flex items-start">
                             <Cog8ToothIcon className="h-5 w-5 mr-3 mt-0.5 text-taller-gray dark:text-gray-400 flex-shrink-0"/>
                            <div>
                                <p className="font-semibold text-taller-dark dark:text-taller-light">Nº Motor</p>
                                <p className="text-taller-gray dark:text-gray-300">{vehiculo.numero_motor || 'No especificado'}</p>
                            </div>
                        </div>
                    </div>

                    <h5 className="font-semibold mb-3 text-taller-dark dark:text-taller-light flex items-center gap-2">
                        <WrenchIcon className="h-5 w-5 text-taller-gray dark:text-gray-400"/>
                        Últimas Reparaciones
                    </h5>
                    <div className="space-y-3">
                        {ultimosTrabajos.length > 0 ? (
                            ultimosTrabajos.map(trabajo => <TrabajoListItem key={trabajo.id} trabajo={trabajo} cliente={cliente} tallerInfo={tallerInfo} vehiculo={vehiculo} />)
                        ) : (
                            <p className="text-sm text-taller-gray dark:text-gray-400 pl-7">No hay reparaciones recientes para este vehículo.</p>
                        )}
                    </div>

                    <div className="mt-4 flex justify-end">
                        <button
                            onClick={onViewHistory}
                            className="flex items-center gap-2 px-3 py-1.5 text-sm font-semibold text-taller-secondary bg-blue-50 border border-taller-secondary/50 rounded-lg shadow-sm hover:bg-blue-100 dark:text-blue-300 dark:bg-blue-900/30 dark:border-blue-500/50 dark:hover:bg-blue-900/50"
                        >
                           <BookOpenIcon className="h-4 w-4"/>
                            Ver Historial del Vehículo
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default VehicleInfoCard;
