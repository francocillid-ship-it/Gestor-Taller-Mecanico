
import React, { useState } from 'react';
import type { Trabajo, Cliente, Vehiculo } from '../types';
import { JobStatus } from '../types';
import { ChevronDownIcon, ChevronUpIcon, UserCircleIcon, WrenchIcon, ArrowRightIcon } from '@heroicons/react/24/solid';

interface JobCardProps {
    trabajo: Trabajo;
    cliente?: Cliente;
    vehiculo?: Vehiculo;
    onUpdateStatus: (trabajoId: string, newStatus: JobStatus) => void;
}

const JobCard: React.FC<JobCardProps> = ({ trabajo, cliente, vehiculo, onUpdateStatus }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    
    const totalPartes = trabajo.partes.reduce((sum, p) => sum + (p.cantidad * p.precioUnitario), 0);
    const costoFinal = totalPartes + (trabajo.costoManoDeObra || 0);

    const getNextStatus = (): JobStatus | null => {
        switch (trabajo.status) {
            case JobStatus.Presupuesto: return JobStatus.Programado;
            case JobStatus.Programado: return JobStatus.EnProceso;
            case JobStatus.EnProceso: return JobStatus.Finalizado;
            default: return null;
        }
    };
    
    const nextStatus = getNextStatus();

    return (
        <div className="bg-white rounded-lg shadow-md p-4 border-l-4 border-taller-primary">
            <div className="flex justify-between items-start">
                <div>
                    <h4 className="font-bold text-taller-dark">{vehiculo ? `${vehiculo.marca} ${vehiculo.modelo}` : 'Vehículo no encontrado'}</h4>
                    <p className="text-sm text-taller-gray">{cliente?.nombre}</p>
                </div>
                <button onClick={() => setIsExpanded(!isExpanded)} className="text-taller-gray hover:text-taller-dark">
                    {isExpanded ? <ChevronUpIcon className="h-5 w-5" /> : <ChevronDownIcon className="h-5 w-5" />}
                </button>
            </div>
            <p className="text-sm my-2 text-taller-dark">{trabajo.descripcion}</p>
            <div className="text-sm font-semibold text-taller-primary mt-1">
                Estimado: {new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(trabajo.costoEstimado)}
            </div>
            {isExpanded && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                    <h5 className="text-sm font-semibold mb-2 flex items-center"><WrenchIcon className="h-4 w-4 mr-2"/>Detalles del Trabajo</h5>
                    <ul className="text-xs space-y-1 text-taller-gray">
                        {trabajo.partes.map((parte, index) => (
                            <li key={index} className="flex justify-between">
                                <span>{parte.nombre} x{parte.cantidad}</span>
                                <span>{new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(parte.precioUnitario * parte.cantidad)}</span>
                            </li>
                        ))}
                         <li className="flex justify-between font-bold pt-1">
                            <span>Mano de obra</span>
                            <span>{new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(trabajo.costoManoDeObra || 0)}</span>
                        </li>
                        <li className="flex justify-between font-bold text-taller-dark border-t pt-1 mt-1">
                            <span>Total</span>
                             <span>{new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(costoFinal)}</span>
                        </li>
                    </ul>
                </div>
            )}
             {nextStatus && (
                <button
                    onClick={() => onUpdateStatus(trabajo.id, nextStatus)}
                    className="mt-4 w-full text-sm flex items-center justify-center gap-2 px-3 py-1.5 font-semibold text-white bg-taller-secondary rounded-lg shadow-sm hover:bg-taller-primary focus:outline-none transition-colors"
                >
                    Mover a {nextStatus} <ArrowRightIcon className="h-4 w-4"/>
                </button>
            )}
        </div>
    );
};

export default JobCard;
   