
import React, { useMemo, useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { Trabajo, Cliente, TallerInfo } from '../types';
import { JobStatus } from '../types';
import JobCard from './JobCard';
import CrearTrabajoModal from './CrearTrabajoModal';
import { PlusIcon, ChevronDownIcon, MagnifyingGlassIcon, CalendarIcon, CurrencyDollarIcon, WrenchScrewdriverIcon, ClockIcon } from '@heroicons/react/24/solid';

interface TrabajosProps {
    trabajos: Trabajo[];
    clientes: Cliente[];
    onUpdateStatus: (trabajoId: string, newStatus: JobStatus) => void;
    onDataRefresh: () => void;
    tallerInfo: TallerInfo;
    searchQuery: string;
}

const statusOrder = [JobStatus.Presupuesto, JobStatus.Programado, JobStatus.EnProceso, JobStatus.Finalizado];

// Categorías temporales
type TimeCategory = 'Esta semana' | 'Semana pasada' | 'Mes pasado' | 'Anteriores';

const getDateCategory = (dateString: string): TimeCategory => {
    const date = new Date(dateString);
    const now = new Date();
    
    // Reset hours to compare dates properly
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const jobDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    
    // Calculate start of current week (Monday)
    const day = today.getDay() || 7; // Get current day number, converting Sun (0) to 7
    if(day !== 1) today.setHours(-24 * (day - 1));
    const startOfCurrentWeek = today;

    const startOfPreviousWeek = new Date(startOfCurrentWeek);
    startOfPreviousWeek.setDate(startOfCurrentWeek.getDate() - 7);

    const startOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfPreviousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    if (jobDate >= startOfCurrentWeek) return 'Esta semana';
    if (jobDate >= startOfPreviousWeek) return 'Semana pasada';
    if (jobDate >= startOfPreviousMonth) return 'Mes pasado';
    return 'Anteriores';
};

const JobGroup: React.FC<{ 
    category: TimeCategory; 
    trabajos: Trabajo[];
    clientes: Cliente[];
    onUpdateStatus: (id: string, s: JobStatus) => void;
    tallerInfo: TallerInfo;
    onDataRefresh: () => void;
    defaultExpanded: boolean;
}> = ({ category, trabajos, clientes, onUpdateStatus, tallerInfo, onDataRefresh, defaultExpanded }) => {
    const [isExpanded, setIsExpanded] = useState(defaultExpanded);

    if (trabajos.length === 0) return null;

    return (
        <div className="mb-3 last:mb-0">
            <button 
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full flex justify-between items-center text-xs font-semibold text-taller-gray dark:text-gray-400 uppercase tracking-wider mb-2 hover:text-taller-primary transition-colors bg-white dark:bg-gray-700/50 p-2 rounded shadow-sm"
            >
                <div className="flex items-center gap-2">
                    <CalendarIcon className="h-3 w-3" />
                    {category}
                </div>
                <div className="flex items-center gap-2">
                    <span className="bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300 px-1.5 py-0.5 rounded text-[10px]">{trabajos.length}</span>
                    <ChevronDownIcon className={`h-3 w-3 transform transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                </div>
            </button>
            
            <div className={`grid transition-[grid-template-rows] duration-300 ease-out ${isExpanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
                <div className="overflow-hidden">
                    <div className="space-y-3 pb-1">
                        {trabajos.map(trabajo => {
                            const cliente = clientes.find(c => c.id === trabajo.clienteId);
                            const vehiculo = cliente?.vehiculos.find(v => v.id === trabajo.vehiculoId);
                            return (
                                <JobCard
                                    key={trabajo.id}
                                    trabajo={trabajo}
                                    cliente={cliente}
                                    vehiculo={vehiculo}
                                    onUpdateStatus={onUpdateStatus}
                                    tallerInfo={tallerInfo}
                                    clientes={clientes}
                                    onDataRefresh={onDataRefresh}
                                />
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
};


const StatusColumn: React.FC<{
    status: JobStatus;
    trabajos: Trabajo[];
    clientes: Cliente[];
    onUpdateStatus: (trabajoId: string, newStatus: JobStatus) => void;
    tallerInfo: TallerInfo;
    onDataRefresh: () => void;
    searchQuery: string;
    forceExpanded?: boolean; // Prop to force expansion (Mobile Tab Mode)
}> = ({ status, trabajos, clientes, onUpdateStatus, tallerInfo, onDataRefresh, searchQuery, forceExpanded }) => {
    // Default to expanded on desktop (unless searching with no results)
    const [isExpanded, setIsExpanded] = useState(true);

    // Effect to handle auto-expansion based on search results
    useEffect(() => {
        if (!forceExpanded) {
            if (searchQuery.trim().length > 0) {
                setIsExpanded(trabajos.length > 0);
            }
        }
    }, [searchQuery, trabajos.length, forceExpanded]);

    const getStatusColor = (status: JobStatus) => {
        switch (status) {
            case JobStatus.Presupuesto: return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300';
            case JobStatus.Programado: return 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300';
            case JobStatus.EnProceso: return 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300';
            case JobStatus.Finalizado: return 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300';
            default: return 'bg-gray-100 text-gray-800';
        }
    };
    
    const groupedJobs = useMemo(() => {
        if (status !== JobStatus.Finalizado) return null;
        
        const groups: Record<TimeCategory, Trabajo[]> = {
            'Esta semana': [],
            'Semana pasada': [],
            'Mes pasado': [],
            'Anteriores': []
        };

        trabajos.forEach(t => {
            const date = t.fechaSalida || t.fechaEntrada;
            const cat = getDateCategory(date);
            groups[cat].push(t);
        });

        return groups;
    }, [trabajos, status]);

    // On Desktop (!forceExpanded), we render a full height column
    // On Mobile (forceExpanded), we render just the content list
    
    if (forceExpanded) {
        // Mobile View Content
        return (
            <div className="pt-2 pb-24 px-1">
                {trabajos.length > 0 ? (
                    status === JobStatus.Finalizado && groupedJobs ? (
                        <>
                            <JobGroup category="Esta semana" trabajos={groupedJobs['Esta semana']} defaultExpanded={true} clientes={clientes} onUpdateStatus={onUpdateStatus} tallerInfo={tallerInfo} onDataRefresh={onDataRefresh} />
                            <JobGroup category="Semana pasada" trabajos={groupedJobs['Semana pasada']} defaultExpanded={false} clientes={clientes} onUpdateStatus={onUpdateStatus} tallerInfo={tallerInfo} onDataRefresh={onDataRefresh} />
                            <JobGroup category="Mes pasado" trabajos={groupedJobs['Mes pasado']} defaultExpanded={false} clientes={clientes} onUpdateStatus={onUpdateStatus} tallerInfo={tallerInfo} onDataRefresh={onDataRefresh} />
                            <JobGroup category="Anteriores" trabajos={groupedJobs['Anteriores']} defaultExpanded={false} clientes={clientes} onUpdateStatus={onUpdateStatus} tallerInfo={tallerInfo} onDataRefresh={onDataRefresh} />
                        </>
                    ) : (
                        <div className="space-y-4 pb-2">
                            {trabajos.map(trabajo => {
                                const cliente = clientes.find(c => c.id === trabajo.clienteId);
                                const vehiculo = cliente?.vehiculos.find(v => v.id === trabajo.vehiculoId);
                                return (
                                    <JobCard
                                        key={trabajo.id}
                                        trabajo={trabajo}
                                        cliente={cliente}
                                        vehiculo={vehiculo}
                                        onUpdateStatus={onUpdateStatus}
                                        tallerInfo={tallerInfo}
                                        clientes={clientes}
                                        onDataRefresh={onDataRefresh}
                                    />
                                );
                            })}
                        </div>
                    )
                ) : (
                    <div className="py-12 text-center">
                        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-800 mb-3">
                            <MagnifyingGlassIcon className="h-6 w-6 text-gray-400" />
                        </div>
                        <p className="text-sm text-taller-gray dark:text-gray-400">
                            {searchQuery ? "No hay coincidencias." : `No hay trabajos en ${status}.`}
                        </p>
                    </div>
                )}
            </div>
        );
    }

    // Desktop Board Column
    return (
        <div className={`flex flex-col h-full bg-gray-100 dark:bg-gray-800 rounded-xl overflow-hidden shadow-sm border dark:border-gray-700 transition-all duration-300 ${!isExpanded ? 'opacity-60 grayscale' : ''}`}>
            {/* Header */}
            <div 
                className={`flex justify-between items-center p-3 border-b dark:border-gray-700 cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors`}
                onClick={() => setIsExpanded(!isExpanded)}
            >
                 <div className="flex items-center gap-2">
                    <h3 className="font-bold text-sm text-taller-dark dark:text-taller-light uppercase tracking-wide">{status}</h3>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${getStatusColor(status)}`}>
                        {trabajos.length}
                    </span>
                 </div>
                 <div className={`transform transition-transform duration-300 ${isExpanded ? 'rotate-0' : '-rotate-90'}`}>
                    <ChevronDownIcon className="h-4 w-4 text-taller-gray dark:text-gray-400" />
                 </div>
            </div>

            {/* Content List - Always takes available height */}
            <div className={`flex-1 overflow-y-auto custom-scrollbar p-2 transition-all duration-300 ${isExpanded ? 'opacity-100' : 'opacity-0 hidden'}`}>
                {trabajos.length > 0 ? (
                    status === JobStatus.Finalizado && groupedJobs ? (
                        <>
                            <JobGroup category="Esta semana" trabajos={groupedJobs['Esta semana']} defaultExpanded={true} clientes={clientes} onUpdateStatus={onUpdateStatus} tallerInfo={tallerInfo} onDataRefresh={onDataRefresh} />
                            <JobGroup category="Semana pasada" trabajos={groupedJobs['Semana pasada']} defaultExpanded={false} clientes={clientes} onUpdateStatus={onUpdateStatus} tallerInfo={tallerInfo} onDataRefresh={onDataRefresh} />
                            <JobGroup category="Mes pasado" trabajos={groupedJobs['Mes pasado']} defaultExpanded={false} clientes={clientes} onUpdateStatus={onUpdateStatus} tallerInfo={tallerInfo} onDataRefresh={onDataRefresh} />
                            <JobGroup category="Anteriores" trabajos={groupedJobs['Anteriores']} defaultExpanded={false} clientes={clientes} onUpdateStatus={onUpdateStatus} tallerInfo={tallerInfo} onDataRefresh={onDataRefresh} />
                        </>
                    ) : (
                        <div className="space-y-3">
                            {trabajos.map(trabajo => {
                                const cliente = clientes.find(c => c.id === trabajo.clienteId);
                                const vehiculo = cliente?.vehiculos.find(v => v.id === trabajo.vehiculoId);
                                return (
                                    <JobCard
                                        key={trabajo.id}
                                        trabajo={trabajo}
                                        cliente={cliente}
                                        vehiculo={vehiculo}
                                        onUpdateStatus={onUpdateStatus}
                                        tallerInfo={tallerInfo}
                                        clientes={clientes}
                                        onDataRefresh={onDataRefresh}
                                    />
                                );
                            })}
                        </div>
                    )
                ) : (
                    <div className="h-32 flex flex-col items-center justify-center text-center opacity-60">
                        <p className="text-xs text-taller-gray dark:text-gray-400">Sin trabajos</p>
                    </div>
                )}
            </div>
        </div>
    );
};


const Trabajos: React.FC<TrabajosProps> = ({ trabajos, clientes, onUpdateStatus, onDataRefresh, tallerInfo, searchQuery }) => {
    const [isJobModalOpen, setIsJobModalOpen] = useState(false);
    const [initialClientIdForModal, setInitialClientIdForModal] = useState<string | undefined>(undefined);
    const [activeMobileTab, setActiveMobileTab] = useState<JobStatus>(JobStatus.Presupuesto); 

    useEffect(() => {
        const pendingClientId = localStorage.getItem('pending_job_client_id');
        if (pendingClientId) {
            setInitialClientIdForModal(pendingClientId);
            setIsJobModalOpen(true);
            localStorage.removeItem('pending_job_client_id');
        }
    }, []);

    const trabajosByStatus = useMemo(() => {
        let filteredTrabajos = trabajos;
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            filteredTrabajos = trabajos.filter(t => {
                const cliente = clientes.find(c => c.id === t.clienteId);
                const vehiculo = cliente?.vehiculos.find(v => v.id === t.vehiculoId);
                const fullName = cliente ? `${cliente.nombre} ${cliente.apellido || ''}`.toLowerCase() : '';
                return (
                    t.descripcion.toLowerCase().includes(query) ||
                    fullName.includes(query) ||
                    vehiculo?.marca.toLowerCase().includes(query) ||
                    vehiculo?.modelo.toLowerCase().includes(query) ||
                    vehiculo?.matricula.toLowerCase().includes(query) ||
                    t.status.toLowerCase().includes(query)
                );
            });
        }

        return statusOrder.reduce((acc, status) => {
            acc[status] = filteredTrabajos.filter(t => t.status === status).sort((a,b) => new Date(b.fechaEntrada).getTime() - new Date(a.fechaEntrada).getTime());
            return acc;
        }, {} as Record<JobStatus, Trabajo[]>);
    }, [trabajos, searchQuery, clientes]);

    const hasResults = useMemo(() => (Object.values(trabajosByStatus) as Trabajo[][]).some(list => list.length > 0), [trabajosByStatus]);
    
    const getMobileTabLabel = (status: JobStatus) => {
        switch(status) {
            case JobStatus.Presupuesto: return 'Presupuestos';
            case JobStatus.Programado: return 'Programados';
            case JobStatus.EnProceso: return 'En Proceso';
            case JobStatus.Finalizado: return 'Historial';
            default: return status;
        }
    };

    const getMobileTabIcon = (status: JobStatus) => {
        switch(status) {
            case JobStatus.Presupuesto: return CurrencyDollarIcon;
            case JobStatus.Programado: return CalendarIcon;
            case JobStatus.EnProceso: return WrenchScrewdriverIcon;
            case JobStatus.Finalizado: return ClockIcon;
            default: return CalendarIcon;
        }
    };

    return (
        <div className="h-full flex flex-col relative">
            <style>{`
                /* Custom Scrollbar Styles */
                .custom-scrollbar::-webkit-scrollbar {
                    width: 5px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background-color: rgba(156, 163, 175, 0.4);
                    border-radius: 20px;
                }
                .dark .custom-scrollbar::-webkit-scrollbar-thumb {
                    background-color: rgba(75, 85, 99, 0.4);
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background-color: rgba(156, 163, 175, 0.7);
                }
            `}</style>
            
            <div className="flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-center mb-4 lg:mb-4 flex-shrink-0">
                <h2 className="text-2xl font-bold text-taller-dark dark:text-taller-light">Flujo de Trabajos</h2>
                <div className="hidden lg:flex">
                    <button
                        onClick={() => {
                            setInitialClientIdForModal(undefined);
                            setIsJobModalOpen(true);
                        }}
                        className="flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-taller-primary rounded-lg shadow-md hover:bg-taller-secondary transition-colors"
                    >
                       <PlusIcon className="h-5 w-5"/>
                        Nuevo Presupuesto
                    </button>
                </div>
            </div>

            {/* Main Content Area */}
            {searchQuery && !hasResults ? (
                <div className="flex-1 flex flex-col items-center justify-center text-taller-gray dark:text-gray-400">
                    <MagnifyingGlassIcon className="h-16 w-16 mb-4 opacity-50"/>
                    <p className="text-lg font-medium">No se encontraron resultados para "{searchQuery}"</p>
                    <p className="text-sm mt-2 opacity-75">Intenta buscar por cliente, vehículo o descripción.</p>
                </div>
            ) : (
                <>
                    {/* Mobile View: Render only ACTIVE tab */}
                    <div className="lg:hidden flex-1 overflow-y-auto">
                        <StatusColumn
                            key={activeMobileTab}
                            status={activeMobileTab}
                            trabajos={trabajosByStatus[activeMobileTab] || []}
                            clientes={clientes}
                            onUpdateStatus={onUpdateStatus}
                            tallerInfo={tallerInfo}
                            onDataRefresh={onDataRefresh}
                            searchQuery={searchQuery}
                            forceExpanded={true}
                        />
                    </div>

                    {/* Desktop View: Board Layout */}
                    {/* Updated container for full height responsive grid behavior */}
                    <div className="hidden lg:flex flex-row gap-4 h-[calc(100vh-160px)] overflow-x-auto pb-2 items-stretch">
                        {statusOrder.map(status => {
                            const jobs = trabajosByStatus[status] || [];
                            return (
                                <div key={status} className="flex-1 min-w-[300px] h-full flex flex-col">
                                    <StatusColumn
                                        status={status}
                                        trabajos={jobs}
                                        clientes={clientes}
                                        onUpdateStatus={onUpdateStatus}
                                        tallerInfo={tallerInfo}
                                        onDataRefresh={onDataRefresh}
                                        searchQuery={searchQuery}
                                        forceExpanded={false}
                                    />
                                </div>
                            );
                        })}
                    </div>
                </>
            )}

            {/* Mobile Bottom Navigation */}
            <div className={`lg:hidden fixed left-1/2 -translate-x-1/2 z-20 flex flex-col items-center pointer-events-none transition-all duration-300 w-full ${
                tallerInfo.mobileNavStyle === 'bottom_nav' ? 'bottom-[96px]' : 'bottom-6'
            }`}>
                {activeMobileTab === JobStatus.Presupuesto && (
                    <div className="w-full flex justify-center mb-4 pointer-events-auto px-4">
                        <button
                            onClick={() => {
                                setInitialClientIdForModal(undefined);
                                setIsJobModalOpen(true);
                            }}
                            className="flex items-center justify-center gap-2 px-6 py-2.5 text-xs font-bold text-white bg-taller-primary rounded-full shadow-lg shadow-taller-primary/40 hover:bg-taller-secondary hover:scale-105 transition-all transform active:scale-95"
                        >
                           <PlusIcon className="h-4 w-4"/>
                            NUEVO PRESUPUESTO
                        </button>
                    </div>
                )}

                <div className="w-[95%] max-w-sm bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 pointer-events-auto overflow-hidden">
                    <div className="grid grid-cols-4 h-14">
                        {statusOrder.map(status => {
                            const Icon = getMobileTabIcon(status);
                            const isActive = activeMobileTab === status;
                            const count = trabajosByStatus[status]?.length || 0;
                            
                            return (
                                <button
                                    key={status}
                                    onClick={() => setActiveMobileTab(status)}
                                    className={`relative flex flex-col items-center justify-center transition-colors duration-200 group ${
                                        isActive 
                                        ? 'bg-blue-50 dark:bg-gray-700/50' 
                                        : 'hover:bg-gray-50 dark:hover:bg-gray-700/30'
                                    }`}
                                >
                                    <Icon className={`h-5 w-5 mb-0.5 transition-colors ${
                                        isActive 
                                        ? 'text-taller-primary dark:text-white' 
                                        : 'text-gray-400 dark:text-gray-500 group-hover:text-gray-600 dark:group-hover:text-gray-400'
                                    }`} />
                                    <span className={`text-[9px] font-bold leading-none tracking-tight transition-colors ${
                                        isActive 
                                        ? 'text-taller-primary dark:text-white' 
                                        : 'text-gray-400 dark:text-gray-500'
                                    }`}>
                                        {getMobileTabLabel(status)}
                                    </span>
                                    
                                    {count > 0 && (
                                        <span className={`absolute top-1 right-2 flex h-3.5 w-3.5 items-center justify-center rounded-full text-[8px] font-bold shadow-sm ${
                                            isActive 
                                            ? 'bg-taller-primary text-white dark:bg-white dark:text-taller-primary' 
                                            : 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300'
                                        }`}>
                                            {count}
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>

            {isJobModalOpen && createPortal(
                <CrearTrabajoModal
                    clientes={clientes}
                    onClose={() => setIsJobModalOpen(false)}
                    onSuccess={() => {
                        setIsJobModalOpen(false);
                        onDataRefresh();
                    }}
                    onDataRefresh={onDataRefresh}
                    initialClientId={initialClientIdForModal}
                />,
                document.body
            )}
        </div>
    );
};

export default Trabajos;
