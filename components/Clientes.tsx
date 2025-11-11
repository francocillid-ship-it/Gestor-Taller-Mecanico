
import React, { useState } from 'react';
import type { Cliente, Trabajo, Vehiculo } from '../types';
import { ChevronDownIcon, ChevronUpIcon, PhoneIcon, EnvelopeIcon, WrenchScrewdriverIcon, DocumentTextIcon } from '@heroicons/react/24/solid';

interface ClientesProps {
    clientes: Cliente[];
    trabajos: Trabajo[];
}

const ClientCard: React.FC<{ cliente: Cliente; trabajos: Trabajo[] }> = ({ cliente, trabajos }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const clientTrabajos = trabajos.filter(t => t.clienteId === cliente.id);

    return (
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full p-4 flex justify-between items-center text-left hover:bg-gray-50 focus:outline-none"
            >
                <div>
                    <h3 className="font-bold text-lg text-taller-dark">{cliente.nombre}</h3>
                    <p className="text-sm text-taller-gray">{cliente.vehiculos.map(v => `${v.marca} ${v.modelo}`).join(', ')}</p>
                </div>
                <div className="flex items-center">
                    <span className="text-sm font-semibold text-taller-primary mr-4">{clientTrabajos.length} trabajos</span>
                    {isExpanded ? <ChevronUpIcon className="h-6 w-6 text-taller-gray" /> : <ChevronDownIcon className="h-6 w-6 text-taller-gray" />}
                </div>
            </button>
            {isExpanded && (
                <div className="p-4 border-t bg-gray-50">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                        <div>
                            <h4 className="font-semibold mb-2">Información de Contacto</h4>
                            <div className="space-y-2 text-sm text-taller-dark">
                                <p className="flex items-center"><PhoneIcon className="h-4 w-4 mr-2 text-taller-gray"/> {cliente.telefono}</p>
                                <p className="flex items-center"><EnvelopeIcon className="h-4 w-4 mr-2 text-taller-gray"/> {cliente.email}</p>
                            </div>
                        </div>
                         <div>
                            <h4 className="font-semibold mb-2">Vehículos</h4>
                            <div className="space-y-1 text-sm text-taller-dark">
                                {cliente.vehiculos.map(v => (
                                    <p key={v.id}><strong>{v.marca} {v.modelo} ({v.año})</strong> - {v.matricula}</p>
                                ))}
                            </div>
                        </div>
                    </div>
                    
                    <h4 className="font-semibold mb-2">Historial de Trabajos</h4>
                    <div className="space-y-3">
                        {clientTrabajos.map(trabajo => {
                             const vehiculo = cliente.vehiculos.find(v => v.id === trabajo.vehiculoId);
                             return (
                                <div key={trabajo.id} className="p-3 bg-white rounded-md border">
                                    <div className="flex justify-between items-center">
                                        <div>
                                            <p className="font-semibold">{vehiculo ? `${vehiculo.marca} ${vehiculo.modelo}` : ''}</p>
                                            <p className="text-sm text-taller-gray">{trabajo.descripcion}</p>
                                        </div>
                                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${trabajo.status === 'Finalizado' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}`}>{trabajo.status}</span>
                                    </div>
                                    <p className="text-xs text-taller-gray mt-1">Fecha: {trabajo.fechaEntrada}</p>
                                </div>
                             )
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};

const Clientes: React.FC<ClientesProps> = ({ clientes, trabajos }) => {
    return (
        <div className="space-y-6 pb-16">
            <h2 className="text-2xl font-bold text-taller-dark">Gestión de Clientes</h2>
            <div className="space-y-4">
                {clientes.map(cliente => (
                    <ClientCard key={cliente.id} cliente={cliente} trabajos={trabajos} />
                ))}
            </div>
        </div>
    );
};

export default Clientes;
   