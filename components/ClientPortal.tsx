import React from 'react';
import type { Cliente, Trabajo } from '../types';
import { JobStatus } from '../types';
import Header from './Header';
import { CheckCircleIcon, ClockIcon, WrenchScrewdriverIcon, DocumentTextIcon } from '@heroicons/react/24/solid';

interface ClientPortalProps {
    client: Cliente;
    trabajos: Trabajo[];
    onLogout: () => void;
    tallerName: string;
}

const statusInfo = {
    [JobStatus.Presupuesto]: { text: 'Presupuesto Pendiente', icon: <ClockIcon className="h-5 w-5 text-yellow-500" />, color: 'text-yellow-500' },
    [JobStatus.Programado]: { text: 'Trabajo Programado', icon: <ClockIcon className="h-5 w-5 text-blue-500" />, color: 'text-blue-500' },
    [JobStatus.EnProceso]: { text: 'Vehículo en el Taller', icon: <WrenchScrewdriverIcon className="h-5 w-5 text-orange-500" />, color: 'text-orange-500' },
    [JobStatus.Finalizado]: { text: 'Trabajo Finalizado', icon: <CheckCircleIcon className="h-5 w-5 text-green-500" />, color: 'text-green-500' },
};


const ClientPortal: React.FC<ClientPortalProps> = ({ client, trabajos, onLogout, tallerName }) => {

    const currentTrabajo = trabajos.find(t => t.status !== JobStatus.Finalizado);
    const pastTrabajos = trabajos.filter(t => t.status === JobStatus.Finalizado);

    return (
        <div className="min-h-screen bg-taller-light">
            <Header tallerName={tallerName} />
            <main className="p-4 md:p-8">
                <div className="max-w-4xl mx-auto space-y-8">
                    <div className="text-center">
                        <h1 className="text-3xl font-bold">Bienvenido, {client.nombre}</h1>
                        <p className="text-taller-gray">Aquí puede ver el estado de sus vehículos.</p>
                    </div>

                    {currentTrabajo && (
                         <div className="bg-white p-6 rounded-xl shadow-md border-l-4 border-taller-accent">
                            <h2 className="text-xl font-bold mb-4">Estado Actual de su Vehículo</h2>
                            <div className="flex flex-col md:flex-row items-start md:items-center justify-between">
                                 <div>
                                    <p className="font-semibold">{client.vehiculos.find(v=>v.id === currentTrabajo.vehiculoId)?.marca} {client.vehiculos.find(v=>v.id === currentTrabajo.vehiculoId)?.modelo}</p>
                                    <p className="text-taller-gray">{currentTrabajo.descripcion}</p>
                                </div>
                                <div className={`mt-4 md:mt-0 flex items-center space-x-2 font-semibold ${statusInfo[currentTrabajo.status].color}`}>
                                    {statusInfo[currentTrabajo.status].icon}
                                    <span>{statusInfo[currentTrabajo.status].text}</span>
                                </div>
                            </div>
                        </div>
                    )}
                    
                    <div className="bg-white p-6 rounded-xl shadow-md">
                        <h2 className="text-xl font-bold mb-4">Historial de Servicios</h2>
                        {pastTrabajos.length > 0 ? (
                            <div className="space-y-4">
                                {pastTrabajos.map((trabajo, index) => {
                                    const vehiculo = client.vehiculos.find(v => v.id === trabajo.vehiculoId);
                                    const costoTotal = (trabajo.costoManoDeObra || 0) + trabajo.partes.reduce((acc, p) => acc + p.cantidad * p.precioUnitario, 0);

                                    return (
                                        <div key={trabajo.id} className={`p-4 border rounded-lg transition-colors hover:bg-gray-100 ${index % 2 === 0 ? 'bg-white' : 'bg-taller-light'}`}>
                                            <div className="flex flex-col md:flex-row justify-between">
                                                <div>
                                                    <p className="font-semibold">{vehiculo?.marca} {vehiculo?.modelo}</p>
                                                    <p className="text-sm text-taller-gray">{trabajo.descripcion}</p>
                                                     <p className="text-xs text-taller-gray mt-1">
                                                        {new Date(trabajo.fechaSalida || '').toLocaleDateString('es-ES')}
                                                     </p>
                                                </div>
                                                <div className="mt-2 md:mt-0 text-left md:text-right">
                                                    <p className="font-bold text-taller-dark">{new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(costoTotal)}</p>
                                                    <button className="text-sm text-taller-primary hover:underline flex items-center gap-1 mt-1">
                                                        <DocumentTextIcon className="h-4 w-4"/> Ver Factura
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        ) : (
                            <p className="text-taller-gray">No hay servicios anteriores registrados.</p>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
};

export default ClientPortal;
