import React, { useMemo, useState } from 'react';
import type { Trabajo, Cliente } from '../types';
import { JobStatus } from '../types';
import JobCard from './JobCard';
import CrearTrabajoModal from './CrearTrabajoModal';
import type { TallerInfo } from './TallerDashboard';
import { PlusIcon } from '@heroicons/react/24/solid';

interface TrabajosProps {
    trabajos: Trabajo[];
    clientes: Cliente[];
    onUpdateStatus: (trabajoId: string, newStatus: JobStatus) => void;
    onDataRefresh: () => void;
    tallerInfo: TallerInfo;
}

const statusOrder = [JobStatus.Presupuesto, JobStatus.Programado, JobStatus.EnProceso, JobStatus.Finalizado];

const StatusColumn: React.FC<{
    status: JobStatus;
    trabajos: Trabajo[];
    clientes: Cliente[];
    onUpdateStatus: (trabajoId: string, newStatus: JobStatus) => void;
    tallerInfo: TallerInfo;
    onDataRefresh: () => void;
}> = ({ status, trabajos, clientes, onUpdateStatus, tallerInfo, onDataRefresh }) => {

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
        <div className="w-full lg:w-80 bg-gray-100 rounded-lg p-3 lg:flex-shrink-0">
            <div className={`flex justify-between items-center mb-4 pb-2 border-b-2 ${getStatusColor(status)}`}>
                 <h3 className="font-bold text-taller-dark">{status}</h3>
                 <span className="bg-taller-primary text-white text-xs font-semibold px-2 py-1 rounded-full">{trabajos.length}</span>
            </div>
           
            <div className="space-y-4 lg:overflow-y-auto lg:h-[calc(100vh-20rem)] lg:pr-1">
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
                    <p className="text-sm text-center text-taller-gray py-4">No hay trabajos en este estado.</p>
                )}
            </div>
        </div>
    );
};


const Trabajos: React.FC<TrabajosProps> = ({ trabajos, clientes, onUpdateStatus, onDataRefresh, tallerInfo }) => {
    const [isJobModalOpen, setIsJobModalOpen] = useState(false);
    
    const trabajosByStatus = useMemo(() => {
        return statusOrder.reduce((acc, status) => {
            acc[status] = trabajos.filter(t => t.status === status).sort((a,b) => new Date(b.fechaEntrada).getTime() - new Date(a.fechaEntrada).getTime());
            return acc;
        }, {} as Record<JobStatus, Trabajo[]>);
    }, [trabajos]);
    
    return (
        <div className="h-full flex flex-col">
            <div className="flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-center mb-6">
                <h2 className="text-2xl font-bold text-taller-dark">Flujo de Trabajos</h2>
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
            <div className="flex-1 flex flex-col gap-6 lg:flex-row lg:space-x-4 lg:overflow-x-auto pb-4">
                {statusOrder.map(status => (
                    <StatusColumn
                        key={status}
                        status={status}
                        trabajos={trabajosByStatus[status] || []}
                        clientes={clientes}
                        onUpdateStatus={onUpdateStatus}
                        tallerInfo={tallerInfo}
                        onDataRefresh={onDataRefresh}
                    />
                ))}
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