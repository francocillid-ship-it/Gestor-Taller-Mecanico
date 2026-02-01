
import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import type { Trabajo, Cliente, TallerInfo } from '../types';
import { JobStatus } from '../types';
import JobCard from './JobCard';
import CrearTrabajoModal from './CrearTrabajoModal';
import { PlusIcon, MagnifyingGlassIcon, CalendarIcon, ExclamationCircleIcon, ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/solid';

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

// --- Subcomponentes auxiliares ---

const CalendarWidget: React.FC<{
    trabajos: Trabajo[];
    onSelectDate: (date: Date | null) => void;
    selectedDate: Date | null;
}> = ({ trabajos, onSelectDate, selectedDate }) => {
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const daysInMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    const firstDayOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1).getDay();
    
    const isSameDay = (d1: Date, d2: Date) => 
        d1.getFullYear() === d2.getFullYear() && 
        d1.getMonth() === d2.getMonth() && 
        d1.getDate() === d2.getDate();

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
                <button 
                    key={d} 
                    type="button"
                    onClick={() => onSelectDate(isSelected ? null : date)}
                    className={`h-10 flex flex-col items-center justify-center rounded-lg transition-all ${
                        isSelected ? 'bg-taller-primary text-white font-bold scale-105 shadow-sm' : 
                        isToday ? 'bg-blue-100 text-taller-primary dark:bg-blue-900/40 font-bold' : 
                        'hover:bg-gray-100 dark:hover:bg-gray-700 text-taller-dark dark:text-taller-light'
                    }`}
                >
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
                <button type="button" onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))} className="p-1"><ChevronLeftIcon className="h-4 w-4"/></button>
                <span className="text-sm font-bold capitalize text-taller-dark dark:text-taller-light">{currentMonth.toLocaleString('es-ES', { month: 'long', year: 'numeric' })}</span>
                <button type="button" onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))} className="p-1"><ChevronRightIcon className="h-4 w-4"/></button>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center mb-2">
                {['D','L','M','M','J','V','S'].map(d => <span key={d} className="text-[10px] font-bold text-gray-400">{d}</span>)}
            </div>
            <div className="grid grid-cols-7 gap-1">{renderDays()}</div>
        </div>
    );
};

const EmptyState: React.FC<{ status: string }> = ({ status }) => (
    <div className="flex flex-col items-center justify-center py-24 opacity-30 h-full w-full pointer-events-none select-none">
        <MagnifyingGlassIcon className="h-14 w-14 text-gray-400 mb-4" />
        <p className="text-sm font-black uppercase tracking-widest text-taller-gray dark:text-gray-400 text-center px-8">
            No hay trabajos en {status}
        </p>
    </div>
);

// --- Componente Principal ---

const Trabajos: React.FC<TrabajosProps> = ({ trabajos, clientes, onUpdateStatus, onDataRefresh, tallerInfo, searchQuery, initialTab, initialJobId, isActive }) => {
    const [activeTab, setActiveTab] = useState<JobStatus>(initialTab || JobStatus.Presupuesto);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [headerVisible, setHeaderVisible] = useState(true);
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
    
    const lastScrollTops = useRef<{ [key: string]: number }>({});
    const touchStart = useRef({ x: 0, y: 0 });
    const tabLabelsRef = useRef<{ [key: string]: HTMLButtonElement | null }>({});

    useEffect(() => { if (initialTab) setActiveTab(initialTab); }, [initialTab]);
    
    useEffect(() => {
        // Solo realizar scroll automático si la pestaña de trabajos está ACTIVA
        // para evitar que el navegador desplace el contenedor Dashboard externo.
        if (isActive) {
            const btn = tabLabelsRef.current[activeTab];
            if (btn) btn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
            setHeaderVisible(true);
        }
    }, [activeTab, isActive]);

    const handleVerticalScroll = useCallback((e: React.UIEvent<HTMLDivElement>, status: JobStatus) => {
        if (status !== activeTab) return;
        const el = e.currentTarget;
        const st = el.scrollTop;
        
        const isScrollable = el.scrollHeight > el.clientHeight + 60;
        if (!isScrollable) {
            if (!headerVisible) setHeaderVisible(true);
            return;
        }

        const lastSt = lastScrollTops.current[status] || 0;
        const diff = st - lastSt;

        if (st <= 0) {
            setHeaderVisible(true);
        } else if (Math.abs(diff) > 20) {
            setHeaderVisible(diff < 0);
        }
        lastScrollTops.current[status] = st;
    }, [activeTab, headerVisible]);

    const handleTouchStart = (e: React.TouchEvent) => {
        touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    };

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
        let list = trabajos;
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            list = list.filter(t => {
                const c = clientes.find(cl => cl.id === t.clienteId);
                const v = c?.vehiculos.find(ve => ve.id === t.vehiculoId);
                const qb = t.quickBudgetData;
                return (
                    t.descripcion.toLowerCase().includes(q) ||
                    `${c?.nombre} ${c?.apellido}`.toLowerCase().includes(q) ||
                    `${v?.marca} ${v?.modelo} ${v?.matricula}`.toLowerCase().includes(q) ||
                    (qb && `${qb.nombre} ${qb.marca} ${qb.modelo} ${qb.matricula}`.toLowerCase().includes(q))
                );
            });
        }
        return list;
    }, [trabajos, searchQuery, clientes]);

    const renderTabContent = (status: JobStatus) => {
        const tabJobs = filteredTrabajos.filter(t => t.status === status);
        if (status === JobStatus.Programado) {
            const scheduled = tabJobs.filter(t => t.fechaProgramada);
            const pending = tabJobs.filter(t => !t.fechaProgramada);
            const calendarFiltered = selectedDate 
                ? scheduled.filter(t => new Date(t.fechaProgramada!).toLocaleDateString() === selectedDate.toLocaleDateString())
                : scheduled;

            return (
                <div className="space-y-6">
                    <CalendarWidget trabajos={scheduled} selectedDate={selectedDate} onSelectDate={setSelectedDate} />
                    {pending.length > 0 && (
                        <div className="bg-red-50 dark:bg-red-900/10 p-4 rounded-xl border border-red-100 dark:border-red-900/30">
                            <h4 className="text-[10px] font-black text-red-600 dark:text-red-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                <ExclamationCircleIcon className="h-4 w-4"/> Pendientes de Turno ({pending.length})
                            </h4>
                            <div className="space-y-4">
                                {pending.map(t => <JobCard key={t.id} trabajo={t} cliente={clientes.find(c => c.id === t.clienteId)} vehiculo={clientes.find(c => c.id === t.clienteId)?.vehiculos.find(v => v.id === t.vehiculoId)} onUpdateStatus={onUpdateStatus} tallerInfo={tallerInfo} clientes={clientes} onDataRefresh={onDataRefresh} isHighlighted={t.id === initialJobId} />)}
                            </div>
                        </div>
                    )}
                    <div className="text-[10px] font-black text-taller-gray dark:text-gray-500 uppercase tracking-[0.15em] px-1 border-b dark:border-gray-700 pb-2">
                        {selectedDate ? `Turnos para el ${selectedDate.toLocaleDateString('es-ES')}` : 'Próximos turnos agendados'}
                    </div>
                    {calendarFiltered.length > 0 ? (
                        <div className="space-y-4">
                            {calendarFiltered.map(t => <JobCard key={t.id} trabajo={t} cliente={clientes.find(c => c.id === t.clienteId)} vehiculo={clientes.find(c => c.id === t.clienteId)?.vehiculos.find(v => v.id === t.vehiculoId)} onUpdateStatus={onUpdateStatus} tallerInfo={tallerInfo} clientes={clientes} onDataRefresh={onDataRefresh} isHighlighted={t.id === initialJobId} />)}
                        </div>
                    ) : <EmptyState status={selectedDate ? "esta fecha" : "esta sección"} />}
                </div>
            );
        }
        if (tabJobs.length === 0) return <EmptyState status={status} />;
        return (
            <div className="space-y-4">
                {tabJobs.map(t => <JobCard key={t.id} trabajo={t} cliente={clientes.find(c => c.id === t.clienteId)} vehiculo={clientes.find(c => c.id === t.clienteId)?.vehiculos.find(v => v.id === t.vehiculoId)} onUpdateStatus={onUpdateStatus} tallerInfo={tallerInfo} clientes={clientes} onDataRefresh={onDataRefresh} isHighlighted={t.id === initialJobId} />)}
            </div>
        );
    };

    const activeIndex = statusOrder.indexOf(activeTab);

    return (
        <div className="h-full w-full flex flex-col bg-taller-light dark:bg-taller-dark relative overflow-hidden" style={{ contain: 'strict' }}>
            
            {/* CAPA 1: HEADER (BLOQUEADO HORIZONTALMENTE) */}
            <div 
                className={`sticky top-0 z-30 w-full max-w-full bg-taller-light dark:bg-taller-dark transition-all duration-400 ease-[cubic-bezier(0.32,0.72,0,1)] will-change-transform shadow-sm overflow-hidden ${headerVisible ? 'translate-y-0 opacity-100' : '-translate-y-full opacity-0 pointer-events-none'}`}
            >
                <div className="p-4 pt-5 pb-3 w-full max-w-full">
                    <button 
                        type="button"
                        onClick={() => setIsCreateModalOpen(true)}
                        className="w-full flex items-center justify-center gap-2 py-3.5 px-4 bg-taller-primary text-white font-extrabold rounded-xl shadow-lg shadow-taller-primary/20 active:scale-[0.98] transition-all"
                    >
                        <PlusIcon className="h-5 w-5" />
                        <span className="uppercase tracking-wider text-xs">Nuevo Presupuesto</span>
                    </button>
                </div>

                <div className="flex border-b dark:border-gray-700 bg-taller-light dark:bg-taller-dark overflow-x-auto no-scrollbar scroll-smooth w-full">
                    <div className="flex min-w-full px-4 sm:justify-center gap-1">
                        {statusOrder.map((status) => (
                            <button
                                key={status}
                                ref={el => tabLabelsRef.current[status] = el}
                                type="button"
                                onClick={() => setActiveTab(status)}
                                className={`flex-none min-w-[85px] py-4 px-2 text-[10px] font-black uppercase tracking-widest text-center transition-colors relative whitespace-nowrap ${
                                    activeTab === status ? 'text-taller-primary dark:text-blue-400' : 'text-gray-400 dark:text-gray-600'
                                }`}
                            >
                                {status}
                                {activeTab === status && <div className="absolute bottom-0 left-0 right-0 h-1 bg-taller-primary rounded-t-full shadow-[0_-2px_6px_rgba(30,58,138,0.2)]"></div>}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* 
                CAPA 2: PAGER HORIZONTAL (AISLAMIENTO TOTAL)
                El uso de transform: translateX debe ocurrir dentro de un contenedor con overflow-hidden
                y ancho fijo de 100% para evitar que el 'track' interno afecte al layout exterior.
            */}
            <div 
                className="flex-1 w-full max-w-full overflow-hidden relative"
                style={{ contain: 'content' }}
                onTouchStart={handleTouchStart}
                onTouchEnd={handleTouchEnd}
            >
                <div 
                    className="flex h-full transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] will-change-transform"
                    style={{ 
                        transform: `translateX(-${activeIndex * 100}%)`,
                        width: '100%' 
                    }}
                >
                    {statusOrder.map((status) => (
                        <div 
                            key={status} 
                            onScroll={(e) => handleVerticalScroll(e, status)}
                            className="h-full overflow-y-auto overscroll-none px-4 pt-6 pb-32 scroll-smooth scrollbar-hide overflow-x-hidden flex-shrink-0"
                            style={{ minWidth: '100%', maxWidth: '100%' }}
                        >
                            <div className="max-w-3xl mx-auto min-h-full w-full overflow-x-hidden">
                                {renderTabContent(status)}
                            </div>
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
                .scrollbar-hide::-webkit-scrollbar { display: none; }
                .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
                
                /* Resetear overscroll y ancho global en Trabajos */
                html, body { 
                    overscroll-behavior-x: none;
                    width: 100% !important;
                    overflow-x: hidden !important;
                }
            `}</style>
        </div>
    );
};

export default Trabajos;
