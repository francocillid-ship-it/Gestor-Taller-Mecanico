import React, { useState, useMemo } from 'react';
import type { Cliente, Trabajo } from '../types';
import { ChevronDownIcon, ChevronUpIcon, PhoneIcon, EnvelopeIcon, MagnifyingGlassIcon, UserPlusIcon, PencilIcon } from '@heroicons/react/24/solid';
import CrearClienteModal from './CrearClienteModal';
import type { TallerInfo } from './TallerDashboard';

interface ClientesProps {
    clientes: Cliente[];
    trabajos: Trabajo[];
    onDataRefresh: () => void;
    tallerInfo: TallerInfo;
}

interface ClientCardProps {
    cliente: Cliente;
    trabajos: Trabajo[];
    onEdit: (cliente: Cliente) => void;
}

const ClientCard: React.FC<ClientCardProps> = ({ cliente, trabajos, onEdit }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const clientTrabajos = trabajos.filter(t => t.clienteId === cliente.id);

    return (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full p-4 flex justify-between items-center text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 focus:outline-none"
            >
                <div>
                    <h3 className="font-bold text-lg text-taller-dark dark:text-taller-light">{cliente.nombre}</h3>
                    <p className="text-sm text-taller-gray dark:text-gray-400">{cliente.vehiculos.map(v => `${v.marca} ${v.modelo}`).join(', ')}</p>
                </div>
                <div className="flex items-center">
                    <span className="text-sm font-semibold text-taller-primary mr-4">{clientTrabajos.length} trabajos</span>
                    {isExpanded ? <ChevronUpIcon className="h-6 w-6 text-taller-gray dark:text-gray-400" /> : <ChevronDownIcon className="h-6 w-6 text-taller-gray dark:text-gray-400" />}
                </div>
            </button>
            {isExpanded && (
                <div className="p-4 border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                        <div>
                            <h4 className="font-semibold mb-2 text-taller-dark dark:text-taller-light">Información de Contacto</h4>
                            <div className="space-y-2 text-sm text-taller-dark dark:text-gray-300">
                                <p className="flex items-center"><PhoneIcon className="h-4 w-4 mr-2 text-taller-gray dark:text-gray-400"/> {cliente.telefono}</p>
                                <p className="flex items-center"><EnvelopeIcon className="h-4 w-4 mr-2 text-taller-gray dark:text-gray-400"/> {cliente.email}</p>
                            </div>
                        </div>
                         <div>
                            <h4 className="font-semibold mb-2 text-taller-dark dark:text-taller-light">Vehículos</h4>
                            <div className="space-y-1 text-sm text-taller-dark dark:text-gray-300">
                                {cliente.vehiculos.map(v => (
                                    <p key={v.id}><strong>{v.marca} {v.modelo} ({v.año})</strong> - {v.matricula}</p>
                                ))}
                            </div>
                        </div>
                    </div>
                    
                    <h4 className="font-semibold mb-2 text-taller-dark dark:text-taller-light">Historial de Trabajos</h4>
                    <div className="space-y-3">
                        {clientTrabajos.length > 0 ? clientTrabajos.map(trabajo => {
                             const vehiculo = cliente.vehiculos.find(v => v.id === trabajo.vehiculoId);
                             return (
                                <div key={trabajo.id} className="p-3 bg-white dark:bg-gray-700 rounded-md border dark:border-gray-600">
                                    <div className="flex justify-between items-center">
                                        <div>
                                            <p className="font-semibold text-taller-dark dark:text-taller-light">{vehiculo ? `${veh