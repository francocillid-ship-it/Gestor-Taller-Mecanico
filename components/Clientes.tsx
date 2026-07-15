
import React, { useState, useMemo, useRef, useEffect, useLayoutEffect, useCallback, lazy, Suspense } from 'react';
import type { Cliente, Trabajo, Vehiculo, JobStatus } from '../types';
import { ChevronDownIcon, PhoneIcon, EnvelopeIcon, UserPlusIcon, PencilIcon, Cog6ToothIcon, PlusIcon, PaperAirplaneIcon, CurrencyDollarIcon, KeyIcon, ArrowTopRightOnSquareIcon, ArrowPathIcon } from '@heroicons/react/24/solid';
import { supabase, supabaseUrl, supabaseKey } from '../supabaseClient';
import { createClient } from '@supabase/supabase-js';

// Lazy load modals
const CrearClienteModal = lazy(() => import('./CrearClienteModal'));
const MaintenanceConfigModal = lazy(() => import('./MaintenanceConfigModal'));
const AddVehicleModal = lazy(() => import('./AddVehicleModal'));
const CrearTrabajoModal = lazy(() => import('./CrearTrabajoModal'));

interface ClientesProps {
    clientes: Cliente[];
    trabajos: Trabajo[];
    onDataRefresh: () => void;
    searchQuery: string;
    onClientUpdate?: (client: Cliente) => void;
    onNavigate: (view: 'dashboard' | 'trabajos' | 'clientes' | 'ajustes', jobStatus?: JobStatus, jobId?: string) => void;
    isActive?: boolean;
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
    onNavigate: (view: 'dashboard' | 'trabajos' | 'clientes' | 'ajustes', jobStatus?: JobStatus, jobId?: string) => void;
}

const ClientCard: React.FC<ClientCardProps> = ({ cliente, trabajos, onEdit, onConfigVehicle, onAddVehicle, onCreateJob, forceExpand, onDataRefresh, onNavigate }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [shouldRender, setShouldRender] = useState(false);
    const [sendingAccess, setSendingAccess] = useState(false);
    const clientTrabajos = trabajos.filter(t => t.clienteId === cliente.id);
    const cardRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (isExpanded) {
            setShouldRender(true);
        } else {
            const timer = setTimeout(() => setShouldRender(false), 300);
            return () => clearTimeout(timer);
        }
    }, [isExpanded]);

    const generateTempPassword = () => {
        const charset = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let result = '';
        for (let i = 0; i < 10; i += 1) {
            result += charset[Math.floor(Math.random() * charset.length)];
        }
        return result;
    };

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
            alert("El cliente no tiene email registrado para generar acceso.");
            return;
        }

        const confirmSend = window.confirm(`¿Compartir acceso para ${cliente.nombre}?\n\nSe enviará el enlace de acceso al portal.`);
        if (!confirmSend) return;

        setSendingAccess(true);

        const tempSupabase = createClient(supabaseUrl, supabaseKey, {
            auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
        });

        let tempPassword = '';
        let shareUrl = '';
        let messageBody = '';

        try {
            const { data: clientAuthData, error: clientAuthError } = await supabase
                .from('clientes')
                .select('temp_password')
                .eq('id', cliente.id)
                .maybeSingle();

            if (clientAuthError) throw clientAuthError;

            tempPassword = clientAuthData?.temp_password || '';

            const generatedPassword = tempPassword || generateTempPassword();

            const { data: authData, error: signUpError } = await tempSupabase.auth.signUp({
                email: cliente.email,
                password: generatedPassword,
                options: {
                    data: {
                        role: 'cliente',
                        taller_nombre_ref: 'Mi Taller'
                    },
                }
            });

            if (authData.user) {
                const newAuthId = authData.user.id;
                tempPassword = generatedPassword;

                if (newAuthId !== cliente.id) {
                    const { error: insertError } = await supabase.from('clientes').insert({
                        id: newAuthId,
                        taller_id: (cliente as any).taller_id,
                        nombre: cliente.nombre,
                        apellido: cliente.apellido,
                        email: cliente.email,
                        telefono: cliente.telefono,
                        temp_password: tempPassword
                    });

                    if (!insertError) {
                        await supabase.from('vehiculos').update({ cliente_id: newAuthId }).eq('cliente_id', cliente.id);
                        await supabase.from('trabajos').update({ cliente_id: newAuthId }).eq('cliente_id', cliente.id);
                        await supabase.from('clientes').delete().eq('id', cliente.id);
                        onDataRefresh();
                    }
                } else {
                    await supabase
                        .from('clientes')
                        .update({ temp_password: tempPassword })
                        .eq('id', cliente.id);
                }

                shareUrl = `${window.location.origin}/?type=invite&email=${encodeURIComponent(cliente.email)}&password=${encodeURIComponent(tempPassword)}`;
                messageBody = `Hola ${cliente.nombre}, accede a tu portal del taller desde este enlace:\n\n${shareUrl}\n\nEmail: ${cliente.email}\n\nAl ingresar se te pedirá crear una nueva contraseña.`;
            } else {
                if (signUpError?.message?.includes('already registered')) {
                    if (!tempPassword) {
                        throw new Error('El cliente ya tiene acceso. No se pudo recuperar la contraseña temporal.');
                    }
                    shareUrl = `${window.location.origin}/?type=invite&email=${encodeURIComponent(cliente.email)}&password=${encodeURIComponent(tempPassword)}`;
                    messageBody = `Hola ${cliente.nombre}, accede a tu portal del taller desde este enlace:\n\n${shareUrl}\n\nEmail: ${cliente.email}\n\nAl ingresar se te pedirá crear una nueva contraseña.`;
                } else {
                    throw signUpError || new Error("No se pudo generar el usuario.");
                }
            }

            if (navigator.share) {
                try {
                    await navigator.share({
                        title: 'Acceso a Mi Taller',
                        text: messageBody,
                    });
                } catch (shareError) {
                    if ((shareError as any).name !== 'AbortError') {
                        await navigator.clipboard.writeText(messageBody);
                        alert("Enlace y datos de acceso copiados al portapapeles.");
                    }
                }
            } else {
                await navigator.clipboard.writeText(messageBody);
                alert("Datos de acceso copiados al portapapeles. Puedes pegarlo en WhatsApp.");
            }

        } catch (error: any) {
            console.error("Error al generar acceso:", error);
            alert("Error al procesar la invitación: " + error.message);
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
                    {shouldRender && (
                        <div className="p-4 border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                                <div>
                                    <h4 className="font-semibold mb-2 text-taller-dark dark:text-taller-light">Información de Contacto</h4>
                                    <div className="space-y-2 text-sm text-taller-dark dark:text-gray-300">
                                        <p className="flex items-center"><PhoneIcon className="h-4 w-4 mr-2 text-taller-gray dark:text-gray-400" /> {cliente.telefono}</p>
                                        <div className="flex flex-wrap items-center justify-between gap-2 group">
                                            <p className="flex items-center break-all">
                                                <EnvelopeIcon className="h-4 w-4 mr-2 text-taller-gray dark:text-gray-400 flex-shrink-0" />
                                                {cliente.email || 'Sin email registrado'}
                                            </p>
                                            {cliente.email && (
                                                <button
                                                    onClick={handleSendAccess}
                                                    disabled={sendingAccess}
                                                    className="flex-shrink-0 flex items-center gap-1 text-xs font-bold text-white bg-green-500 hover:bg-green-600 px-3 py-1.5 rounded-full transition-all shadow-sm ml-auto sm:ml-0 disabled:opacity-50"
                                                    title="Enviar enlace de acceso automático"
                                                >
                                                    {sendingAccess ? (
                                                        <span className="flex items-center gap-1"><ArrowPathIcon className="h-3 w-3 flex-shrink-0 animate-spin" /> Generando...</span>
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
                            <div className="space-y-2">
                                {clientTrabajos.length > 0 ? clientTrabajos.map(trabajo => {
                                    const vehiculo = cliente.vehiculos.find(v => v.id === trabajo.vehiculoId);
                                    return (
                                        <button
                                            key={trabajo.id}
                                            onClick={() => onNavigate('trabajos', trabajo.status, trabajo.id)}
                                            className="w-full text-left p-3 bg-white dark:bg-gray-700 rounded-md border dark:border-gray-600 flex justify-between items-center hover:border-taller-primary hover:shadow-sm transition-all group active:scale-[0.99]"
                                        >
                                            <div className="flex-1 min-w-0">
                                                <div className="flex justify-between items-center mb-1">
                                                    <p className="font-semibold text-taller-dark dark:text-taller-light truncate">{vehiculo ? `${vehiculo.marca} ${vehiculo.modelo}` : 'Vehículo'}</p>
                                                    <span className={`flex-shrink-0 px-2 py-0.5 text-[10px] font-bold uppercase rounded-full ${trabajo.status === 'Finalizado' ? 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300' : 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300'}`}>{trabajo.status}</span>
                                                </div>
                                                <p className="text-sm text-taller-gray dark:text-gray-400 truncate">{trabajo.descripcion}</p>
                                                <p className="text-[10px] text-taller-gray dark:text-gray-500 mt-1">Fecha: {new Date(trabajo.fechaEntrada).toLocaleDateString('es-ES')}</p>
                                            </div>
                                            <div className="ml-4 text-taller-gray dark:text-gray-500 group-hover:text-taller-primary transition-colors">
                                                <ArrowTopRightOnSquareIcon className="h-5 w-5" />
                                            </div>
                                        </button>
                                    )
                                }) : <p className="text-sm text-taller-gray dark:text-gray-400">No hay trabajos registrados.</p>}
                            </div>

                            <div className="mt-6 flex gap-3 w-full">
                                <button
                                    onClick={(e) => { e.stopPropagation(); onCreateJob(cliente.id); }}
                                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm font-semibold text-white bg-taller-primary rounded-lg shadow-sm hover:bg-taller-secondary transition-colors"
                                >
                                    <CurrencyDollarIcon className="h-4 w-4" />
                                    Crear Presupuesto
                                </button>
                                <button
                                    onClick={(e) => { e.stopPropagation(); onEdit(cliente); }}
                                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm font-semibold text-taller-secondary bg-blue-50 border border-taller-secondary/50 rounded-lg shadow-sm hover:bg-blue-100 dark:text-blue-300 dark:bg-blue-900/30 dark:border-blue-500/50 dark:hover:bg-blue-900/50 transition-colors"
                                >
                                    <PencilIcon className="h-4 w-4" />
                                    Editar Datos
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const Clientes: React.FC<ClientesProps> = ({ clientes, trabajos, onDataRefresh, searchQuery, onClientUpdate, onNavigate, isActive }) => {
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [clienteToEdit, setClienteToEdit] = useState<Cliente | null>(null);
    const [vehicleToConfig, setVehicleToConfig] = useState<Vehiculo | null>(null);
    const [clientToAddVehicle, setClientToAddVehicle] = useState<string | null>(null);
    const [clientForNewJob, setClientForNewJob] = useState<string | null>(null);
    const [visibleCount, setVisibleCount] = useState(15);
    const sentinelRef = useRef<HTMLDivElement>(null);
    const headerRef = useRef<HTMLDivElement>(null);

    const [headerHeight, setHeaderHeight] = useState(0);
    const headerOffsetRef = useRef(0);
    const lastScrollTop = useRef(0);

    useLayoutEffect(() => {
        const updateHeight = () => {
            if (headerRef.current) {
                const height = headerRef.current.offsetHeight;
                setHeaderHeight(height);
                // Set CSS variable for children to use
                headerRef.current.parentElement?.style.setProperty('--header-h', `${height}px`);
                headerRef.current.style.transform = `translateY(${-headerOffsetRef.current}px)`;
                headerRef.current.style.opacity = (1 - (headerOffsetRef.current / (height || 1))).toString();
            }
        };
        const resizeObserver = new ResizeObserver(updateHeight);
        if (headerRef.current) resizeObserver.observe(headerRef.current);
        updateHeight();
        window.addEventListener('resize', updateHeight);
        return () => {
            resizeObserver.disconnect();
            window.removeEventListener('resize', updateHeight);
        };
    }, []);

    useEffect(() => {
        if (isActive && headerRef.current) {
            const height = headerRef.current.offsetHeight;
            setHeaderHeight(height);
            headerRef.current.parentElement?.style.setProperty('--header-h', `${height}px`);
            
            headerOffsetRef.current = 0;
            headerRef.current.style.transform = 'translateY(0px)';
            headerRef.current.style.opacity = '1';
        }
    }, [isActive]);

    const handleVerticalScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
        if (!headerRef.current) return;
        const el = e.currentTarget;
        const st = el.scrollTop;
        const lastSt = lastScrollTop.current;
        const diff = st - lastSt;
        lastScrollTop.current = st;

        if (st <= 0) {
            headerOffsetRef.current = 0;
        } else {
            headerOffsetRef.current = Math.max(0, Math.min(headerHeight, headerOffsetRef.current + diff));
        }

        const offset = headerOffsetRef.current;
        const header = headerRef.current;
        header.style.transform = `translateY(${-offset}px)`;
        header.style.opacity = (1 - (offset / (headerHeight || 1))).toString();
        header.style.pointerEvents = offset > headerHeight * 0.8 ? 'none' : 'auto';
    }, [headerHeight]);

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
                    (v.marca?.toLowerCase() || '').includes(lowercasedQuery) ||
                    (v.modelo?.toLowerCase() || '').includes(lowercasedQuery) ||
                    (v.matricula?.toLowerCase() || '').includes(lowercasedQuery)
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

    const visibleClientes = useMemo(() => {
        return filteredClientes.slice(0, visibleCount);
    }, [filteredClientes, visibleCount]);

    useEffect(() => {
        setVisibleCount(15);
    }, [searchQuery]);

    useEffect(() => {
        const observer = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting && visibleCount < filteredClientes.length) {
                setVisibleCount(prev => prev + 15);
            }
        }, { threshold: 0.1, rootMargin: '150px' });

        const currentSentinel = sentinelRef.current;
        if (currentSentinel) {
            observer.observe(currentSentinel);
        }

        return () => {
            if (currentSentinel) {
                observer.unobserve(currentSentinel);
            }
        };
    }, [filteredClientes.length, visibleCount]);

    return (
        <div className="h-full w-full flex flex-col relative overflow-hidden bg-taller-light dark:bg-taller-dark">
            {/* Header bar matching Trabajos.tsx layout & positioning */}
            <div
                ref={headerRef}
                className="absolute top-0 left-0 right-0 bg-taller-light dark:bg-taller-dark z-30 flex-shrink-0 job-tab-header-bar"
                style={{
                    pointerEvents: 'auto',
                }}
            >
                <div className="max-w-3xl mx-auto p-4 pt-5 pb-3 w-full">
                    <button
                        type="button"
                        onClick={() => setIsCreateModalOpen(true)}
                        className="w-full flex items-center justify-center gap-2 py-3.5 px-4 bg-taller-primary text-white font-extrabold rounded-xl shadow-lg shadow-taller-primary/20 active:scale-95 transition-all duration-300"
                    >
                        <UserPlusIcon className="h-5 w-5" />
                        <span className="uppercase tracking-wider text-xs">Nuevo Cliente</span>
                    </button>
                </div>
            </div>

            {/* Scrollable list content matching Trabajos.tsx format and padding */}
            <div 
                className="flex-1 w-full overflow-y-auto px-4 lg:px-0 scrollbar-hide overscroll-none dashboard-scroll job-scroll-view" 
                style={{ WebkitOverflowScrolling: 'touch', paddingTop: 'var(--header-h)' }}
                onScroll={handleVerticalScroll}
            >
                <div className="max-w-3xl mx-auto min-h-full w-full flex flex-col space-y-4 pb-20">
                    {visibleClientes.length > 0 ? (
                        visibleClientes.map(cliente => (
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
                                onNavigate={onNavigate}
                            />
                        ))
                    ) : (
                        <div className="text-center py-10 bg-white dark:bg-gray-800 rounded-lg shadow-md">
                            <p className="text-taller-gray dark:text-gray-400">No se encontraron clientes.</p>
                            {searchQuery && <p className="text-sm text-taller-gray dark:text-gray-400 mt-2">Intente con otro término de búsqueda.</p>}
                        </div>
                    )}
                    <div ref={sentinelRef} className="h-4 w-full pointer-events-none flex-shrink-0" />
                </div>
            </div>

            <Suspense fallback={null}>
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
            </Suspense>
        </div>
    );
};

export default Clientes;
