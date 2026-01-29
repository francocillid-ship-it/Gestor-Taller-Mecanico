
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
    initialJobId?: string; 
    isActive?: boolean;
}

const statusOrder = [JobStatus.Presupuesto, JobStatus.Programado, JobStatus.EnProceso, JobStatus.Finalizado];

type TimeCategory = 'Esta semana' | 'Semana pasada' | 'Mes pasado' | 'Anteriores';

const getDateCategory = (dateString: string): TimeCategory => {
    const date = new Date(dateString);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const jobDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const day = today.getDay() || 7; 
    const startOfCurrentWeek = new Date(today);
    startOfCurrentWeek.setDate(today.getDate() - (day - 1));
    const startOfPreviousWeek = new Date(startOfCurrentWeek);
    startOfPreviousWeek.setDate(startOfCurrentWeek.getDate() - 7);
    const startOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfPreviousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    if (jobDate >= startOfCurrentWeek) return 'Esta semana';
    if (jobDate >= startOfPreviousWeek) return 'Semana pasada';
    if (jobDate >= startOfCurrentMonth) return 'Semana pasada';
    if (jobDate >= startOfPreviousMonth) return 'Mes pasado';
    return 'Anteriores';
};

const CalendarWidget: React.FC<{
    trabajos: Trabajo[];
    onSelectDate: (date: Date | null) => void;
    selectedDate: Date | null;
}> = ({ trabajos, onSelectDate, selectedDate }) => {
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const daysInMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    const firstDayOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1).getDay();
    const prevMonth = () => { setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1)); onSelectDate(null); };
    const nextMonth = () => { setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1)); onSelectDate(null); };
    const isSameDay = (d1: Date, d2: Date) => d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate();

    const renderCalendarDays = () => {
        const totalDays = daysInMonth(currentMonth);
        const startDay = firstDayOfMonth(currentMonth);
        const days = [];
        for (let i = 0; i < startDay; i++) days.push(<div key={`empty-${i}`} className="h-8 sm:h-10"></div>);
        for (let d = 1; d <= totalDays; d++) {
            const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), d);
            const isToday = isSameDay(date, new Date());
            const isSelected = selectedDate && isSameDay(date, selectedDate);
            const dayJobs = trabajos.filter(t => t.fechaProgramada && isSameDay(new Date(t.fechaProgramada), date));
            const hasJobs = dayJobs.length > 0;
            days.push(
                <button key={d} onClick={() => onSelectDate(isSelected ? null : date)} type="button" className={`h-8 sm:h-10 flex flex-col items-center justify-center rounded-lg relative transition-colors ${isSelected ? 'bg-taller-primary text-white font-bold' : isToday ? 'bg-blue-100 text-taller-primary dark:bg-blue-900/30 dark:text-blue-300 font-bold' : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-taller-dark dark:text-gray-300'}`}>
                    <span className="text-xs sm:text-sm">{d}</span>
                    {hasJobs && !isSelected && <div className="flex gap-0.5 mt-0.5">{dayJobs.slice(0, 3).map((_, idx) => <span key={idx} className="w-1 h-1 rounded-full bg-taller-accent"></span>)}</div>}
                </button>
            );
        }
        return days;
    };

    return (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-2 mb-2 border dark:border-gray-700 shadow-sm">
            <div className="flex justify-between items-center mb-2 px-2">
                <button onClick={prevMonth} type="button" className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full text-gray-600 dark:text-gray-400"><ChevronLeftIcon className="h-4 w-4"/></button>
                <span className="text-sm font-bold text-taller-dark dark:text-taller-light capitalize">{currentMonth.toLocaleString('es-ES', { month: 'long', year: 'numeric' })}</span>
                <button onClick={nextMonth} type="button" className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full text-gray-600 dark:text-gray-400"><ChevronRightIcon className="h-4 w-4"/></button>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center mb-1">{['D', 'L', 'M', 'M', 'J', 'V', 'S'].map(day => <span key={day} className="text-[10px] font-bold text-gray-400">{day}</span>)}</div>
            <div className="grid grid-cols-7 gap-1">{renderCalendarDays()}</div>
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
    highlightedJobId?: string;
}> = ({ category, trabajos, clientes, onUpdateStatus, tallerInfo, onDataRefresh, defaultExpanded, highlightedJobId }) => {
    const containsHighlighted = highlightedJobId ? trabajos.some(t => t.id === highlightedJobId) : false;
    const [isExpanded, setIsExpanded] = useState(defaultExpanded || containsHighlighted);
    useEffect(() => { if (containsHighlighted) setIsExpanded(true); }, [containsHighlighted]);
    if (trabajos.length === 0) return null;

    return (
        <div className="mb-3 last:mb-0">
            <button onClick={() => setIsExpanded(!isExpanded)} type="button" className="w-full flex justify-between items-center text-xs font-semibold text-taller-gray dark:text-gray-400 uppercase tracking-wider mb-2 hover:text-taller-primary transition-colors bg-white dark:bg-gray-700/50 p-2 rounded shadow-sm">
                <div className="flex items-center gap-2"><CalendarIcon className="h-3 w-3" />{category}</div>
                <div className="flex items-center gap-2"><span className="bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300 px-1.5 py-0.5 rounded text-[10px]">{trabajos.length}</span><ChevronDownIcon className={`h-3 w-3 transform transition-transform ${isExpanded ? 'rotate-180' : ''}`} /></div>
            </button>
            <div className={`grid transition-[grid-template-rows] duration-300 ease-out ${isExpanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
                <div className="overflow-hidden"><div className="space-y-3 pb-1">{trabajos.map(t => <JobCard key={t.id} trabajo={t} cliente={clientes.find(c => c.id === t.clienteId)} vehiculo={clientes.find(c => c.id === t.clienteId)?.vehiculos.find(v => v.id === t.vehiculoId)} onUpdateStatus={onUpdateStatus} tallerInfo={tallerInfo} clientes={clientes} onDataRefresh={onDataRefresh} isHighlighted={t.id === highlightedJobId} />)}</div></div>
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
    highlightedJobId?: string;
}> = ({ status, trabajos, clientes, onUpdateStatus, tallerInfo, onDataRefresh, searchQuery, isMobileMode, highlightedJobId }) => {
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
        const groups: Record<TimeCategory, Trabajo[]> = { 'Esta semana': [], 'Semana pasada': [], 'Mes pasado': [], 'Anteriores': [] };
        trabajos.forEach(t => groups[getDateCategory(t.fechaSalita || t.fechaEntrada)].push(t));
        return groups;
    }, [trabajos, status]);

    const { scheduledJobs, unscheduledJobs } = useMemo(() => {
        if (status !== JobStatus.Programado) return { scheduledJobs: [], unscheduledJobs: [] };
        const result = trabajos.reduce((acc, t) => { if (t.fechaProgramada) acc.scheduledJobs.push(t); else acc.unscheduledJobs.push(t); return acc; }, { scheduledJobs: [] as Trabajo[], unscheduledJobs: [] as Trabajo[] });
        result.scheduledJobs.sort((a, b) => new Date(a.fechaProgramada!).getTime() - new Date(b.fechaProgramada!).getTime());
        return result;
    }, [trabajos, status]);

    const filteredCalendarJobs = useMemo(() => {
        if (searchQuery || highlightedJobId) return scheduledJobs;
        if (!selectedDate) return scheduledJobs;
        return scheduledJobs.filter(t => t.fechaProgramada && new Date(t.fechaProgramada).toLocaleDateString() === selectedDate.toLocaleDateString());
    }, [scheduledJobs, selectedDate, searchQuery, highlightedJobId]);

    const renderContent = () => {
        if (status === JobStatus.Programado) {
             return (
                 <div className="flex flex-col gap-3">
                     <CalendarWidget trabajos={scheduledJobs} onSelectDate={setSelectedDate} selectedDate={selectedDate}/>
                     {unscheduledJobs.length > 0 && (
                        <div className="bg-red-50 dark:bg-red-900/10 p-2 rounded-lg border border-red-100 dark:border-red-900/30">
                            <h4 className="text-xs font-bold text-red-700 dark:text-red-400 mb-2 flex items-center gap-1.5 uppercase tracking-wide"><ExclamationCircleIcon className="h-4 w-4" /> Pendientes de Agendar ({unscheduledJobs.length})</h4>
                            <div className="space-y-3">{unscheduledJobs.map(t => <JobCard key={t.id} trabajo={t} cliente={clientes.find(c => c.id === t.clienteId)} vehiculo={clientes.find(c => c.id === t.clienteId)?.vehiculos.find(v => v.id === t.vehiculoId)} onUpdateStatus={onUpdateStatus} tallerInfo={tallerInfo} clientes={clientes} onDataRefresh={onDataRefresh} isHighlighted={t.id === highlightedJobId} />)}</div>
                        </div>
                     )}
                     <div className="text-xs font-semibold text-taller-gray dark:text-gray-400 mb-1 border-b dark:border-gray-700 pb-2">{selectedDate ? `Trabajos para el ${selectedDate.toLocaleDateString()} (${filteredCalendarJobs.length})` : `Próximos Trabajos (${filteredCalendarJobs.length})`}</div>
                     {filteredCalendarJobs.length > 0 ? (
                        <div className={`grid ${highlightedJobId || isMobileMode ? 'grid-cols-1' : 'grid-cols-2'} gap-2 pb-2`}>
                            {filteredCalendarJobs.map(t => <JobCard key={t.id} trabajo={t} cliente={clientes.find(c => c.id === t.clienteId)} vehiculo={clientes.find(c => c.id === t.clienteId)?.vehiculos.find(v => v.id === t.vehiculoId)} onUpdateStatus={onUpdateStatus} tallerInfo={tallerInfo} clientes={clientes} onDataRefresh={onDataRefresh} compactMode={!highlightedJobId && !isMobileMode} isHighlighted={t.id === highlightedJobId} />)}
                        </div>
                     ) : <p className="text-center text-xs text-gray-400 py-4">{selectedDate ? 'Sin trabajos programados este día.' : 'Sin trabajos programados próximos.'}</p>}
                 </div>
             );
        }
        if (trabajos.length === 0) return <div className={`flex flex-col items-center justify-center text-center opacity-60 ${isMobileMode ? 'py-12' : 'h-32'}`}>{isMobileMode && <MagnifyingGlassIcon className="h-6 w-6 text-gray-400 mb-3" />}<p className="text-xs text-taller-gray dark:text-gray-400">{searchQuery ? "No hay coincidencias." : `No hay trabajos en ${status}`}</p></div>;
        if (status === JobStatus.Finalizado && groupedJobs) {
            return Object.entries(groupedJobs).map(([cat, jobs]) => <JobGroup key={cat} category={cat as TimeCategory} trabajos={jobs} defaultExpanded={cat === 'Esta semana'} clientes={clientes} onUpdateStatus={onUpdateStatus} tallerInfo={tallerInfo} onDataRefresh={onDataRefresh} highlightedJobId={highlightedJobId} />);
        }
        return <div className="space-y-3">{trabajos.map(t => <JobCard key={t.id} trabajo={t} cliente={clientes.find(c => c.id === t.clienteId)} vehiculo={clientes.find(c => c.id === t.clienteId)?.vehiculos.find(v => v.id === t.vehiculoId)} onUpdateStatus={onUpdateStatus} tallerInfo={tallerInfo} clientes={clientes} onDataRefresh={onDataRefresh} isHighlighted={t.id === highlightedJobId} />)}</div>;
    };

    if (isMobileMode) return <div className="p-4 overflow-y-auto h-full scroll-smooth">{renderContent()}</div>;

    return (
        <div className="flex flex-col h-full bg-gray-100 dark:bg-gray-800 rounded-xl overflow-hidden shadow-sm border dark:border-gray-700">
            <div className="flex justify-between items-center p-3 border-b dark:border-gray-700 bg-gray-200/50 dark:bg-gray-700/50">
                 <div className="flex items-center gap-2"><h3 className="font-bold text-sm text-taller-dark dark:text-taller-light uppercase tracking-wide">{status}</h3><span className={`text-xs font-bold px-2 py-0.5 rounded-full ${getStatusColor(status)}`}>{trabajos.length}</span></div>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar p-2">{renderContent()}</div>
        </div>
    );
};

const Trabajos: React.FC<TrabajosProps> = ({ trabajos, clientes, onUpdateStatus, onDataRefresh, tallerInfo, searchQuery, initialTab, initialJobId, isActive }) => {
    const [activeTab, setActiveTab] = useState<JobStatus>(initialTab || JobStatus.EnProceso);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    useEffect(() => { if (initialTab) setActiveTab(initialTab); }, [initialTab]);
    useEffect(() => { if (initialJobId && isActive) { const job = trabajos.find(t => t.id === initialJobId); if (job) setActiveTab(job.status); } }, [initialJobId, trabajos, isActive]);

    const filteredTrabajos = useMemo(() => {
        if (!searchQuery) return trabajos;
        const q = searchQuery.toLowerCase();
        return trabajos.filter(t => {
            const c = clientes.find(cl => cl.id === t.clienteId);
            const v = c?.vehiculos.find(ve => ve.id === t.vehiculoId);
            return `${c?.nombre} ${c?.apellido}`.toLowerCase().includes(q) || `${v?.marca} ${v?.modelo} ${v?.matricula}`.toLowerCase().includes(q) || t.descripcion.toLowerCase().includes(q) || (t.quickBudgetData && `${t.quickBudgetData.nombre} ${t.quickBudgetData.apellido} ${t.quickBudgetData.marca} ${t.quickBudgetData.modelo} ${t.quickBudgetData.matricula}`.toLowerCase().includes(q));
        });
    }, [trabajos, searchQuery, clientes]);

    return (
        <div className="h-full flex flex-col min-h-0 bg-taller-light dark:bg-taller-dark">
            {/* Header con botón de nuevo trabajo */}
            <div className="p-4 flex justify-between items-center bg-white dark:bg-gray-800 border-b dark:border-gray-700 flex-shrink-0">
                <h2 className="text-xl font-bold text-taller-dark dark:text-taller-light hidden md:block">Gestión de Trabajos</h2>
                <button 
                    onClick={() => setIsCreateModalOpen(true)}
                    className="flex-1 md:flex-none flex items-center justify-center gap-2 py-2.5 px-4 bg-taller-primary text-white font-bold rounded-xl shadow-lg shadow-taller-primary/20 active:scale-95 transition-all"
                >
                    <PlusIcon className="h-5 w-5" />
                    <span>Nuevo Presupuesto</span>
                </button>
            </div>

            {/* Tabs para móvil */}
            <div className="md:hidden flex overflow-x-auto bg-white dark:bg-gray-800 border-b dark:border-gray-700 sticky top-0 z-10 no-scrollbar">
                {statusOrder.map((status) => (
                    <button key={status} onClick={() => setActiveTab(status)} type="button" className={`flex-1 min-w-[100px] py-3 text-[10px] font-bold uppercase tracking-wider border-b-2 transition-colors ${activeTab === status ? 'border-taller-primary text-taller-primary bg-blue-50/50 dark:bg-blue-900/20' : 'border-transparent text-taller-gray dark:text-gray-400'}`}>
                        {status}
                    </button>
                ))}
            </div>

            {/* Area de contenido */}
            <div id="trabajos-scroll-container" ref={scrollContainerRef} className="flex-1 md:overflow-x-auto h-full scroll-smooth custom-scrollbar overflow-hidden">
                <div className="flex h-full min-w-full md:p-6 md:gap-4 flex-col md:flex-row">
                    {statusOrder.map((status) => (
                        <div key={status} className={`flex-shrink-0 md:w-[350px] lg:w-[380px] h-full ${activeTab === status ? 'block w-full' : 'hidden md:block'}`}>
                            <StatusColumn
                                status={status}
                                trabajos={filteredTrabajos.filter(t => t.status === status)}
                                clientes={clientes}
                                onUpdateStatus={onUpdateStatus}
                                tallerInfo={tallerInfo}
                                onDataRefresh={onDataRefresh}
                                searchQuery={searchQuery}
                                isMobileMode={true} 
                                highlightedJobId={initialJobId}
                            />
                        </div>
                    ))}
                </div>
            </div>

            {isCreateModalOpen && (
                <CrearTrabajoModal
                    onClose={() => setIsCreateModalOpen(false)}
                    onSuccess={() => { setIsCreateModalOpen(false); onDataRefresh(); }}
                    onDataRefresh={onDataRefresh}
                    clientes={clientes}
                />
            )}
            
            <style>{`
                .no-scrollbar::-webkit-scrollbar { display: none; }
                .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
                .custom-scrollbar::-webkit-scrollbar { height: 8px; width: 8px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
                .dark .custom-scrollbar::-webkit-scrollbar-thumb { background: #475569; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
            `}</style>
        </div>
    );
};

export default Trabajos;
