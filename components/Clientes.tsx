import React, { useState, useMemo } from 'react';
import type { Cliente, Trabajo } from '../types';
import { ChevronDownIcon, ChevronUpIcon, PhoneIcon, EnvelopeIcon, MagnifyingGlassIcon, UserPlusIcon, PencilIcon } from '@heroicons/react/24/solid';
import CrearClienteModal from './CrearClienteModal';

interface ClientesProps {
    clientes: Cliente[];
    trabajos: Trabajo[];
    onDataRefresh: () => void;
}

const ClientCard: React.FC<{ cliente: Cliente; trabajos: Trabajo[]; onEdit: (cliente: Cliente) => void; }> = ({ cliente, trabajos, onEdit }) => {
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
                        {clientTrabajos.length > 0 ? clientTrabajos.map(trabajo => {
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
                                    <p className="text-xs text-taller-gray mt-1">Fecha: {new Date(trabajo.fechaEntrada).toLocaleDateString('es-ES')}</p>
                                </div>
                             )
                        }) : <p className="text-sm text-taller-gray">No hay trabajos registrados.</p>}
                    </div>
                    <div className="mt-4 flex justify-end">
                        <button
                            onClick={() => onEdit(cliente)}
                            className="flex items-center gap-2 px-3 py-1.5 text-sm font-semibold text-taller-secondary bg-blue-50 border border-taller-secondary/50 rounded-lg shadow-sm hover:bg-blue-100"
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

const Clientes: React.FC<ClientesProps> = ({ clientes, trabajos, onDataRefresh }) => {
    const [searchQuery, setSearchQuery] = useState('');
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
                <h2 className="text-2xl font-bold text-taller-dark">Gestión de Clientes</h2>
                <div className="flex flex-col sm:flex-row gap-3">
                    <div className="relative">
                        <input
                            type="text"
                            placeholder="Buscar cliente, vehículo..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="w-full sm:w-64 pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-taller-primary"
                        />
                        <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-taller-gray"/>
                    </div>
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
                        <ClientCard key={cliente.id} cliente={cliente} trabajos={trabajos} onEdit={handleEditClick} />
                    ))
                ) : (
                    <div className="text-center py-10 bg-white rounded-lg shadow-md">
                        <p className="text-taller-gray">No se encontraron clientes.</p>
                        {searchQuery && <p className="text-sm text-taller-gray mt-2">Intente con otro término de búsqueda.</p>}
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