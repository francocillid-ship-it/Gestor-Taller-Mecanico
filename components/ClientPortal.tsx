import React from 'react';
import type { Cliente, Trabajo, Vehiculo } from '../types';
import { ArrowRightOnRectangleIcon, WrenchScrewdriverIcon, CurrencyDollarIcon, CalendarDaysIcon, ClockIcon } from '@heroicons/react/24/solid';

interface ClientPortalProps {
    client: Cliente;
    trabajos: Trabajo[];
    onLogout: () => void;
    tallerName: string;
}

const getStatusStyles = (status: string) => {
    switch (status) {
        case 'Presupuesto':
            return { bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-400' };
        case 'Programado':
            return { bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-400' };
        case 'En Proceso':
            return { bg: 'bg-orange-100', text: 'text-orange-800', border: 'border-orange-400' };
        case 'Finalizado':
            return { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-400' };
        default:
            return { bg: 'bg-gray-100', text: 'text-gray-800', border: 'border-gray-400' };
    }
};

const TrabajoDetails: React.FC<{ trabajo: Trabajo; vehiculo: Vehiculo | undefined }> = ({ trabajo, vehiculo }) => {
    const statusStyles = getStatusStyles(trabajo.status);
    const totalPagado = trabajo.partes
        .filter(p => p.nombre === '__PAGO_REGISTRADO__')
        .reduce((sum, p) => sum + p.precioUnitario, 0);
    const saldoPendiente = trabajo.costoEstimado - totalPagado;

    return (
        <div className={`bg-white rounded-lg shadow-md overflow-hidden border-l-4 ${statusStyles.border}`}>
            <div className="p-4">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start">
                    <div>
                        <h3 className="font-bold text-lg text-taller-dark">{vehiculo ? `${vehiculo.marca} ${vehiculo.modelo}` : 'Vehículo'}</h3>
                        <p className="text-sm text-taller-gray">{trabajo.descripcion}</p>
                    </div>
                    <span className={`mt-2 sm:mt-0 px-3 py-1 text-sm font-semibold rounded-full ${statusStyles.bg} ${statusStyles.text}`}>{trabajo.status}</span>
                </div>
                <div className="mt-4 pt-4 border-t grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div className="flex items-center">
                        <CalendarDaysIcon className="h-5 w-5 mr-2 text-taller-gray"/>
                        <div>
                            <p className="font-semibold">Ingreso</p>
                            <p>{new Date(trabajo.fechaEntrada).toLocaleDateString('es-ES')}</p>
                        </div>
                    </div>
                    <div className="flex items-center">
                        <ClockIcon className="h-5 w-5 mr-2 text-taller-gray"/>
                        <div>
                            <p className="font-semibold">Salida</p>
                            <p>{trabajo.fechaSalida ? new Date(trabajo.fechaSalida).toLocaleDateString('es-ES') : 'Pendiente'}</p>
                        </div>
                    </div>
                    <div className="flex items-center col-span-2 md:col-span-1 mt-4 md:mt-0">
                        <CurrencyDollarIcon className="h-5 w-5 mr-2 text-taller-gray"/>
                        <div>
                            <p className="font-semibold">Costo Total</p>
                            <p>{new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(trabajo.costoEstimado)}</p>
                        </div>
                    </div>
                     <div className="flex items-center col-span-2 md:col-span-1 mt-4 md:mt-0">
                        <CurrencyDollarIcon className={`h-5 w-5 mr-2 ${saldoPendiente > 0 ? 'text-red-500' : 'text-green-500'}`}/>
                        <div>
                            <p className="font-semibold">Saldo Pendiente</p>
                            <p className={`${saldoPendiente > 0 ? 'text-red-600' : 'text-green-600'}`}>{new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(saldoPendiente)}</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};


const ClientPortal: React.FC<ClientPortalProps> = ({ client, trabajos, onLogout, tallerName }) => {
    
    return (
        <div className="min-h-screen bg-gray-100">
            <header className="bg-white shadow-md">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <WrenchScrewdriverIcon className="h-8 w-8 text-taller-primary"/>
                        <h1 className="text-xl font-bold text-taller-dark">{tallerName}</h1>
                    </div>
                    <button 
                        onClick={onLogout}
                        className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-red-700 bg-red-100 rounded-lg hover:bg-red-200"
                    >
                        <ArrowRightOnRectangleIcon className="h-5 w-5" />
                        <span>Salir</span>
                    </button>
                </div>
            </header>
            
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="mb-8">
                    <h2 className="text-3xl font-bold text-taller-dark">Bienvenido, {client.nombre}</h2>
                    <p className="text-taller-gray mt-1">Aquí puede ver el estado de sus trabajos y vehículos.</p>
                </div>

                <div className="space-y-6">
                    <h3 className="text-xl font-bold text-taller-dark">Sus Trabajos</h3>
                    {trabajos.length > 0 ? (
                        trabajos.map(trabajo => {
                            const vehiculo = client.vehiculos.find(v => v.id === trabajo.vehiculoId);
                            return <TrabajoDetails key={trabajo.id} trabajo={trabajo} vehiculo={vehiculo} />;
                        })
                    ) : (
                        <div className="bg-white rounded-lg shadow-md p-8 text-center">
                            <p className="text-taller-gray">No tiene trabajos registrados en este momento.</p>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
};

export default ClientPortal;
