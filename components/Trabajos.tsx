
import React, { useMemo, useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { Trabajo, Cliente, TallerInfo } from '../types';
import { JobStatus } from '../types';
import JobCard from './JobCard';
import CrearTrabajoModal from './CrearTrabajoModal';
import { PlusIcon, ChevronDownIcon, MagnifyingGlassIcon, CalendarIcon, CurrencyDollarIcon, WrenchScrewdriverIcon, ClockIcon, ListBulletIcon, ChevronLeftIcon, ChevronRightIcon, ExclamationCircleIcon } from '@heroicons/react/24/solid';

interface TrabajosProps {
    trabajos: Trabajo[];
    clientes: Cliente[];
    onUpdateStatus: (trabajoId: string, newStatus: JobStatus) => void;
    onDataRefresh: () => void;
    tallerInfo: TallerInfo;
    searchQuery: string;
    initialTab?: JobStatus;
    initialJobId?: string; // New Prop for deep linking
    isActive?: boolean;
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
    
    const day = today.getDay() || 7; 
    if(day !== 1) today.setHours(-24 * (day - 1));
    const startOfCurrentWeek = today;

    const startOfPreviousWeek = new Date(startOfCurrentWeek);
    startOfPreviousWeek.setDate(startOfCurrentWeek.getDate() - 7);

    const startOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfPreviousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    if (jobDate >= startOfCurrentWeek) return 'Esta semana';
    if (jobDate >= startOfPreviousWeek) return 'Semana pasada';
    if (jobDate >= startOfCurrentMonth) return 'Mes pasado';
    return 'Anteriores';
};

// --- CALENDAR WIDGET COMPONENT ---

const CalendarWidget: React.FC<{
    trabajos: Trabajo[];
    onSelectDate: (date: Date | null) => void;
    selectedDate: Date | null;
}> = ({ trabajos, onSelectDate, selectedDate }) => {
    const [currentMonth, setCurrentMonth] = useState(new Date());

    const daysInMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    const firstDayOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1).getDay();

    const prevMonth = () => {
        setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
        onSelectDate(null);
    };

    const nextMonth = () => {
        setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
        onSelectDate(null);
    };

    const isSameDay = (d1: Date, d2: Date) => {
        return d1.getFullYear() === d2.getFullYear() &&
               d1.getMonth() === d2.getMonth() &&
               d1.getDate() === d2.getDate();
    };

    const renderCalendarDays = () => {
        const totalDays = daysInMonth(currentMonth);
        const startDay = firstDayOfMonth(currentMonth); // 0 = Sunday
        const days = [];

        // Empty slots for previous month
        for (let i = 0; i < startDay; i++) {
            days.push(<div key={`empty-${i}`} className="h-8 sm:h-10"></div>);
        }

        // Days of current month
        for (let d = 1; d <= totalDays; d++) {
            const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), d);
            const isToday = isSameDay(date, new Date());
            const isSelected = selectedDate && isSameDay(date, selectedDate);
            
            // Find jobs for this day - USAMOS fechaProgramada
            const dayJobs = trabajos.filter(t => t.fechaProgramada && isSameDay(new Date(t.fechaProgramada), date));
            const hasJobs = dayJobs.length > 0;

            days.push(
                <button
                    key={d}
                    onClick={() => onSelectDate(isSelected ? null : date)}
                    className={`h-8 sm:h-10 flex flex-col items-center justify-center rounded-lg relative transition-colors ${
                        isSelected 
                            ? 'bg-taller-primary text-white font-bold' 
                            : isToday 
                                ? 'bg-blue-100 text-taller-primary dark:bg-blue-900/30 dark:text-blue-300 font-bold'
                                : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-taller-dark dark:text-gray-300'
                    }`}
                >
                    <span className="text-xs sm:text-sm">{d}</span>
                    {hasJobs && !isSelected && (
                         <div className="flex gap-0.5 mt-0.5">
                             {dayJobs.slice(0, 3).map((_, idx) => (
                                 <span key={idx} className="w-1 h-1 rounded-full bg-taller-accent"></span>
                             ))}
                         </div>
                    )}
                </button>
            );
        }
        return days;
    };

    return (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-2 mb-2 border dark:border-gray-700 shadow-sm">
            <div className="flex justify-between items-center mb-2 px-2">
                <button onClick={prevMonth} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full">
                    <ChevronLeftIcon className="h-4 w-4 text-gray-600 dark:text-gray-400"/>
                </button>
                <span className="text-sm font-bold text-taller-dark dark:text-taller-light capitalize">
                    {currentMonth.toLocaleString('es-ES', { month: 'long', year: 'numeric' })}
                </span>
                <button onClick={nextMonth} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full">
                    <ChevronRightIcon className="h-4 w-4 text-gray-600 dark:text-gray-400"/>
                </button>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center mb-1">
                {['D', 'L', 'M', 'M', 'J', 'V', 'S'].map(day => (
                    <span key={day} className="text-[10px] font-bold text-gray-400">{day}</span>
                ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
                {renderCalendarDays()}
            </div>
        </div>
    );
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
    isMobileMode?: boolean; 
}> = ({ status, trabajos, clientes, onUpdateStatus, tallerInfo, onDataRefresh, searchQuery, isMobileMode }) => {
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);

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

    // Separate jobs for Programado status: Scheduled vs Unscheduled
    const { scheduledJobs, unscheduledJobs } = useMemo(() => {
        if (status !== JobStatus.Programado) return { scheduledJobs: [], unscheduledJobs: [] };
        
        const result = trabajos.reduce((acc, t) => {
            if (t.fechaProgramada) {
                acc.scheduledJobs.push(t);
            } else {
                acc.unscheduledJobs.push(t);
            }
            return acc;
        }, { scheduledJobs: [] as Trabajo[], unscheduledJobs: [] as Trabajo[] });

        // Ordenar los trabajos programados por fecha (más próximos primero)
        result.scheduledJobs.sort((a, b) => {
            return new Date(a.fechaProgramada!).getTime() - new Date(b.fechaProgramada!).getTime();
        });

        return result;
    }, [trabajos, status]);

    const filteredCalendarJobs = useMemo(() => {
        if (!selectedDate) return scheduledJobs;
        return scheduledJobs.filter(t => {
            // Must have fechaProgramada to be in calendar
            if (!t.fechaProgramada) return false;
            const tDate = new Date(t.fechaProgramada);
            return tDate.getFullYear() === selectedDate.getFullYear() &&
                   tDate.getMonth() === selectedDate.getMonth() &&
                   tDate.getDate() === selectedDate.getDate();
        });
    }, [scheduledJobs, selectedDate]);

    const renderContent = () => {
        // --- LOGIC FOR PROGRAMADO STATUS ---
        if (status === JobStatus.Programado) {
             return (
                 <div className="flex flex-col gap-3">
                     {/* 1. Calendar Widget */}
                     <div className="bg-gray-100 dark:bg-gray-800">
                        <CalendarWidget 
                            trabajos={scheduledJobs} 
                            onSelectDate={setSelectedDate} 
                            selectedDate={selectedDate}
                        />
                     </div>

                     {/* 2. Unscheduled Jobs Section (Need Attention) */}
                     {unscheduledJobs.length > 0 && (
                        <div className="bg-red-50 dark:bg-red-900/10 p-2 rounded-lg border border-red-100 dark:border-red-900/30">
                            <h4 className="text-xs font-bold text-red-700 dark:text-red-400 mb-2 flex items-center gap-1.5 uppercase tracking-wide">
                                <ExclamationCircleIcon className="h-4 w-4" /> Pendientes de Agendar ({unscheduledJobs.length})
                            </h4>
                            <div className="space-y-3">
                                {unscheduledJobs.map(trabajo => {
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
                     )}
                     
                     {/* 3. Scheduled Jobs List - Grid View (2 cols) */}
                     <div className="text-xs font-semibold text-taller-gray dark:text-gray-400 mb-1 border-b dark:border-gray-700 pb-2">
                         {selectedDate ? `Trabajos para el ${selectedDate.toLocaleDateString()} (${filteredCalendarJobs.length})` : `Próximos Trabajos (${filteredCalendarJobs.length})`}
                     </div>

                     {filteredCalendarJobs.length > 0 ? (
                        <div className="grid grid-cols-2 gap-2 pb-2">
                            {filteredCalendarJobs.map(trabajo => {
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
                                        compactMode={true} // Enable compact grid mode
                                    />
                                );
                            })}
                        </div>
                     ) : (
                        <p className="text-center text-xs text-gray-400 py-4">
                            {selectedDate ? 'Sin trabajos programados este día.' : 'Sin trabajos programados próximos.'}
                        </p>
                     )}
                 </div>
             );
        }

        // --- EMPTY STATE GENERIC ---
        if (trabajos.length === 0) {
            return (
                <div className={`flex flex-col items-center justify-center text-center opacity-60 ${isMobileMode ? 'py-12' : 'h-32'}`}>
                     {isMobileMode && <MagnifyingGlassIcon className="h-6 w-6 text-gray-400 mb-3" />}
                    <p className="text-xs text-taller-gray dark:text-gray-400">
                        {searchQuery ? "No hay coincidencias." : (isMobileMode ? `No hay trabajos en ${status}` : 'Sin trabajos')}
                    </p>
                </div>
            );
        }

        // --- FINALIZADO GROUPING ---
        if (status === JobStatus.Finalizado && groupedJobs) {
            return (
                <>
                    <JobGroup category="Esta semana" trabajos={groupedJobs['Esta semana']} defaultExpanded={true} clientes={clientes} onUpdateStatus={onUpdateStatus} tallerInfo={tallerInfo} onDataRefresh={onDataRefresh} />
                    <JobGroup category="Semana pasada" trabajos={groupedJobs['Semana pasada']} defaultExpanded={false} clientes={clientes} onUpdateStatus={onUpdateStatus} tallerInfo={tallerInfo} onDataRefresh={onDataRefresh} />
                    <JobGroup category="Mes pasado" trabajos={groupedJobs['Mes pasado']} defaultExpanded={false} clientes={clientes} onUpdateStatus={onUpdateStatus} tallerInfo={tallerInfo} onDataRefresh={onDataRefresh} />
                    <JobGroup category="Anteriores" trabajos={groupedJobs['Anteriores']} defaultExpanded={false} clientes={clientes} onUpdateStatus={onUpdateStatus} tallerInfo={tallerInfo} onDataRefresh={onDataRefresh} />
                </>
            );
        }

        // --- DEFAULT LIST (PRESUPUESTO / EN PROCESO) ---
        return (
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
        );
    };

    if (isMobileMode) {
        return (
            <div className="pt-2 px-1 flex flex-col min-h-full">
                {renderContent()}
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-gray-100 dark:bg-gray-800 rounded-xl overflow-hidden shadow-sm border dark:border-gray-700">
            <div className="flex justify-between items-center p-3 border-b dark:border-gray-700 bg-gray-200/50 dark:bg-gray-700/50">
                 <div className="flex items-center gap-2">
                    <h3 className="font-bold text-sm text-taller-dark dark:text-taller-light uppercase tracking-wide">{status}</h3>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${getStatusColor(status)}`}>
                        {trabajos.length}
                    </span>
                 </div>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
                {renderContent()}
            </div>
        </div>
    );
};


const Trabajos: React.FC<TrabajosProps> = ({ 
    trabajos, 
    clientes, 
    onUpdateStatus, 
    onDataRefresh, 
    tallerInfo, 
    searchQuery, 
    initialTab, 
    initialJobId,
    isActive = false 
}) => {
    const [isJobModalOpen, setIsJobModalOpen] = useState(false);
    const [initialClientIdForModal, setInitialClientIdForModal] = useState<string | undefined>(undefined);
    const [activeMobileTab, setActiveMobileTab] = useState<JobStatus>(initialTab || JobStatus.Presupuesto);
    const [trabajoToEdit, setTrabajoToEdit] = useState<Trabajo | undefined>(undefined);
    
    // Animation States
    const [showFloatingMenu, setShowFloatingMenu] = useState(false);
    const [animateFloatingMenu, setAnimateFloatingMenu] = useState(false);
    
    // Directional Animation Logic
    const prevTabRef = useRef<number>(statusOrder.indexOf(initialTab || JobStatus.Presupuesto));
    const [slideDirection, setSlideDirection] = useState<'left' | 'right'>('right');

    useEffect(() => {
        // Reset tab whenever the view becomes active (navigation)
        if (isActive) {
            setActiveMobileTab(initialTab || JobStatus.Presupuesto);
            prevTabRef.current = statusOrder.indexOf(initialTab || JobStatus.Presupuesto);
        }
        
        if (initialTab) {
            // On desktop, scroll the corresponding column into view
            const columnElement = document.getElementById(`status-column-${initialTab}`);
            if (columnElement) {
                columnElement.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
            }
        }
    }, [isActive, initialTab]);

    // Handle Deep Linking to a Job (from Dashboard)
    useEffect(() => {
        if (isActive && initialJobId) {
            const job = trabajos.find(t => t.id === initialJobId);
            if (job) {
                setTrabajoToEdit(job);
                setIsJobModalOpen(true);
            }
        }
    }, [isActive, initialJobId, trabajos]);
    
    // Handle Directional State on Tab Change
    useEffect(() => {
        const currentIdx = statusOrder.indexOf(activeMobileTab);
        const prevIdx = prevTabRef.current;
        
        if (currentIdx !== prevIdx) {
            setSlideDirection(currentIdx > prevIdx ? 'right' : 'left');
            prevTabRef.current = currentIdx;
        }
    }, [activeMobileTab]);

    useEffect(() => {
        const pendingClientId = localStorage.getItem('pending_job_client_id');
        if (pendingClientId) {
            setInitialClientIdForModal(pendingClientId);
            setIsJobModalOpen(true);
            localStorage.removeItem('pending_job_client_id');
        }
    }, []);

    // Animation Logic (Floating Menu)
    useEffect(() => {
        const shouldShow = isActive && !isJobModalOpen;
        let timer: ReturnType<typeof setTimeout>;

        if (shouldShow) {
            setShowFloatingMenu(true);
            timer = setTimeout(() => {
                setAnimateFloatingMenu(true);
            }, 50);
        } else {
            setAnimateFloatingMenu(false);
            timer = setTimeout(() => {
                setShowFloatingMenu(false);
            }, 200); 
        }

        return () => clearTimeout(timer);
    }, [isActive, isJobModalOpen]);

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
        <div className="flex flex-col h-full w-full relative overflow-hidden">
            <style>{`
                .custom-scrollbar::-webkit-scrollbar { width: 5px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background-color: rgba(156, 163, 175, 0.4); border-radius: 20px; }
                .dark .custom-scrollbar::-webkit-scrollbar-thumb { background-color: rgba(75, 85, 99, 0.4); }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background-color: rgba(156, 163, 175, 0.7); }
            `}</style>
            
            {/* Header Section */}
            <div className="flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-center mb-4 lg:mb-4 flex-shrink-0 px-4 pt-4 md:px-0 md:pt-0">
                <h2 className="text-2xl font-bold text-taller-dark dark:text-taller-light">Flujo de Trabajos</h2>
                <div className="hidden lg:flex">
                    <button
                        onClick={() => {
                            setInitialClientIdForModal(undefined);
                            setTrabajoToEdit(undefined);
                            setIsJobModalOpen(true);
                        }}
                        className="flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-taller-primary rounded-lg shadow-md hover:bg-taller-secondary transition-colors"
                    >
                       <PlusIcon className="h-5 w-5"/>
                        Nuevo Presupuesto
                    </button>
                </div>
            </div>

            {/* Scrollable Content Area */}
            <div className="flex-1 overflow-y-auto overflow-x-hidden relative w-full" id="trabajos-scroll-container">
                {searchQuery && !hasResults ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-taller-gray dark:text-gray-400 min-h-[50vh]">
                        <MagnifyingGlassIcon className="h-16 w-16 mb-4 opacity-50"/>
                        <p className="text-lg font-medium">No se encontraron resultados para "{searchQuery}"</p>
                        <p className="text-sm mt-2 opacity-75">Intenta buscar por cliente, vehículo o descripción.</p>
                    </div>
                ) : (
                    <>
                        {/* Mobile View: Render only ACTIVE tab with Animation */}
                        <div 
                            key={activeMobileTab}
                            className={`lg:hidden w-full pb-36 transform-gpu will-change-transform ${
                                slideDirection === 'right' ? 'animate-slide-in-right' : 'animate-slide-in-left'
                            }`}
                        >
                            <StatusColumn
                                status={activeMobileTab}
                                trabajos={trabajosByStatus[activeMobileTab] || []}
                                clientes={clientes}
                                onUpdateStatus={onUpdateStatus}
                                tallerInfo={tallerInfo}
                                onDataRefresh={onDataRefresh}
                                searchQuery={searchQuery}
                                isMobileMode={true}
                            />
                        </div>

                        {/* Desktop View: Kanban Board */}
                        <div className="hidden lg:flex flex-row gap-4 h-full overflow-x-auto pb-2 items-stretch">
                            {statusOrder.map(status => {
                                const jobs = trabajosByStatus[status] || [];
                                return (
                                    <div key={status} id={`status-column-${status}`} className="flex-1 min-w-[300px] h-full flex flex-col">
                                        <StatusColumn
                                            status={status}
                                            trabajos={jobs}
                                            clientes={clientes}
                                            onUpdateStatus={onUpdateStatus}
                                            tallerInfo={tallerInfo}
                                            onDataRefresh={onDataRefresh}
                                            searchQuery={searchQuery}
                                            isMobileMode={false}
                                        />
                                    </div>
                                );
                            })}
                        </div>
                    </>
                )}
            </div>

            {/* Floating Buttons (Mobile Only) - Using Portal to ensure fixed positioning works correctly on all devices */}
            {showFloatingMenu && createPortal(
                <div 
                    className={`lg:hidden fixed left-0 w-full flex flex-col items-center pointer-events-none z-[100] transition-all ease-out transform ${animateFloatingMenu ? 'duration-500 opacity-100 translate-y-0' : 'duration-200 opacity-0 translate-y-12'}`}
                    style={{
                        bottom: 'calc(5.5rem + 5px)',
                    }}
                >
                    {activeMobileTab === JobStatus.Presupuesto && (
                        <div className="w-full flex justify-center mb-4 pointer-events-auto px-4">
                            <button
                                onClick={() => {
                                    setInitialClientIdForModal(undefined);
                                    setTrabajoToEdit(undefined);
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
                                const isActiveTab = activeMobileTab === status;
                                const count = trabajosByStatus[status]?.length || 0;
                                
                                return (
                                    <button
                                        key={status}
                                        onClick={() => setActiveMobileTab(status)}
                                        className={`relative flex flex-col items-center justify-center transition-colors duration-200 group ${
                                            isActiveTab 
                                            ? 'bg-blue-50 dark:bg-gray-700/50' 
                                            : 'hover:bg-gray-50 dark:hover:bg-gray-700/30'
                                        }`}
                                    >
                                        <Icon className={`h-5 w-5 mb-0.5 transition-colors ${
                                            isActiveTab 
                                            ? 'text-taller-primary dark:text-white' 
                                            : 'text-gray-400 dark:text-gray-500 group-hover:text-gray-600 dark:group-hover:text-gray-400'
                                        }`} />
                                        <span className={`text-[9px] font-bold leading-none tracking-tight transition-colors ${
                                            isActiveTab 
                                            ? 'text-taller-primary dark:text-white' 
                                            : 'text-gray-400 dark:text-gray-500'
                                        }`}>
                                            {getMobileTabLabel(status)}
                                        </span>
                                        
                                        {count > 0 && (
                                            <span className={`absolute top-1 right-2 flex h-3.5 w-3.5 items-center justify-center rounded-full text-[8px] font-bold shadow-sm ${
                                                isActiveTab 
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
                </div>,
                document.body
            )}

            {isJobModalOpen && (
                <CrearTrabajoModal
                    clientes={clientes}
                    onClose={() => {
                        setIsJobModalOpen(false);
                        setTrabajoToEdit(undefined); // Clear edit state on close
                    }}
                    onSuccess={() => {
                        setIsJobModalOpen(false);
                        setTrabajoToEdit(undefined);
                        onDataRefresh();
                    }}
                    onDataRefresh={onDataRefresh}
                    initialClientId={initialClientIdForModal}
                    trabajoToEdit={trabajoToEdit}
                />
            )}
        </div>
    );
};

export default Trabajos;
