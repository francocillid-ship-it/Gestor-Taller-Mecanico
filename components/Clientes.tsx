
import React, { useState, useMemo, useRef, useEffect } from 'react';
import type { Cliente, Trabajo, Vehiculo } from '../types';
import { ChevronDownIcon, PhoneIcon, EnvelopeIcon, UserPlusIcon, PencilIcon, Cog6ToothIcon, PlusIcon, PaperAirplaneIcon, CurrencyDollarIcon, KeyIcon } from '@heroicons/react/24/solid';
import CrearClienteModal from './CrearClienteModal';
import MaintenanceConfigModal from './MaintenanceConfigModal';
import AddVehicleModal from './AddVehicleModal';
import CrearTrabajoModal from './CrearTrabajoModal';
import { supabase, supabaseUrl, supabaseKey } from '../supabaseClient';
import { createClient } from '@supabase/supabase-js';

interface ClientesProps {
    clientes: Cliente[];
    trabajos: Trabajo[];
    onDataRefresh: () => void;
    searchQuery: string;
    onClientUpdate?: (client: Cliente) => void;
}

interface ClientCardProps {
    cliente: Cliente;
    trabajos: Trabajo[];
    onEdit: (cliente: Cliente) => void;
    onConfigVehicle: (vehiculo: Vehiculo) => void;
    onAddVehicle: (clienteId: string) => void;
    onCreateJob: (clienteId: string) => void;
    forceExpand?: boolean;
    onDataRefresh: () => void;
}

const ClientCard: React.FC<ClientCardProps> = ({ cliente, trabajos, onEdit, onConfigVehicle, onAddVehicle, onCreateJob, forceExpand, onDataRefresh }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [sendingAccess, setSendingAccess] = useState(false);
    const clientTrabajos = trabajos.filter(t => t.clienteId === cliente.id);
    const cardRef = useRef<HTMLDivElement>(null);
    
    useEffect(() => {
        if (forceExpand) {
            setIsExpanded(true);
        } else {
             setIsExpanded(false);
        }
    }, [forceExpand]);

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

        const confirmSend = window.confirm(`¿Generar acceso para ${cliente.nombre}?\n\nSi es la primera vez, se creará una contraseña temporal automática.`);
        if (!confirmSend) return;

        setSendingAccess(true);
        
        // Cliente temporal para no cerrar la sesión del Taller al hacer signUp
        const tempSupabase = createClient(supabaseUrl, supabaseKey, {
            auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
        });

        const tempPassword = Math.random().toString(36).slice(-8) + 'Aa1!';
        let shareUrl = '';
        let messageHeader = '';
        let successMigration = false;

        try {
            // 1. Intentar registrar al usuario en Auth (Migración de Cliente Manual a Auth)
            const { data: authData, error: authError } = await tempSupabase.auth.signUp({
                email: cliente.email,
                password: tempPassword,
                options: {
                    data: {
                        role: 'cliente',
                        taller_nombre_ref: 'Mi Taller Mecánico' // Podríamos pasar el nombre real si lo tuviéramos aquí
                    },
                }
            });

            // CASO A: Usuario Nuevo en Auth (Éxito al crear)
            if (authData.user && authData.user.id) {
                const newAuthId = authData.user.id;

                // Si el ID generado por Auth es diferente al ID actual del cliente (siempre pasa si fue creado manual con UUID aleatorio)
                if (newAuthId !== cliente.id) {
                    console.log("Migrando cliente manual a usuario Auth...", cliente.id, "->", newAuthId);
                    
                    // 1. Crear el perfil nuevo con el ID correcto (Auth ID)
                    const { error: insertError } = await supabase.from('clientes').insert({
                        id: newAuthId,
                        taller_id: cliente.taller_id,
                        nombre: cliente.nombre,
                        apellido: cliente.apellido,
                        email: cliente.email,
                        telefono: cliente.telefono
                    });
                    
                    if (insertError) throw new Error("Error al migrar perfil: " + insertError.message);

                    // 2. Mover Vehículos
                    await supabase.from('vehiculos').update({ cliente_id: newAuthId }).eq('cliente_id', cliente.id);
                    
                    // 3. Mover Trabajos
                    await supabase.from('trabajos').update({ cliente_id: newAuthId }).eq('cliente_id', cliente.id);
                    
                    // 4. Eliminar perfil viejo
                    await supabase.from('clientes').delete().eq('id', cliente.id);
                    
                    // Refrescar datos globales
                    onDataRefresh();
                    successMigration = true;
                } else {
                    successMigration = true;
                }

                shareUrl = `${window.location.origin}/?type=invite&email=${encodeURIComponent(cliente.email)}&password=${encodeURIComponent(tempPassword)}`;
                messageHeader = `Hola ${cliente.nombre}, accede a tu historial de trabajos en el taller. Tu sistema generó un acceso automático.`;
            
            } else {
                // CASO B: Usuario ya existe en Auth (authError usualmente indica "User already registered")
                // No podemos recuperar la contraseña. Generamos link de "Olvidé contraseña".
                shareUrl = `${window.location.origin}/?view=forgot_password&email=${encodeURIComponent(cliente.email)}`;
                messageHeader = `Hola ${cliente.nombre}, accede a tu historial de trabajos. Como ya tienes cuenta, usa este enlace si necesitas restablecer tu clave.`;
                console.log("Usuario ya existente, enviando link de recuperación.");
            }

            // COMPARTIR
            if (navigator.share) {
                try {
                    await navigator.share({
                        title: 'Acceso al Portal Taller',
                        text: messageHeader, 
                        url: shareUrl
                    });
                } catch (shareError) {
                    if ((shareError as any).name !== 'AbortError') {
                         const combinedMessage = `${messageHeader}\n\n${shareUrl}`;
                         await navigator.clipboard.writeText(combinedMessage);
                         alert("Enlace copiado al portapapeles.");
                    }
                }
            } else {
                 const combinedMessage = `${messageHeader}\n\n${shareUrl}`;
                 await navigator.clipboard.writeText(combinedMessage);
                 alert("Enlace copiado al portapapeles. Puedes pegarlo en WhatsApp.");
            }

        } catch (error: any) {
            console.error("Error sending access:", error);
            alert("Error al procesar la solicitud: " + error.message);
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
                                    <div className="flex flex-wrap items-center justify-between gap-2 group">
                                        <p className="flex items-center break-all">
                                            <EnvelopeIcon className="h-4 w-4 mr-2 text-taller-gray dark:text-gray-400 flex-shrink-0"/> 
                                            {cliente.email || 'Sin email registrado'}
                                        </p>
                                        {cliente.email && (
                                            <button 
                                                onClick={handleSendAccess}
                                                disabled={sendingAccess}
                                                className="flex-shrink-0 flex items-center gap-1 text-xs font-bold text-white bg-green-500 hover:bg-green-600 px-3 py-1.5 rounded-full transition-all shadow-sm ml-auto sm:ml-0"
                                                title="Enviar enlace de acceso automático"
                                            >
                                                {sendingAccess ? (
                                                    <span>Generando...</span>
                                                ) : (
                                                    <>
                                                        <KeyIcon className="h-3.5 w-3.5" />
                                                        Compartir Acceso
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

const Clientes: React.FC<ClientesProps> = ({ clientes, trabajos, onDataRefresh, searchQuery, onClientUpdate }) => {
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

    const handleClientSuccess = (newClient?: Cliente) => {
        handleCloseModal();
        if (newClient && onClientUpdate) {
            onClientUpdate(newClient);
        } else {
            onDataRefresh();
        }
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
                            onDataRefresh={onDataRefresh}
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
                    onSuccess={handleClientSuccess}
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
                    onSuccess={(newVehicle) => {
                        // Optimistic Update Implementation
                        if (newVehicle && onClientUpdate && clientToAddVehicle) {
                            const clientToUpdate = clientes.find(c => c.id === clientToAddVehicle);
                            if (clientToUpdate) {
                                const updatedClient = {
                                    ...clientToUpdate,
                                    vehiculos: [...clientToUpdate.vehiculos, newVehicle]
                                };
                                onClientUpdate(updatedClient);
                                setClientToAddVehicle(null);
                                return;
                            }
                        }
                        // Fallback to full refresh
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
