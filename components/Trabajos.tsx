
import React, { useMemo, useState, useEffect } from 'react';
import type { Trabajo, Cliente, TallerInfo } from '../types';
import { JobStatus } from '../types';
import JobCard from './JobCard';
import CrearTrabajoModal from './CrearTrabajoModal';
import { PlusIcon, ChevronUpIcon, ChevronDownIcon, MagnifyingGlassIcon } from '@heroicons/react/24/solid';

interface TrabajosProps {
    trabajos: Trabajo[];
    clientes: Cliente[];
    onUpdateStatus: (trabajoId: string, newStatus: JobStatus) => void;
    onDataRefresh: () => void;
    tallerInfo: TallerInfo;
    searchQuery: string;
}

const statusOrder = [JobStatus.Presupuesto, JobStatus.Programado, JobStatus.EnProceso, JobStatus.Finalizado];

const StatusColumn: React.FC<{
    status: JobStatus;
    trabajos: Trabajo[];
    clientes: Cliente[];
    onUpdateStatus: (trabajoId: string, newStatus: JobStatus) => void;
    tallerInfo: TallerInfo;
    onDataRefresh: () => void;
    searchQuery: string;
}> = ({ status, trabajos, clientes, onUpdateStatus, tallerInfo, onDataRefresh, searchQuery }) => {
    const [isExpanded, setIsExpanded] = useState(false);

    // Effect to handle auto-expansion based on search results
    useEffect(() => {
        if (searchQuery.trim().length > 0) {
            // If searching, only expand if there are matches in this column
            // If no matches, collapse it to reduce visual noise
            setIsExpanded(trabajos.length > 0);
        } else {
            // If search is cleared, revert to default collapsed state
            setIsExpanded(false);
        }
    }, [searchQuery, trabajos.length]);

    const getStatusColor = (status: JobStatus) => {
        switch (status) {
            case JobStatus.Presupuesto: return 'border-yellow-400';
            case JobStatus.Programado: return 'border-blue-400';
            case JobStatus.EnProceso: return 'border-orange-400';
            case JobStatus.Finalizado: return 'border-green-400';
            default: return 'border-gray-400';
        }
    };

    return (
        <div className={`w-full lg:w-80 bg-gray-100 dark:bg-gray-800 rounded-lg p-3 lg:flex-shrink-0 transition-all duration-500 ease-in-out ${!isExpanded ? 'h-fit' : ''}`}>
            <div 
                className={`flex justify-between items-center ${isExpanded ? 'mb-4 border-b-2' : ''} pb-2 ${getStatusColor(status)} cursor-pointer hover:opacity-80 transition-all duration-300`}
                onClick={() => setIsExpanded(!isExpanded)}
            >
                 <div className="flex items-center gap-2">
                    <h3 className="font-bold text-taller-dark dark:text-taller-light transition-colors duration-300">{status}</h3>
                    <span className={`text-xs font-semibold px-2 py-1 rounded-full transition-all duration-300 ${trabajos.length > 0 ? 'bg-taller-primary text-white' : 'bg-gray-300 text-gray-600 dark:bg-gray-700 dark:text-gray-400'}`}>
                        {trabajos.length}
                    </span>
                 </div>
                 <div className="transform transition-transform duration-300">
                    {isExpanded ? (
                        <ChevronUpIcon className="h-5 w-5 text-taller-gray dark:text-gray-400" />
                    ) : (
                        <ChevronDownIcon className="h-5 w-5 text-taller-gray dark:text-gray-400" />
                    )}
                 </div>
            </div>
           
            <div className={`space-y-4 lg:overflow-y-auto lg:pr-1 transition-all duration-500 ease-in-out ${isExpanded ? 'opacity-100 max-h-[1000px] lg:max-h-[calc(100vh-20rem)]' : 'opacity-0 max-h-0 overflow-hidden'}`}>
                {trabajos.length > 0 ? (
                    trabajos.map(trabajo => {
                        const cliente = clientes.find(c => c.id === trabajo.clienteId);
                        const vehiculo = cliente?.vehiculos.find(v => v.id === trabajo.vehiculoId);
                        return (
                            <JobCard
                                key={trabajo.id}
                                trabajo={trabajo}
                                cliente={cliente}
                                vehiculo={vehiculo}
                                onUpdateStatus={onUpdateStatus}
                                tallerInfo={tallerInfo}
                                clientes={clientes}
                                onDataRefresh={onDataRefresh}
                            />
                        );
                    })
                ) : (
                    <div className="py-8 text-center animate-pulse">
                        <p className="text-sm text-taller-gray dark:text-gray-400">
                            {searchQuery ? "No hay coincidencias." : "No hay trabajos en este estado."}
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};


const Trabajos: React.FC<TrabajosProps> = ({ trabajos, clientes, onUpdateStatus, onDataRefresh, tallerInfo, searchQuery }) => {
    const [isJobModalOpen, setIsJobModalOpen] = useState(false);
    
    const trabajosByStatus = useMemo(() => {
        let filteredTrabajos = trabajos;
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            filteredTrabajos = trabajos.filter(t => {
                const cliente = clientes.find(c => c.id === t.clienteId);
                const vehiculo = cliente?.vehiculos.find(v => v.id === t.vehiculoId);
                return (
                    t.descripcion.toLowerCase().includes(query) ||
                    cliente?.nombre.toLowerCase().includes(query) ||
                    vehiculo?.marca.toLowerCase().includes(query) ||
                    vehiculo?.modelo.toLowerCase().includes(query) ||
                    vehiculo?.matricula.toLowerCase().includes(query) ||
                    t.status.toLowerCase().includes(query)
                );
            });
        }

        return statusOrder.reduce((acc, status) => {
            acc[status] = filteredTrabajos.filter(t => t.status === status).sort((a,b) => new Date(b.fechaEntrada).getTime() - new Date(a.fechaEntrada).getTime());
            return acc;
        }, {} as Record<JobStatus, Trabajo[]>);
    }, [trabajos, searchQuery, clientes]);

    // Check if there are any results at all across all columns
    const hasResults = useMemo(() => (Object.values(trabajosByStatus) as Trabajo[][]).some(list => list.length > 0), [trabajosByStatus]);
    
    return (
        <div className="h-full flex flex-col">
            <div className="flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-center mb-6">
                <h2 className="text-2xl font-bold text-taller-dark dark:text-taller-light">Flujo de Trabajos</h2>
                <div className="flex">
                    <button
                        onClick={() => setIsJobModalOpen(true)}
                        className="flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-taller-primary rounded-lg shadow-md hover:bg-taller-secondary focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-taller-secondary transition-colors"
                    >
                       <PlusIcon className="h-5 w-5"/>
                        Nuevo Presupuesto
                    </button>
                </div>
            </div>
            <div className="flex-1 flex flex-col gap-4 lg:gap-6 lg:flex-row lg:space-x-4 lg:overflow-x-auto pb-4">
                {searchQuery && !hasResults ? (
                    <div className="w-full flex flex-col items-center justify-center mt-12 text-taller-gray dark:text-gray-400">
                        <MagnifyingGlassIcon className="h-16 w-16 mb-4 opacity-50"/>
                        <p className="text-lg font-medium">No se encontraron resultados para "{searchQuery}"</p>
                        <p className="text-sm mt-2 opacity-75">Intenta buscar por cliente, vehículo o descripción.</p>
                    </div>
                ) : (
                    statusOrder.map(status => {
                        const jobs = trabajosByStatus[status] || [];
                        
                        // Hide column if searching and no matches in this column to save space (esp. on mobile)
                        if (searchQuery && jobs.length === 0) return null;

                        return (
                            <StatusColumn
                                key={status}
                                status={status}
                                trabajos={jobs}
                                clientes={clientes}
                                onUpdateStatus={onUpdateStatus}
                                tallerInfo={tallerInfo}
                                onDataRefresh={onDataRefresh}
                                searchQuery={searchQuery}
                            />
                        );
                    })
                )}
                {/* Spacer for bottom nav on mobile */}
                {tallerInfo.mobileNavStyle === 'bottom_nav' && <div className="h-16 md:hidden flex-shrink-0" />}
            </div>

            {isJobModalOpen && (
                <CrearTrabajoModal
                    clientes={clientes}
                    onClose={() => setIsJobModalOpen(false)}
                    onSuccess={() => {
                        setIsJobModalOpen(false);
                        onDataRefresh();
                    }}
                    onDataRefresh={onDataRefresh}
                />
            )}
        </div>
    );
};

export default Trabajos;
