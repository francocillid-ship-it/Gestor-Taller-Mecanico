
import React, { useMemo, useState, useEffect, useRef } from 'react';
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
    const groupRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (isExpanded && groupRef.current) {
            const timer = setTimeout(() => {
                const element = groupRef.current;
                if (!element) return;

                const rect = element.getBoundingClientRect();
                const windowHeight = window.innerHeight;
                const headerOffset = 180; // Adjusted offset for mobile tabs + header

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

    if (trabajos.length === 0) return null;

    return (
        <div ref={groupRef} className="mb-4 last:mb-0 scroll-mt-32">
            <button 
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full flex justify-between items-center text-xs font-semibold text-taller-gray dark:text-gray-400 uppercase tracking-wider mb-2 hover:text-taller-primary transition-colors bg-gray-50 dark:bg-gray-800/50 p-2 rounded"
            >
                <div className="flex items-center gap-2">
                    <CalendarIcon className="h-3 w-3" />
                    {category}
                </div>
                <div className="flex items-center gap-2">
                    <span className="bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-1.5 py-0.5 rounded text-[10px]">{trabajos.length}</span>
                    <ChevronDownIcon className={`h-3 w-3 transform transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                </div>
            </button>
            
            <div className={`grid transition-[grid-template-rows] duration-300 ease-out ${isExpanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
                <div className="overflow-hidden">
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
    const [isExpanded, setIsExpanded] = useState(false);
    const columnRef = useRef<HTMLDivElement>(null);

    // Effect to handle auto-expansion based on search results (only for Desktop accordion mode)
    useEffect(() => {
        if (!forceExpanded) {
            if (searchQuery.trim().length > 0) {
                setIsExpanded(trabajos.length > 0);
            } else {
                setIsExpanded(false);
            }
        }
    }, [searchQuery, trabajos.length, forceExpanded]);

    // Effect for auto-scroll on expansion (Conditional, only for Desktop accordion mode)
    useEffect(() => {
        if (!forceExpanded && isExpanded && columnRef.current && !searchQuery) {
            const timer = setTimeout(() => {
                const element = columnRef.current;
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
    }, [isExpanded, searchQuery, forceExpanded]);

    const getStatusColor = (status: JobStatus) => {
        switch (status) {
            case JobStatus.Presupuesto: return 'border-yellow-400 text-yellow-600 dark:text-yellow-400';
            case JobStatus.Programado: return 'border-blue-400 text-blue-600 dark:text-blue-400';
            case JobStatus.EnProceso: return 'border-orange-400 text-orange-600 dark:text-orange-400';
            case JobStatus.Finalizado: return 'border-green-400 text-green-600 dark:text-green-400';
            default: return 'border-gray-400 text-gray-600';
        }
    };
    
    // Group logic for "Finalizado"
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

    const isColumnExpanded = forceExpanded || isExpanded;

    return (
        <div 
            ref={columnRef}
            className={`w-full ${forceExpanded ? '' : 'lg:w-80 bg-gray-100 dark:bg-gray-800 rounded-lg p-3 lg:flex-shrink-0 transition-all duration-300 ease-in-out h-fit scroll-mt-4'}`}
        >
            {/* Header: Visible only in Desktop/Accordion Mode OR if forceExpanded is false */}
            {!forceExpanded && (
                <div 
                    className={`flex justify-between items-center ${isExpanded ? 'mb-2 border-b-2' : ''} pb-2 ${getStatusColor(status).split(' ')[0]} cursor-pointer hover:opacity-80 transition-all duration-300`}
                    onClick={() => setIsExpanded(!isExpanded)}
                >
                     <div className="flex items-center gap-2">
                        <h3 className="font-bold text-taller-dark dark:text-taller-light transition-colors duration-300">{status}</h3>
                        <span className={`text-xs font-semibold px-2 py-1 rounded-full transition-all duration-300 ${trabajos.length > 0 ? 'bg-taller-primary text-white' : 'bg-gray-300 text-gray-600 dark:bg-gray-700 dark:text-gray-400'}`}>
                            {trabajos.length}
                        </span>
                     </div>
                     <div className={`transform transition-transform duration-300 ${isExpanded ? 'rotate-180' : 'rotate-0'}`}>
                        <ChevronDownIcon className="h-5 w-5 text-taller-gray dark:text-gray-400" />
                     </div>
                </div>
            )}
           
            {/* Animación suave usando Grid Template Rows (Only relevant for accordion mode) */}
            {/* If forceExpanded, we just show content without animation container for better performance */}
            <div className={`${forceExpanded ? 'block' : `grid transition-[grid-template-rows] duration-300 ease-out ${isExpanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}`}>
                <div className={`${forceExpanded ? '' : 'overflow-hidden'}`}>
                    <div className={`${forceExpanded ? 'pt-0' : 'pt-2 lg:max-h-[80vh] lg:overflow-y-auto transition-opacity duration-300 custom-scrollbar relative'} ${isColumnExpanded ? 'opacity-100' : 'opacity-0'}`}>
                        
                        {trabajos.length > 0 ? (
                            status === JobStatus.Finalizado && groupedJobs ? (
                                <>
                                    <JobGroup category="Esta semana" trabajos={groupedJobs['Esta semana']} defaultExpanded={true} clientes={clientes} onUpdateStatus={onUpdateStatus} tallerInfo={tallerInfo} onDataRefresh={onDataRefresh} />
                                    <JobGroup category="Semana pasada" trabajos={groupedJobs['Semana pasada']} defaultExpanded={false} clientes={clientes} onUpdateStatus={onUpdateStatus} tallerInfo={tallerInfo} onDataRefresh={onDataRefresh} />
                                    <JobGroup category="Mes pasado" trabajos={groupedJobs['Mes pasado']} defaultExpanded={false} clientes={clientes} onUpdateStatus={onUpdateStatus} tallerInfo={tallerInfo} onDataRefresh={onDataRefresh} />
                                    <JobGroup category="Anteriores" trabajos={groupedJobs['Anteriores']} defaultExpanded={false} clientes={clientes} onUpdateStatus={onUpdateStatus} tallerInfo={tallerInfo} onDataRefresh={onDataRefresh} />
                                </>
                            ) : (
                                <div className="space-y-4 pb-2 pr-1">
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
                        {/* Visual indicator at the bottom to suggest more content/scrolling - Hidden on mobile */}
                        {!forceExpanded && trabajos.length > 2 && <div className="sticky bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-gray-100 dark:from-gray-800 to-transparent pointer-events-none hidden lg:block" />}
                    </div>
                </div>
            </div>
        </div>
    );
};


const Trabajos: React.FC<TrabajosProps> = ({ trabajos, clientes, onUpdateStatus, onDataRefresh, tallerInfo, searchQuery }) => {
    const [isJobModalOpen, setIsJobModalOpen] = useState(false);
    const [initialClientIdForModal, setInitialClientIdForModal] = useState<string | undefined>(undefined);
    const [activeMobileTab, setActiveMobileTab] = useState<JobStatus>(JobStatus.Presupuesto); // Default tab

    // Check local storage on mount to see if we need to reopen the modal after a reload
    useEffect(() => {
        const pendingClientId = localStorage.getItem('pending_job_client_id');
        if (pendingClientId) {
            setInitialClientIdForModal(pendingClientId);
            setIsJobModalOpen(true);
            // Clear it immediately so it doesn't open on next random reload
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

    // Check if there are any results at all across all columns
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
        <div className="h-full flex flex-col">
            <style>{`
                /* Custom Scrollbar Styles for better visibility */
                .custom-scrollbar::-webkit-scrollbar {
                    width: 6px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background-color: rgba(156, 163, 175, 0.5);
                    border-radius: 20px;
                }
                .dark .custom-scrollbar::-webkit-scrollbar-thumb {
                    background-color: rgba(75, 85, 99, 0.5);
                }
            `}</style>
            
            <div className="flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-center mb-4 lg:mb-6">
                <h2 className="text-2xl font-bold text-taller-dark dark:text-taller-light">Flujo de Trabajos</h2>
                {/* Desktop "Nuevo Presupuesto" Button - Hidden on mobile */}
                <div className="hidden lg:flex">
                    <button
                        onClick={() => {
                            setInitialClientIdForModal(undefined);
                            setIsJobModalOpen(true);
                        }}
                        className="flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-taller-primary rounded-lg shadow-md hover:bg-taller-secondary focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-taller-secondary transition-colors"
                    >
                       <PlusIcon className="h-5 w-5"/>
                        Nuevo Presupuesto
                    </button>
                </div>
            </div>

            {/* Mobile Tabs Navigation - Redesigned Grid */}
            <div className="lg:hidden mb-4">
                <div className="grid grid-cols-4 gap-2 bg-gray-100 dark:bg-gray-800 p-1.5 rounded-xl">
                    {statusOrder.map(status => {
                        const Icon = getMobileTabIcon(status);
                        const isActive = activeMobileTab === status;
                        const count = trabajosByStatus[status]?.length || 0;
                        
                        return (
                            <button
                                key={status}
                                onClick={() => setActiveMobileTab(status)}
                                className={`relative flex flex-col items-center justify-center h-16 rounded-lg transition-all duration-200 ${
                                    isActive 
                                    ? 'bg-white dark:bg-gray-700 text-taller-primary dark:text-white shadow-sm ring-1 ring-black/5 dark:ring-white/10' 
                                    : 'text-gray-500 dark:text-gray-400 hover:bg-gray-200/50 dark:hover:bg-gray-700/50'
                                }`}
                            >
                                <Icon className={`h-5 w-5 mb-1 ${isActive ? 'text-taller-primary dark:text-white' : 'text-gray-400 dark:text-gray-500'}`} />
                                <span className={`text-[10px] font-medium leading-none tracking-tight ${isActive ? 'text-taller-primary dark:text-white' : ''}`}>{getMobileTabLabel(status)}</span>
                                {count > 0 && (
                                    <span className={`absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold ${
                                        isActive 
                                        ? 'bg-taller-primary text-white dark:bg-white dark:text-taller-primary' 
                                        : 'bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-300'
                                    }`}>
                                        {count}
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Mobile Action Button - Only for 'Presupuestos' tab - Smaller size */}
            <div className="lg:hidden mb-4">
                {activeMobileTab === JobStatus.Presupuesto && (
                    <button
                        onClick={() => {
                            setInitialClientIdForModal(undefined);
                            setIsJobModalOpen(true);
                        }}
                        className="w-full flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-taller-primary rounded-lg shadow-md hover:bg-taller-secondary transition-colors"
                    >
                       <PlusIcon className="h-4 w-4"/>
                        Nuevo Presupuesto
                    </button>
                )}
            </div>

            <div className="flex-1 flex flex-col lg:flex-row lg:gap-6 lg:space-x-4 lg:overflow-x-auto pb-4">
                {searchQuery && !hasResults ? (
                    <div className="w-full flex flex-col items-center justify-center mt-12 text-taller-gray dark:text-gray-400">
                        <MagnifyingGlassIcon className="h-16 w-16 mb-4 opacity-50"/>
                        <p className="text-lg font-medium">No se encontraron resultados para "{searchQuery}"</p>
                        <p className="text-sm mt-2 opacity-75">Intenta buscar por cliente, vehículo o descripción.</p>
                    </div>
                ) : (
                    <>
                        {/* Mobile View: Render only ACTIVE tab */}
                        <div className="lg:hidden h-full">
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

                        {/* Desktop View: Render ALL columns side by side */}
                        {statusOrder.map(status => {
                            const jobs = trabajosByStatus[status] || [];
                            // In Desktop, hide column if searching and no matches, but keep structure
                            if (searchQuery && jobs.length === 0) return null;

                            return (
                                <div key={status} className="hidden lg:block h-full">
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
                    </>
                )}
                {/* Spacer for bottom nav on mobile */}
                {tallerInfo.mobileNavStyle === 'bottom_nav' && <div className="h-16 md:hidden flex-shrink-0" />}
            </div>

            {isJobModalOpen && (
                <CrearTrabajoModal
                    clientes={clientes}
                    onClose={() => setIsJobModalOpen(false)}
                    onSuccess={() => {
                        setIsJobModalOpen(false);
                        onDataRefresh();
                    }}
                    onDataRefresh={onDataRefresh}
                    initialClientId={initialClientIdForModal}
                />
            )}
        </div>
    );
};

export default Trabajos;
