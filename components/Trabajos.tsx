
import React, { useMemo, useState, useEffect, useRef, useCallback, useLayoutEffect } from 'react';
import type { Trabajo, Cliente, TallerInfo } from '../types';
import { JobStatus } from '../types';
import JobCard from './JobCard';
import CrearTrabajoModal from './CrearTrabajoModal';
import { PlusIcon, MagnifyingGlassIcon, ExclamationCircleIcon, ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/solid';

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
        <div className="bg-white dark:bg-gray-800 rounded-xl p-3 border dark:border-gray-700 shadow-sm mb-4">
            <div className="flex justify-between items-center mb-4 px-1">
                <button type="button" onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))}><ChevronLeftIcon className="h-4 w-4"/></button>
                <span className="text-sm font-bold capitalize">{currentMonth.toLocaleString('es-ES', { month: 'long', year: 'numeric' })}</span>
                <button type="button" onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))}><ChevronRightIcon className="h-4 w-4"/></button>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center mb-2">{['D','L','M','M','J','V','S'].map(d => <span key={d} className="text-[10px] font-bold text-gray-400">{d}</span>)}</div>
            <div className="grid grid-cols-7 gap-1">{renderDays()}</div>
        </div>
    );
};

const EmptyState: React.FC<{ status: string }> = ({ status }) => (
    <div className="flex flex-col items-center justify-center py-24 opacity-30 h-full w-full select-none">
        <MagnifyingGlassIcon className="h-14 w-14 text-gray-400 mb-4" />
        <p className="text-sm font-black uppercase tracking-widest text-taller-gray dark:text-gray-400 text-center px-8">No hay trabajos en {status}</p>
    </div>
);

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

    // Medición dinámica del encabezado para permitir expansión del 100% de la lista
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
        if (st <= 0) setHeaderVisible(true);
        else if (Math.abs(diff) > 20) setHeaderVisible(diff < 0);
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
            return t.descripcion.toLowerCase().includes(q) || `${c?.nombre} ${c?.apellido}`.toLowerCase().includes(q) || `${v?.marca} ${v?.modelo} ${v?.matricula}`.toLowerCase().includes(q) || (qb && `${qb.nombre} ${qb.marca} ${qb.modelo}`.toLowerCase().includes(q));
        });
    }, [trabajos, searchQuery, clientes]);

    const renderTabContent = (status: JobStatus) => {
        const tabJobs = filteredTrabajos.filter(t => t.status === status);
        if (status === JobStatus.Programado) {
            const scheduled = tabJobs.filter(t => t.fechaProgramada);
            const pending = tabJobs.filter(t => !t.fechaProgramada);
            const calendarFiltered = selectedDate ? scheduled.filter(t => new Date(t.fechaProgramada!).toLocaleDateString() === selectedDate.toLocaleDateString()) : scheduled;
            return (
                <div className="space-y-6">
                    <CalendarWidget trabajos={scheduled} selectedDate={selectedDate} onSelectDate={setSelectedDate} />
                    {pending.length > 0 && (
                        <div className="bg-red-50 dark:bg-red-900/10 p-4 rounded-xl border border-red-100 dark:border-red-900/30">
                            <h4 className="text-[10px] font-black text-red-600 dark:text-red-400 uppercase tracking-widest mb-4 flex items-center gap-2"><ExclamationCircleIcon className="h-4 w-4"/> Pendientes de Turno ({pending.length})</h4>
                            <div className="space-y-4">{pending.map(t => <JobCard key={t.id} trabajo={t} cliente={clientes.find(c => c.id === t.clienteId)} vehiculo={clientes.find(c => c.id === t.clienteId)?.vehiculos.find(v => v.id === t.vehiculoId)} onUpdateStatus={onUpdateStatus} tallerInfo={tallerInfo} clientes={clientes} onDataRefresh={onDataRefresh} isHighlighted={t.id === initialJobId} />)}</div>
                        </div>
                    )}
                    {calendarFiltered.length > 0 ? (
                        <div className="space-y-4 pb-40">{calendarFiltered.map(t => <JobCard key={t.id} trabajo={t} cliente={clientes.find(c => c.id === t.clienteId)} vehiculo={clientes.find(c => c.id === t.clienteId)?.vehiculos.find(v => v.id === t.vehiculoId)} onUpdateStatus={onUpdateStatus} tallerInfo={tallerInfo} clientes={clientes} onDataRefresh={onDataRefresh} isHighlighted={t.id === initialJobId} />)}</div>
                    ) : <EmptyState status={selectedDate ? "esta fecha" : "esta sección"} />}
                </div>
            );
        }
        if (tabJobs.length === 0) return <EmptyState status={status} />;
        return (
            <div className="space-y-4 pb-40">
                {tabJobs.map(t => <JobCard key={t.id} trabajo={t} cliente={clientes.find(c => c.id === t.clienteId)} vehiculo={clientes.find(c => c.id === t.clienteId)?.vehiculos.find(v => v.id === t.vehiculoId)} onUpdateStatus={onUpdateStatus} tallerInfo={tallerInfo} clientes={clientes} onDataRefresh={onDataRefresh} isHighlighted={t.id === initialJobId} />)}
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
                    overflow: hidden;
                    position: relative;
                }
            `}</style>
            
            {/* Encabezado animado con margen negativo para expansión total */}
            <div 
                ref={headerRef}
                className={`w-full bg-taller-light dark:bg-taller-dark transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] z-30 ${headerVisible ? 'opacity-100 translate-y-0' : 'opacity-0 pointer-events-none'}`}
                style={{ 
                    marginTop: headerVisible ? 0 : -headerHeight,
                }}
            >
                <div className="p-4 pt-5 pb-3 w-full"><button type="button" onClick={() => setIsCreateModalOpen(true)} className="w-full flex items-center justify-center gap-2 py-3.5 px-4 bg-taller-primary text-white font-extrabold rounded-xl shadow-lg shadow-taller-primary/20 active:scale-95 transition-all"><PlusIcon className="h-5 w-5" /><span className="uppercase tracking-wider text-xs">Nuevo Presupuesto</span></button></div>
                <div className="flex border-b dark:border-gray-700 bg-taller-light dark:bg-taller-dark overflow-x-auto no-scrollbar w-full">
                    <div className="flex min-w-full px-4 sm:justify-center gap-1">
                        {statusOrder.map((status) => (
                            <button key={status} ref={el => tabLabelsRef.current[status] = el} type="button" onClick={() => setActiveTab(status)} className={`flex-none min-w-[85px] py-4 px-2 text-[10px] font-black uppercase tracking-widest text-center transition-colors relative whitespace-nowrap ${activeTab === status ? 'text-taller-primary dark:text-blue-400' : 'text-gray-400 dark:text-gray-600'}`}>{status}{activeTab === status && <div className="absolute bottom-0 left-0 right-0 h-1 bg-taller-primary rounded-t-full"></div>}</button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Contenedor de listas: utiliza flex-1 para expandirse dinámicamente */}
            <div className="flex-1 w-full overflow-hidden relative" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
                <div 
                    className="flex h-full transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] will-change-transform" 
                    style={{ 
                        width: '400%',
                        transform: `translate3d(-${activeIndex * 25}%, 0, 0)`
                    }}
                >
                    {statusOrder.map((status) => (
                        <div key={status} className="inner-tab-slot" style={{ pointerEvents: activeTab === status ? 'auto' : 'none' }}>
                            <div onScroll={(e) => handleVerticalScroll(e, status)} className="h-full overflow-y-auto px-4 pt-0 scrollbar-hide overscroll-none">
                                <div className="max-w-3xl mx-auto min-h-full w-full overflow-x-hidden pt-4">
                                    {renderTabContent(status)}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {isCreateModalOpen && <CrearTrabajoModal onClose={() => setIsCreateModalOpen(false)} onSuccess={() => { setIsCreateModalOpen(false); onDataRefresh(); }} onDataRefresh={onDataRefresh} clientes={clientes} />}
        </div>
    );
};

export default Trabajos;
