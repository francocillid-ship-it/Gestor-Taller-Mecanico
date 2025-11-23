import React, { useState, useMemo } from 'react';
import type { Cliente, Trabajo } from '../types';
import { ChevronDownIcon, ChevronUpIcon, PhoneIcon, EnvelopeIcon, UserPlusIcon, PencilIcon } from '@heroicons/react/24/solid';
import CrearClienteModal from './CrearClienteModal';

interface ClientesProps {
    clientes: Cliente[];
    trabajos: Trabajo[];
    onDataRefresh: () => void;
    searchQuery: string;
}

interface ClientCardProps {
    cliente: Cliente;
    trabajos: Trabajo[];
    onEdit: (cliente: Cliente) => void;
    forceExpand?: boolean;
}

const ClientCard: React.FC<ClientCardProps> = ({ cliente, trabajos, onEdit, forceExpand }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const clientTrabajos = trabajos.filter(t => t.clienteId === cliente.id);
    
    // Auto-expand if search is active (forceExpand)
    React.useEffect(() => {
        if (forceExpand) {
            setIsExpanded(true);
        } else {
             setIsExpanded(false);
        }
    }, [forceExpand]);

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
                                            <p className="font-semibold text-taller-dark dark:text-taller-light">{vehiculo ? `${vehiculo.marca} ${vehiculo.modelo}` : ''}</p>
                                            <p className="text-sm text-taller-gray dark:text-gray-400">{trabajo.descripcion}</p>
                                        </div>
                                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${trabajo.status === 'Finalizado' ? 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300' : 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300'}`}>{trabajo.status}</span>
                                    </div>
                                    <p className="text-xs text-taller-gray dark:text-gray-400 mt-1">Fecha: {new Date(trabajo.fechaEntrada).toLocaleDateString('es-ES')}</p>
                                </div>
                             )
                        }) : <p className="text-sm text-taller-gray dark:text-gray-400">No hay trabajos registrados.</p>}
                    </div>
                    <div className="mt-4 flex justify-end gap-3">
                        <button
                            onClick={() => onEdit(cliente)}
                            className="flex items-center gap-2 px-3 py-1.5 text-sm font-semibold text-taller-secondary bg-blue-50 border border-taller-secondary/50 rounded-lg shadow-sm hover:bg-blue-100 dark:text-blue-300 dark:bg-blue-900/30 dark:border-blue-500/50 dark:hover:bg-blue-900/50"
                        >
                            <PencilIcon className="h-4 w-4"/>
                            Editar Datos
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

const Clientes: React.FC<ClientesProps> = ({ clientes, trabajos, onDataRefresh, searchQuery }) => {
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [clienteToEdit, setClienteToEdit] = useState<Cliente | null>(null);

    const handleEditClick = (cliente: Cliente) => {
        setClienteToEdit(cliente);
    };

    const handleCloseModal = () => {
        setIsCreateModalOpen(false);
        setClienteToEdit(null);
    };

    const filteredClientes = useMemo(() => {
        const lowercasedQuery = searchQuery.toLowerCase();
        if (!lowercasedQuery) return clientes;

        return clientes.filter(cliente => {
            const nameMatch = cliente.nombre.toLowerCase().includes(lowercasedQuery);
            const vehicleMatch = cliente.vehiculos.some(v => 
                v.marca.toLowerCase().includes(lowercasedQuery) ||
                v.modelo.toLowerCase().includes(lowercasedQuery) ||
                v.matricula.toLowerCase().includes(lowercasedQuery)
            );
            return nameMatch || vehicleMatch;
        });
    }, [searchQuery, clientes]);

    return (
        <div className="space-y-6 pb-16">
            <div className="flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-center">
                <h2 className="text-2xl font-bold text-taller-dark dark:text-taller-light">Gestión de Clientes</h2>
                <div className="flex flex-col sm:flex-row gap-3">
                     <button
                        onClick={() => setIsCreateModalOpen(true)}
                        className="flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-taller-primary rounded-lg shadow-md hover:bg-taller-secondary focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-taller-primary transition-colors"
                    >
                        <UserPlusIcon className="h-5 w-5"/>
                        Nuevo Cliente
                    </button>
                </div>
            </div>
            <div className="space-y-4">
                {filteredClientes.length > 0 ? (
                    filteredClientes.map(cliente => (
                        <ClientCard 
                            key={cliente.id} 
                            cliente={cliente} 
                            trabajos={trabajos} 
                            onEdit={handleEditClick} 
                            forceExpand={searchQuery.length > 0} 
                        />
                    ))
                ) : (
                    <div className="text-center py-10 bg-white dark:bg-gray-800 rounded-lg shadow-md">
                        <p className="text-taller-gray dark:text-gray-400">No se encontraron clientes.</p>
                        {searchQuery && <p className="text-sm text-taller-gray dark:text-gray-400 mt-2">Intente con otro término de búsqueda.</p>}
                    </div>
                )}
            </div>

            {(isCreateModalOpen || clienteToEdit) && (
                 <CrearClienteModal
                    clienteToEdit={clienteToEdit}
                    onClose={handleCloseModal}
                    onSuccess={() => {
                        handleCloseModal();
                        onDataRefresh();
                    }}
                />
            )}
        </div>
    );
};

export default Clientes;