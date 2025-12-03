
import React, { useState, useMemo, useRef, useEffect } from 'react';
import type { Cliente, Trabajo, Vehiculo } from '../types';
import { ChevronDownIcon, PhoneIcon, EnvelopeIcon, UserPlusIcon, PencilIcon, Cog6ToothIcon, PlusIcon, PaperAirplaneIcon, CurrencyDollarIcon } from '@heroicons/react/24/solid';
import CrearClienteModal from './CrearClienteModal';
import MaintenanceConfigModal from './MaintenanceConfigModal';
import AddVehicleModal from './AddVehicleModal';
import CrearTrabajoModal from './CrearTrabajoModal';
import { supabase } from '../supabaseClient';

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
    onConfigVehicle: (vehiculo: Vehiculo) => void;
    onAddVehicle: (clienteId: string) => void;
    onCreateJob: (clienteId: string) => void;
    forceExpand?: boolean;
}

const ClientCard: React.FC<ClientCardProps> = ({ cliente, trabajos, onEdit, onConfigVehicle, onAddVehicle, onCreateJob, forceExpand }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [sendingAccess, setSendingAccess] = useState(false);
    const clientTrabajos = trabajos.filter(t => t.clienteId === cliente.id);
    const cardRef = useRef<HTMLDivElement>(null);
    
    // Auto-expand if search is active (forceExpand)
    useEffect(() => {
        if (forceExpand) {
            setIsExpanded(true);
        } else {
             setIsExpanded(false);
        }
    }, [forceExpand]);

    // Auto-scroll logic
    useEffect(() => {
        if (isExpanded && cardRef.current) {
            const timer = setTimeout(() => {
                const element = cardRef.current;
                if (!element) return;

                const rect = element.getBoundingClientRect();
                const windowHeight = window.innerHeight;
                const headerOffset = 80;

                const isTopHidden = rect.top < headerOffset;
                const isBottomHidden = rect.bottom > windowHeight;

                // Solo hacemos scroll si es necesario (si está oculto arriba o abajo)
                if (isTopHidden || isBottomHidden) {
                    element.scrollIntoView({
                        behavior: 'smooth',
                        block: 'start',
                        inline: 'nearest'
                    });
                }
            }, 350);
            return () => clearTimeout(timer);
        }
    }, [isExpanded]);

    const handleSendAccess = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!cliente.email) {
            alert("El cliente no tiene email registrado.");
            return;
        }

        const confirmSend = window.confirm(`¿Enviar instrucciones de acceso a ${cliente.email}? Esto permitirá al cliente restablecer su contraseña y entrar al portal.`);
        if (!confirmSend) return;

        setSendingAccess(true);
        try {
            const { error } = await supabase.auth.resetPasswordForEmail(cliente.email, {
                redirectTo: window.location.origin + '?type=recovery',
            });

            if (error) throw error;

            const shareText = `Hola ${cliente.nombre}, te envié un correo a ${cliente.email} para que puedas acceder a tu portal de cliente. Por favor revísalo y sigue el enlace para crear tu contraseña.`;
            const shareUrl = window.location.origin;

            if (navigator.share) {
                try {
                    await navigator.share({
                        title: 'Acceso al Portal Taller',
                        text: shareText,
                        url: shareUrl
                    });
                } catch (shareError) {
                    // Ignore abort error
                    alert("Correo enviado con éxito. Puedes avisarle al cliente por WhatsApp.");
                }
            } else {
                // Fallback: Copy text or just alert
                 alert("¡Correo de acceso enviado con éxito! Dile al cliente que revise su bandeja de entrada (y spam).");
            }

        } catch (error: any) {
            console.error("Error sending access:", error);
            alert("Error al enviar el correo: " + error.message);
        } finally {
            setSendingAccess(false);
        }
    };

    const fullName = `${cliente.nombre} ${cliente.apellido || ''}`.trim();

    return (
        <div ref={cardRef} className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden scroll-mt-4 transition-all duration-300">
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full p-4 flex justify-between items-center text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 focus:outline-none z-10 relative bg-inherit"
            >
                <div>
                    <h3 className="font-bold text-lg text-taller-dark dark:text-taller-light">{fullName}</h3>
                    <p className="text-sm text-taller-gray dark:text-gray-400">{cliente.vehiculos.map(v => `${v.marca} ${v.modelo}`).join(', ')}</p>
                </div>
                <div className="flex items-center">
                    <span className="text-sm font-semibold text-taller-primary mr-4">{clientTrabajos.length} trabajos</span>
                    <ChevronDownIcon className={`h-6 w-6 text-taller-gray dark:text-gray-400 transform transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} />
                </div>
            </button>
            
            <div className={`grid transition-[grid-template-rows] duration-300 ease-in-out ${isExpanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
                <div className="overflow-hidden">
                    <div className="p-4 border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                            <div>
                                <h4 className="font-semibold mb-2 text-taller-dark dark:text-taller-light">Información de Contacto</h4>
                                <div className="space-y-2 text-sm text-taller-dark dark:text-gray-300">
                                    <p className="flex items-center"><PhoneIcon className="h-4 w-4 mr-2 text-taller-gray dark:text-gray-400"/> {cliente.telefono}</p>
                                    <div className="flex items-center justify-between group">
                                        <p className="flex items-center"><EnvelopeIcon className="h-4 w-4 mr-2 text-taller-gray dark:text-gray-400"/> {cliente.email}</p>
                                        {cliente.email && (
                                            <button 
                                                onClick={handleSendAccess}
                                                disabled={sendingAccess}
                                                className="ml-2 flex items-center gap-1 text-xs font-semibold text-taller-primary bg-blue-100 hover:bg-blue-200 dark:bg-blue-900/40 dark:hover:bg-blue-900/60 px-2 py-1 rounded transition-colors"
                                                title="Enviar correo de recuperación y compartir aviso"
                                            >
                                                {sendingAccess ? (
                                                    <span>Enviando...</span>
                                                ) : (
                                                    <>
                                                        <PaperAirplaneIcon className="h-3 w-3" />
                                                        Enviar Acceso
                                                    </>
                                                )}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <div>
                                <div className="flex justify-between items-center mb-2">
                                    <h4 className="font-semibold text-taller-dark dark:text-taller-light">Vehículos</h4>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); onAddVehicle(cliente.id); }}
                                        className="flex items-center gap-1 text-xs font-semibold text-taller-primary hover:text-taller-secondary bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 px-2 py-1 rounded transition-colors"
                                    >
                                        <PlusIcon className="h-3 w-3" /> Agregar
                                    </button>
                                </div>
                                <div className="space-y-2 text-sm text-taller-dark dark:text-gray-300">
                                    {cliente.vehiculos.map(v => (
                                        <div key={v.id} className="flex justify-between items-center bg-white dark:bg-gray-700 p-2 rounded border dark:border-gray-600">
                                            <p><strong>{v.marca} {v.modelo} {v.año ? `(${v.año})` : ''}</strong> - {v.matricula}</p>
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); onConfigVehicle(v); }}
                                                className="text-taller-gray hover:text-taller-primary dark:text-gray-400 dark:hover:text-white p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                                                title="Configurar intervalos de mantenimiento"
                                            >
                                                <Cog6ToothIcon className="h-5 w-5" />
                                            </button>
                                        </div>
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
                        
                        {/* Botones de Acción Equilibrados */}
                        <div className="mt-6 flex gap-3 w-full">
                            <button
                                onClick={(e) => { e.stopPropagation(); onCreateJob(cliente.id); }}
                                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm font-semibold text-white bg-taller-primary rounded-lg shadow-sm hover:bg-taller-secondary transition-colors"
                            >
                                <CurrencyDollarIcon className="h-4 w-4"/>
                                Crear Presupuesto
                            </button>
                            <button
                                onClick={(e) => { e.stopPropagation(); onEdit(cliente); }}
                                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm font-semibold text-taller-secondary bg-blue-50 border border-taller-secondary/50 rounded-lg shadow-sm hover:bg-blue-100 dark:text-blue-300 dark:bg-blue-900/30 dark:border-blue-500/50 dark:hover:bg-blue-900/50 transition-colors"
                            >
                                <PencilIcon className="h-4 w-4"/>
                                Editar Datos
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

const Clientes: React.FC<ClientesProps> = ({ clientes, trabajos, onDataRefresh, searchQuery }) => {
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [clienteToEdit, setClienteToEdit] = useState<Cliente | null>(null);
    const [vehicleToConfig, setVehicleToConfig] = useState<Vehiculo | null>(null);
    const [clientToAddVehicle, setClientToAddVehicle] = useState<string | null>(null);
    const [clientForNewJob, setClientForNewJob] = useState<string | null>(null);

    const handleEditClick = (cliente: Cliente) => {
        setClienteToEdit(cliente);
    };

    const handleCloseModal = () => {
        setIsCreateModalOpen(false);
        setClienteToEdit(null);
    };

    const filteredClientes = useMemo(() => {
        let result = clientes;
        const lowercasedQuery = searchQuery.toLowerCase();
        
        if (lowercasedQuery) {
            result = clientes.filter(cliente => {
                const fullName = `${cliente.nombre} ${cliente.apellido || ''}`.toLowerCase();
                const nameMatch = fullName.includes(lowercasedQuery);
                const vehicleMatch = cliente.vehiculos.some(v => 
                    v.marca.toLowerCase().includes(lowercasedQuery) ||
                    v.modelo.toLowerCase().includes(lowercasedQuery) ||
                    v.matricula.toLowerCase().includes(lowercasedQuery)
                );
                return nameMatch || vehicleMatch;
            });
        }

        // Ordenamiento alfabético por nombre
        return result.sort((a, b) => {
            const nameA = `${a.nombre} ${a.apellido || ''}`.toLowerCase();
            const nameB = `${b.nombre} ${b.apellido || ''}`.toLowerCase();
            return nameA.localeCompare(nameB);
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
                            onConfigVehicle={setVehicleToConfig}
                            onAddVehicle={setClientToAddVehicle}
                            onCreateJob={setClientForNewJob}
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

            {vehicleToConfig && (
                <MaintenanceConfigModal 
                    vehiculo={vehicleToConfig}
                    onClose={() => setVehicleToConfig(null)}
                    onSuccess={() => {
                        setVehicleToConfig(null);
                        onDataRefresh();
                    }}
                />
            )}

            {clientToAddVehicle && (
                <AddVehicleModal
                    clienteId={clientToAddVehicle}
                    onClose={() => setClientToAddVehicle(null)}
                    onSuccess={() => {
                        setClientToAddVehicle(null);
                        onDataRefresh();
                    }}
                />
            )}

            {clientForNewJob && (
                <CrearTrabajoModal
                    clientes={clientes}
                    initialClientId={clientForNewJob}
                    onClose={() => setClientForNewJob(null)}
                    onSuccess={() => {
                        setClientForNewJob(null);
                        onDataRefresh();
                    }}
                    onDataRefresh={onDataRefresh}
                />
            )}
        </div>
    );
};

export default Clientes;
