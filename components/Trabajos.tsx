
import React, { useMemo, useState, useEffect, useRef, useCallback, useLayoutEffect, lazy, Suspense } from 'react';
import type { Trabajo, Cliente, TallerInfo } from '../types';
import { JobStatus } from '../types';
import JobCard from './JobCard';
import { PlusIcon, MagnifyingGlassIcon, ExclamationCircleIcon, ChevronLeftIcon, ChevronRightIcon, CalendarIcon, ChevronDownIcon, ClockIcon } from '@heroicons/react/24/solid';

const CrearTrabajoModal = lazy(() => import('./CrearTrabajoModal'));

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

const getWeekOfMonth = (date: Date) => {
    const firstDay = new Date(date.getFullYear(), date.getMonth(), 1).getDay();
    return Math.ceil((date.getDate() + firstDay) / 7);
};

const getMonthYearKey = (date: Date) => {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
};

const getMonthName = (monthIndex: number) => {
    return new Intl.DateTimeFormat('es-ES', { month: 'long' }).format(new Date(2000, monthIndex));
};

const CalendarWidget: React.FC<{ trabajos: Trabajo[]; onSelectDate: (date: Date | null) => void; selectedDate: Date | null; }> = ({ trabajos, onSelectDate, selectedDate }) => {
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const daysInMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    const firstDayOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1).getDay();
    const isSameDay = (d1: Date, d2: Date) => d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate();

    const renderDays = () => {
        const totalDays = daysInMonth(currentMonth);
        const startDay = firstDayOfMonth(currentMonth);
        const days = [];
        for (let i = 0; i < startDay; i++) days.push(<div key={`empty-${i}`} className="h-10"></div>);
        for (let d = 1; d <= totalDays; d++) {
            const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), d);
            const isToday = isSameDay(date, new Date());
            const isSelected = selectedDate && isSameDay(date, selectedDate);
            const hasJobs = trabajos.some(t => t.fechaProgramada && isSameDay(new Date(t.fechaProgramada), date));
            days.push(
                <button key={d} type="button" onClick={() => onSelectDate(isSelected ? null : date)} className={`h-10 flex flex-col items-center justify-center rounded-lg transition-all ${isSelected ? 'bg-taller-primary text-white font-bold' : isToday ? 'bg-blue-100 text-taller-primary dark:bg-blue-900/40 font-bold' : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-taller-dark dark:text-taller-light'}`}>
                    <span className="text-xs">{d}</span>
                    {hasJobs && !isSelected && <div className="w-1 h-1 bg-taller-accent rounded-full mt-0.5"></div>}
                </button>
            );
        }
        return days;
    };

    return (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-3 border dark:border-gray-700 shadow-sm mb-4 flex-shrink-0">
            <div className="flex justify-between items-center mb-4 px-1">
                <button type="button" onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))}><ChevronLeftIcon className="h-4 w-4" /></button>
                <span className="text-sm font-bold capitalize">{currentMonth.toLocaleString('es-ES', { month: 'long', year: 'numeric' })}</span>
                <button type="button" onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))}><ChevronRightIcon className="h-4 w-4" /></button>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center mb-2">{['D', 'L', 'M', 'M', 'J', 'V', 'S'].map(d => <span key={d} className="text-[10px] font-bold text-gray-400">{d}</span>)}</div>
            <div className="grid grid-cols-7 gap-1">{renderDays()}</div>
        </div>
    );
};

const EmptyState: React.FC = () => (
    <div className="flex-1 flex flex-col items-center justify-center py-12 opacity-30 select-none">
        <MagnifyingGlassIcon className="h-14 w-14 text-gray-400 mb-4" />
        <p className="text-sm font-black uppercase tracking-widest text-taller-gray dark:text-gray-400 text-center px-8">Nada para mostrar</p>
    </div>
);

const MonthlyGroup: React.FC<{
    monthKey: string;
    trabajos: Trabajo[];
    clientes: Cliente[];
    onUpdateStatus: (id: string, s: JobStatus) => void;
    onDataRefresh: () => void;
    tallerInfo: TallerInfo;
    initialJobId?: string;
}> = ({ monthKey, trabajos, clientes, onUpdateStatus, onDataRefresh, tallerInfo, initialJobId }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [year, month] = monthKey.split('-').map(Number);
    const monthName = getMonthName(month - 1);

    const groupedByWeek = useMemo(() => {
        const weeks: Record<number, Trabajo[]> = {};
        trabajos.forEach(t => {
            const date = new Date(t.fechaSalida || t.fechaEntrada);
            const week = getWeekOfMonth(date);
            if (!weeks[week]) weeks[week] = [];
            weeks[week].push(t);
        });
        return Object.entries(weeks).sort((a, b) => Number(b[0]) - Number(a[0]));
    }, [trabajos]);

    return (
        <div className="mb-3 border dark:border-gray-700 rounded-xl overflow-hidden bg-white dark:bg-gray-800 shadow-sm transition-all duration-300">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors z-10 relative"
            >
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-50 dark:bg-blue-900/30 rounded-lg text-taller-primary dark:text-blue-400">
                        <CalendarIcon className="h-5 w-5" />
                    </div>
                    <div className="text-left">
                        <h4 className="font-bold text-sm text-taller-dark dark:text-taller-light capitalize">{monthName} {year}</h4>
                        <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest">{trabajos.length} Trabajos</p>
                    </div>
                </div>
                <ChevronDownIcon className={`h-5 w-5 text-gray-400 transition-transform duration-500 ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            <div className={`grid transition-[grid-template-rows] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
                <div className="overflow-hidden bg-gray-50/50 dark:bg-gray-900/20">
                    <div className="p-4 space-y-6">
                        {groupedByWeek.map(([weekNum, weekJobs]) => (
                            <div key={weekNum} className="space-y-3">
                                <div className="flex items-center gap-2 mb-2 px-1">
                                    <div className="h-px flex-1 bg-gray-200 dark:bg-gray-700"></div>
                                    <span className="text-[9px] font-black uppercase text-gray-400 tracking-[0.2em]">Semana {weekNum}</span>
                                    <div className="h-px flex-1 bg-gray-200 dark:bg-gray-700"></div>
                                </div>
                                <div className="space-y-4">
                                    {weekJobs.map(t => (
                                        <JobCard key={t.id} trabajo={t} cliente={clientes.find(c => c.id === t.clienteId)} vehiculo={clientes.find(c => c.id === t.clienteId)?.vehiculos.find(v => v.id === t.vehiculoId)} onUpdateStatus={onUpdateStatus} tallerInfo={tallerInfo} clientes={clientes} onDataRefresh={onDataRefresh} isHighlighted={t.id === initialJobId} />
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

const Trabajos: React.FC<TrabajosProps> = ({ trabajos, clientes, onUpdateStatus, onDataRefresh, tallerInfo, searchQuery, initialTab, initialJobId, isActive }) => {
    const [activeTab, setActiveTab] = useState<JobStatus>(initialTab || JobStatus.Presupuesto);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [headerVisible, setHeaderVisible] = useState(true);
    const [headerHeight, setHeaderHeight] = useState(0);
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);

    const lastScrollTops = useRef<{ [key: string]: number }>({});
    const touchStart = useRef({ x: 0, y: 0 });
    const tabLabelsRef = useRef<{ [key: string]: HTMLButtonElement | null }>({});
    const headerRef = useRef<HTMLDivElement>(null);

    useLayoutEffect(() => {
        const updateHeight = () => {
            if (headerRef.current) {
                setHeaderHeight(headerRef.current.offsetHeight);
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
        if (initialTab) {
            setActiveTab(initialTab);
        }
    }, [initialTab]);

    useEffect(() => {
        if (isActive) {
            const btn = tabLabelsRef.current[activeTab];
            if (btn) {
                const parent = btn.parentElement;
                if (parent) {
                    const scrollTarget = btn.offsetLeft - (parent.offsetWidth / 2) + (btn.offsetWidth / 2);
                    parent.scrollTo({ left: scrollTarget, behavior: 'smooth' });
                }
            }
            setHeaderVisible(true);
        }
    }, [activeTab, isActive]);

    const handleVerticalScroll = useCallback((e: React.UIEvent<HTMLDivElement>, status: JobStatus) => {
        if (status !== activeTab) return;
        const el = e.currentTarget;
        const st = el.scrollTop;
        const lastSt = lastScrollTops.current[status] || 0;
        const diff = st - lastSt;
        if (st <= 5) setHeaderVisible(true);
        else if (Math.abs(diff) > 3) setHeaderVisible(diff < 0);
        lastScrollTops.current[status] = st;
    }, [activeTab]);

    const handleTouchStart = (e: React.TouchEvent) => touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    const handleTouchEnd = (e: React.TouchEvent) => {
        const deltaX = e.changedTouches[0].clientX - touchStart.current.x;
        const deltaY = e.changedTouches[0].clientY - touchStart.current.y;
        if (Math.abs(deltaX) > Math.abs(deltaY) * 2 && Math.abs(deltaX) > 60) {
            const currentIndex = statusOrder.indexOf(activeTab);
            if (deltaX > 0 && currentIndex > 0) setActiveTab(statusOrder[currentIndex - 1]);
            else if (deltaX < 0 && currentIndex < statusOrder.length - 1) setActiveTab(statusOrder[currentIndex + 1]);
        }
    };

    const filteredTrabajos = useMemo(() => {
        if (!searchQuery) return trabajos;
        const q = searchQuery.toLowerCase();
        return trabajos.filter(t => {
            const c = clientes.find(cl => cl.id === t.clienteId);
            const v = c?.vehiculos.find(ve => ve.id === t.vehiculoId);
            const qb = t.quickBudgetData;

            const descMatch = (t.descripcion?.toLowerCase() || '').includes(q);
            const clientMatch = `${c?.nombre || ''} ${c?.apellido || ''}`.toLowerCase().includes(q);
            const vehicleMatch = `${v?.marca || ''} ${v?.modelo || ''} ${v?.matricula || ''}`.toLowerCase().includes(q);
            const quickMatch = qb ? `${qb.nombre} ${qb.marca} ${qb.modelo}`.toLowerCase().includes(q) : false;

            return descMatch || clientMatch || vehicleMatch || quickMatch;
        });
    }, [trabajos, searchQuery, clientes]);

    const renderTabContent = (status: JobStatus) => {
        const tabJobs = [...filteredTrabajos]
            .filter(t => t.status === status)
            .sort((a, b) => {
                const dateA = new Date(a.fechaSalida || a.fechaEntrada).getTime();
                const dateB = new Date(b.fechaSalida || b.fechaEntrada).getTime();
                return dateB - dateA;
            });

        if (status === JobStatus.Programado) {
            const scheduled = tabJobs.filter(t => t.fechaProgramada);
            const pending = tabJobs.filter(t => !t.fechaProgramada);
            const calendarFiltered = selectedDate ? scheduled.filter(t => new Date(t.fechaProgramada!).toLocaleDateString() === selectedDate.toLocaleDateString()) : scheduled;

            return (
                <div className="flex flex-col min-h-full">
                    <CalendarWidget trabajos={scheduled} selectedDate={selectedDate} onSelectDate={setSelectedDate} />
                    {pending.length > 0 && (
                        <div className="bg-red-50 dark:bg-red-900/10 p-4 rounded-xl border border-red-100 dark:border-red-900/30 mb-6 flex-shrink-0">
                            <h4 className="text-[10px] font-black text-red-600 dark:text-red-400 uppercase tracking-widest mb-4 flex items-center gap-2"><ExclamationCircleIcon className="h-4 w-4" /> Pendientes de Turno ({pending.length})</h4>
                            <div className="space-y-4">
                                {pending.map(t => (
                                    <JobCard key={t.id} trabajo={t} cliente={clientes.find(c => c.id === t.clienteId)} vehiculo={clientes.find(c => c.id === t.clienteId)?.vehiculos.find(v => v.id === t.vehiculoId)} onUpdateStatus={onUpdateStatus} tallerInfo={tallerInfo} clientes={clientes} onDataRefresh={onDataRefresh} isHighlighted={t.id === initialJobId} />
                                ))}
                            </div>
                        </div>
                    )}
                    <div className="flex-1 flex flex-col">
                        {calendarFiltered.length > 0 ? (
                            <div className="space-y-4 pb-8">
                                {calendarFiltered.map(t => (
                                    <JobCard key={t.id} trabajo={t} cliente={clientes.find(c => c.id === t.clienteId)} vehiculo={clientes.find(c => c.id === t.clienteId)?.vehiculos.find(v => v.id === t.vehiculoId)} onUpdateStatus={onUpdateStatus} tallerInfo={tallerInfo} clientes={clientes} onDataRefresh={onDataRefresh} isHighlighted={t.id === initialJobId} />
                                ))}
                            </div>
                        ) : <EmptyState />}
                    </div>
                </div>
            );
        }

        if (status === JobStatus.Finalizado && tabJobs.length > 0) {
            const recentJobs = tabJobs.slice(0, 5);
            const archivedJobs = tabJobs.slice(5);

            const groupedByMonth = archivedJobs.reduce((acc, job) => {
                const date = new Date(job.fechaSalida || job.fechaEntrada);
                const key = getMonthYearKey(date);
                if (!acc[key]) acc[key] = [];
                acc[key].push(job);
                return acc;
            }, {} as Record<string, Trabajo[]>);

            const sortedMonthKeys = Object.keys(groupedByMonth).sort((a, b) => b.localeCompare(a));

            return (
                <div className="flex flex-col min-h-full pb-8">
                    <div className="mb-8">
                        <div className="flex items-center gap-2 mb-4 px-1">
                            <div className="p-1.5 bg-green-50 dark:bg-green-900/30 rounded text-green-600 dark:text-green-400">
                                <ClockIcon className="h-4 w-4" />
                            </div>
                            <h4 className="text-[10px] font-black text-taller-gray uppercase tracking-[0.2em]">Últimos Trabajos</h4>
                        </div>
                        <div className="space-y-4">
                            {recentJobs.map(t => (
                                <JobCard key={t.id} trabajo={t} cliente={clientes.find(c => c.id === t.clienteId)} vehiculo={clientes.find(c => c.id === t.clienteId)?.vehiculos.find(v => v.id === t.vehiculoId)} onUpdateStatus={onUpdateStatus} tallerInfo={tallerInfo} clientes={clientes} onDataRefresh={onDataRefresh} isHighlighted={t.id === initialJobId} />
                            ))}
                        </div>
                    </div>

                    {sortedMonthKeys.length > 0 && (
                        <div>
                            <div className="flex items-center gap-2 mb-4 px-1">
                                <div className="p-1.5 bg-gray-100 dark:bg-gray-800 rounded text-gray-500">
                                    <CalendarIcon className="h-4 w-4" />
                                </div>
                                <h4 className="text-[10px] font-black text-taller-gray uppercase tracking-[0.2em]">Historial Mensual</h4>
                            </div>
                            {sortedMonthKeys.map(key => (
                                <MonthlyGroup
                                    key={key}
                                    monthKey={key}
                                    trabajos={groupedByMonth[key]}
                                    clientes={clientes}
                                    onUpdateStatus={status => onUpdateStatus(status, JobStatus.Finalizado)} // Fix potential typo in logic if needed
                                    onDataRefresh={onDataRefresh}
                                    tallerInfo={tallerInfo}
                                    initialJobId={initialJobId}
                                />
                            ))}
                        </div>
                    )}
                </div>
            );
        }

        if (tabJobs.length === 0) return <EmptyState />;

        return (
            <div className="space-y-4 pb-8">
                {tabJobs.map(t => (
                    <JobCard key={t.id} trabajo={t} cliente={clientes.find(c => c.id === t.clienteId)} vehiculo={clientes.find(c => c.id === t.clienteId)?.vehiculos.find(v => v.id === t.vehiculoId)} onUpdateStatus={onUpdateStatus} tallerInfo={tallerInfo} clientes={clientes} onDataRefresh={onDataRefresh} isHighlighted={t.id === initialJobId} />
                ))}
            </div>
        );
    };

    const activeIndex = statusOrder.indexOf(activeTab);

    return (
        <div className="h-full w-full flex flex-col relative overflow-hidden bg-taller-light dark:bg-taller-dark">
            <style>{`
                .inner-tab-slot {
                    width: 25%;
                    height: 100%;
                    flex-shrink: 0;
                    overflow: clip;
                    position: relative;
                }
                .tabs-sliding-container {
                    display: flex;
                    height: 100%;
                    width: 400%;
                    will-change: transform;
                    transition: transform 0.5s cubic-bezier(0.16, 1, 0.3, 1);
                }
                @media (min-width: 1024px) {
                    .tabs-sliding-container {
                        transform: none !important;
                        width: 100% !important;
                        display: grid !important;
                        grid-template-columns: repeat(4, 1fr) !important;
                        gap: 1.5rem;
                        padding: 0 1.5rem;
                    }
                    .inner-tab-slot {
                        width: 100% !important;
                        pointer-events: auto !important;
                        border-right: 1px solid rgba(156, 163, 175, 0.1);
                        padding-right: 0.75rem;
                    }
                    .inner-tab-slot:last-child {
                        border-right: none;
                    }
                }
            `}</style>

            <div
                ref={headerRef}
                className={`w-full bg-taller-light dark:bg-taller-dark transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] z-30 flex-shrink-0 ${headerVisible ? 'opacity-100 translate-y-0' : 'opacity-0 pointer-events-none'}`}
                style={{
                    marginTop: headerVisible ? 0 : -headerHeight,
                }}
            >
                <div className="max-w-3xl mx-auto p-4 pt-5 pb-3 w-full"><button type="button" onClick={() => setIsCreateModalOpen(true)} className="w-full flex items-center justify-center gap-2 py-3.5 px-4 bg-taller-primary text-white font-extrabold rounded-xl shadow-lg shadow-taller-primary/20 active:scale-95 transition-all"><PlusIcon className="h-5 w-5" /><span className="uppercase tracking-wider text-xs">Nuevo Presupuesto</span></button></div>
                <div className="flex border-b dark:border-gray-700 bg-taller-light dark:bg-taller-dark overflow-x-auto no-scrollbar w-full lg:hidden">
                    <div className="flex min-w-full px-4 sm:justify-center gap-1">
                        {statusOrder.map((status) => (
                            <button key={status} ref={(el: HTMLButtonElement | null) => { tabLabelsRef.current[status] = el; }} type="button" onClick={() => setActiveTab(status)} className={`flex-none min-w-[85px] py-4 px-2 text-[10px] font-black uppercase tracking-widest text-center transition-colors relative whitespace-nowrap ${activeTab === status ? 'text-taller-primary dark:text-blue-400' : 'text-gray-400 dark:text-gray-600'}`}>{status}{activeTab === status && <div className="absolute bottom-0 left-0 right-0 h-1 bg-taller-primary rounded-t-full"></div>}</button>
                        ))}
                    </div>
                </div>
            </div>

            <div className="flex-1 w-full overflow-hidden relative" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
                <div
                    className="tabs-sliding-container"
                    style={{
                        transform: `translate3d(-${activeIndex * 25}%, 0, 0)`
                    }}
                >
                    {statusOrder.map((status) => (
                        <div key={status} className="inner-tab-slot" style={{ pointerEvents: (activeTab === status) ? 'auto' : 'none' }}>
                            <div onScroll={(e) => handleVerticalScroll(e, status)} className="h-full overflow-y-auto px-4 pt-4 lg:px-0 lg:pt-6 scrollbar-hide overscroll-none dashboard-scroll" style={{ WebkitOverflowScrolling: 'touch' }}>
                                <div className="hidden lg:flex items-center gap-2 mb-6 px-1">
                                    <h3 className="text-xs font-black uppercase tracking-[0.2em] text-taller-primary dark:text-blue-400">{status}</h3>
                                    <div className="h-px flex-1 bg-gray-200 dark:bg-gray-700"></div>
                                </div>
                                <div className="max-w-3xl lg:max-w-none mx-auto min-h-full w-full overflow-x-hidden flex flex-col">
                                    {renderTabContent(status)}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <Suspense fallback={null}>
                {isCreateModalOpen && (
                    <CrearTrabajoModal
                        onClose={() => setIsCreateModalOpen(false)}
                        onSuccess={() => { setIsCreateModalOpen(false); onDataRefresh(); }}
                        onDataRefresh={onDataRefresh}
                        clientes={clientes}
                    />
                )}
            </Suspense>
        </div>
    );
};

export default Trabajos;
