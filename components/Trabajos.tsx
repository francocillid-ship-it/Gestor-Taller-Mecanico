import React, { useState } from 'react';
import type { Trabajo, Cliente } from '../types';
import { JobStatus } from '../types';
import JobCard from './JobCard';
import { ChevronDownIcon } from '@heroicons/react/24/solid';

interface TrabajosProps {
    trabajos: Trabajo[];
    clientes: Cliente[];
    onUpdateStatus: (trabajoId: string, newStatus: JobStatus) => void;
}

const statusConfig = {
    [JobStatus.Presupuesto]: { title: 'Presupuesto', color: 'bg-yellow-500' },
    [JobStatus.Programado]: { title: 'Programado', color: 'bg-blue-500' },
    [JobStatus.EnProceso]: { title: 'En Proceso', color: 'bg-orange-500' },
    [JobStatus.Finalizado]: { title: 'Finalizado', color: 'bg-green-500' },
};

const JobColumn: React.FC<{
    status: JobStatus;
    trabajos: Trabajo[];
    clientes: Cliente[];
    onUpdateStatus: (trabajoId: string, newStatus: JobStatus) => void;
    isCollapsedOnMobile: boolean;
    onToggleCollapse: () => void;
}> = ({ status, trabajos, clientes, onUpdateStatus, isCollapsedOnMobile, onToggleCollapse }) => {
    const config = statusConfig[status];

    const getClientById = (id: string) => clientes.find(c => c.id === id);
    const getVehicleById = (clientId: string, vehicleId: string) => {
        const client = getClientById(clientId);
        return client?.vehiculos.find(v => v.id === vehicleId);
    };

    return (
        <div className="w-full md:flex md:flex-col md:w-1/4">
            <div className="bg-white md:bg-taller-light rounded-lg flex flex-col h-full shadow-sm md:shadow-none">
                {/* Header: clickable on mobile, static on desktop */}
                <button
                    onClick={onToggleCollapse}
                    className="flex items-center justify-between w-full p-4 rounded-t-lg bg-white md:bg-taller-light md:cursor-default"
                    aria-expanded={!isCollapsedOnMobile}
                >
                    <div className="flex items-center">
                        <span className={`h-3 w-3 rounded-full ${config.color} mr-2`}></span>
                        <h3 className="font-bold text-lg text-taller-dark">{config.title} <span className="text-base font-medium text-taller-gray">({trabajos.length})</span></h3>
                    </div>
                    {/* Chevron icon only visible on mobile */}
                    <ChevronDownIcon className={`h-6 w-6 text-taller-gray transition-transform md:hidden ${!isCollapsedOnMobile ? 'rotate-180' : ''}`} />
                </button>

                {/* Body: Collapsible on mobile, always visible and scrollable on desktop */}
                <div className={`space-y-4 p-4 pt-0 md:p-2 md:flex-1 md:overflow-y-auto ${isCollapsedOnMobile ? 'hidden' : ''} md:block`}>
                    {trabajos.length > 0 ? (
                        trabajos.map(trabajo => (
                            <JobCard
                                key={trabajo.id}
                                trabajo={trabajo}
                                cliente={getClientById(trabajo.clienteId)}
                                vehiculo={getVehicleById(trabajo.clienteId, trabajo.vehiculoId)}
                                onUpdateStatus={onUpdateStatus}
                            />
                        ))
                    ) : (
                        <div className="flex items-center justify-center h-24 text-sm text-taller-gray border-2 border-dashed rounded-lg bg-white/50">
                            No hay trabajos aquí.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};


const Trabajos: React.FC<TrabajosProps> = ({ trabajos, clientes, onUpdateStatus }) => {
    const [collapsedMobile, setCollapsedMobile] = useState<JobStatus[]>([]);

    const toggleCollapse = (status: JobStatus) => {
        setCollapsedMobile(prev =>
            prev.includes(status)
                ? prev.filter(s => s !== status)
                : [...prev, status]
        );
    };
    
    const trabajosPorEstado = (status: JobStatus) => trabajos.filter(t => t.status === status);

    return (
        <div className="pb-16 md:pb-0 md:flex md:flex-col h-full">
            <h2 className="text-2xl font-bold text-taller-dark mb-6">Gestión de Trabajos</h2>
            <div className="flex-1 flex flex-col md:flex-row md:space-x-4 space-y-4 md:space-y-0 min-h-0">
                {Object.values(JobStatus).map(status => (
                    <JobColumn
                        key={status}
                        status={status}
                        trabajos={trabajosPorEstado(status)}
                        clientes={clientes}
                        onUpdateStatus={onUpdateStatus}
                        isCollapsedOnMobile={collapsedMobile.includes(status)}
                        onToggleCollapse={() => toggleCollapse(status)}
                    />
                ))}
            </div>
        </div>
    );
};

export default Trabajos;