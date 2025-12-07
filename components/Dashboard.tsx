
import React, { useMemo, useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { Cliente, Trabajo, Gasto } from '../types';
import { JobStatus } from '../types';
import { CurrencyDollarIcon, UsersIcon, WrenchScrewdriverIcon, PlusIcon, PencilIcon, TrashIcon, ChartPieIcon, BuildingLibraryIcon, ScaleIcon, ChevronDownIcon, CalendarIcon, ArrowLeftIcon, ArrowTrendingUpIcon, ArrowTrendingDownIcon } from '@heroicons/react/24/solid';
import AddGastoModal from './AddGastoModal';
import EditGastoModal from './EditGastoModal';
import { supabase } from '../supabaseClient';

interface DashboardProps {
    clientes: Cliente[];
    trabajos: Trabajo[];
    gastos: Gasto[];
    onDataRefresh: () => void;
    searchQuery: string;
    onNavigate: (view: 'dashboard' | 'trabajos' | 'clientes' | 'ajustes') => void;
}

interface StatCardProps {
    title: string;
    value: string | number;
    icon: React.ReactNode;
    color: string;
    onClick?: () => void;
}

// Tarjeta rediseñada para ser responsive: Vertical en móvil (2 col), Horizontal en escritorio
const StatCard: React.FC<StatCardProps> = ({ title, value, icon, color, onClick }) => (
    <div 
        onClick={onClick}
        className={`bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-xl shadow-md flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:space-x-4 h-full transition-all duration-200 ${onClick ? 'cursor-pointer hover:shadow-lg hover:scale-[1.01] active:scale-[0.98]' : ''}`}
    >
        <div className={`p-2 sm:p-3 rounded-full ${color} shrink-0`}>
            {/* Clona el icono para asegurar tamaño responsivo consistente */}
            {React.isValidElement(icon) 
                ? React.cloneElement(icon as React.ReactElement, { className: "h-5 w-5 sm:h-6 sm:w-6 text-white" }) 
                : icon
            }
        </div>
        <div className="min-w-0">
            <p className="text-xs sm:text-sm text-taller-gray dark:text-gray-400 truncate">{title}</p>
            <p className="text-lg sm:text-2xl font-bold text-taller-dark dark:text-taller-light truncate">{value}</p>
        </div>
    </div>
);

type Period = 'this_month' | 'last_7_days' | 'last_15_days' | 'last_month';
type DetailType = 'ingresos' | 'ganancias' | 'gastos' | 'balance' | null;

interface TransactionItem {
    id: string;
    date: Date;
    description: string;
    amount: number;
    type: 'income' | 'expense';
    subtext?: string;
}

// --- Filter Controls Component (Horizontal Scroll) ---
const FilterControls = ({ activePeriod, setPeriodFn }: { activePeriod: Period, setPeriodFn: (p: Period) => void }) => (
    // Se usa -mx-4 y px-4 para que el scroll llegue hasta los bordes de la pantalla pero el contenido tenga padding
    <div className="flex items-center gap-2 overflow-x-auto flex-nowrap pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 scrollbar-hide">
        <style>{`.scrollbar-hide::-webkit-scrollbar { display: none; } .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }`}</style>
        {[
            { label: 'Este mes', value: 'this_month' },
            { label: 'Últimos 7 días', value: 'last_7_days' },
            { label: 'Últimos 15 días', value: 'last_15_days' },
            { label: 'Mes pasado', value: 'last_month' }
        ].map(p => (
            <button
                key={p.value}
                onClick={() => setPeriodFn(p.value as Period)}
                className={`flex-shrink-0 px-4 py-2 text-xs sm:text-sm font-medium rounded-full transition-all border whitespace-nowrap ${
                    activePeriod === p.value 
                    ? 'bg-taller-primary text-white border-taller-primary shadow-md' 
                    : 'bg-white dark:bg-gray-800 text-taller-gray dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
            >
                {p.label}
            </button>
        ))}
    </div>
);

// --- Financial Detail Overlay Component (Extracted to maintain state) ---
interface FinancialDetailOverlayProps {
    detailView: DetailType;
    onClose: () => void;
    period: Period;
    setPeriod: (p: Period) => void;
    data: { transactions: TransactionItem[], total: number };
    gananciasNetasDisplay: string;
}

const FinancialDetailOverlay: React.FC<FinancialDetailOverlayProps> = ({ detailView, onClose, period, setPeriod, data, gananciasNetasDisplay }) => {
    const [isFilterVisible, setIsFilterVisible] = useState(true);
    const lastScrollTop = useRef(0);
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    const handleScroll = () => {
        if (!scrollContainerRef.current) return;
        
        const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
        const diff = scrollTop - lastScrollTop.current;

        // 1. Ignore bounce/overscroll at the top (negative scrollTop)
        if (scrollTop < 0) return;

        // 2. Ignore bounce/overscroll at the bottom (scrollTop + clientHeight > scrollHeight)
        // Also ignore standard scrolling if we are very close to the bottom to prevent flickering
        // when the user hits the end of the list.
        if (scrollTop + clientHeight > scrollHeight - 50) {
            lastScrollTop.current = scrollTop;
            return;
        }

        // Ignore very small movements to avoid jitter
        if (Math.abs(diff) < 10) return;

        if (diff > 0 && scrollTop > 50 && isFilterVisible) {
            // Scrolling Down & passed threshold -> Hide Filter
            setIsFilterVisible(false);
        } else if (diff < 0 && !isFilterVisible) {
            // Scrolling Up -> Show Filter
            setIsFilterVisible(true);
        }
        
        lastScrollTop.current = scrollTop;
    };

    if (!detailView) return null;

    const titleMap = {
        'ingresos': 'Historial de Ingresos',
        'gastos': 'Historial de Gastos',
        'balance': 'Balance (Flujo de Caja)',
        'ganancias': 'Detalle de Movimientos (Ganancia)'
    };

    const isProfitView = detailView === 'ganancias';
    const displayTotal = isProfitView ? gananciasNetasDisplay : new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(data.total);

    // Use Portal to break out of any stacking context and ensure full screen coverage over headers/navs
    return createPortal(
        <div className="fixed inset-0 z-[70] bg-taller-light dark:bg-taller-dark flex flex-col animate-in slide-in-from-bottom-5 duration-300">
            {/* Header with Safe Area Padding */}
            <div className="bg-white dark:bg-gray-800 shadow-sm flex-shrink-0 pt-[env(safe-area-inset-top)] border-b dark:border-gray-700 z-20 relative transition-transform duration-300">
                <div className="flex items-center justify-between p-4">
                    <button 
                        onClick={onClose}
                        className="p-2 -ml-2 text-taller-gray dark:text-gray-400 hover:text-taller-dark dark:hover:text-white rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                        <ArrowLeftIcon className="h-6 w-6" />
                    </button>
                    <h2 className="text-lg font-bold text-taller-dark dark:text-taller-light">{titleMap[detailView]}</h2>
                    <div className="w-10"></div> {/* Spacer for alignment */}
                </div>
            </div>

            {/* Filter Section - Collapsible on Scroll */}
            <div className={`bg-taller-light dark:bg-taller-dark z-10 flex-shrink-0 transition-all duration-300 ease-in-out overflow-hidden ${isFilterVisible ? 'max-h-[80px] opacity-100 translate-y-0' : 'max-h-0 opacity-0 -translate-y-4'}`}>
                <div className="p-4 pb-2">
                    <FilterControls activePeriod={period} setPeriodFn={setPeriod} />
                </div>
            </div>

            {/* Scrollable Content */}
            <div 
                ref={scrollContainerRef}
                onScroll={handleScroll}
                className="flex-1 overflow-y-auto px-4 pb-4 pt-2 space-y-4 overscroll-contain"
            >
                {/* Big Summary Card */}
                <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm text-center mt-2 border dark:border-gray-700">
                    <p className="text-sm text-taller-gray dark:text-gray-400 uppercase tracking-wide">Total {period.replace(/_/g, ' ')}</p>
                    <p className={`text-4xl font-bold mt-2 ${data.total >= 0 ? 'text-taller-dark dark:text-taller-light' : 'text-red-600'}`}>
                        {displayTotal}
                    </p>
                    {isProfitView && (
                       <p className="text-xs text-taller-gray dark:text-gray-500 mt-2">
                           * Cálculo basado en Mano de Obra cobrada - Gastos Fijos.
                       </p>
                    )}
                </div>

                {/* Transaction List */}
                <div className="space-y-3 pb-24"> {/* Extra padding bottom for safe scroll */}
                     {data.transactions.length > 0 ? (
                        data.transactions.map((t) => (
                            <div key={t.id} className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm flex items-center justify-between border-l-4 border-transparent hover:border-l-4 transition-all" style={{ borderLeftColor: t.type === 'income' ? '#22c55e' : '#ef4444' }}>
                                <div className="flex items-center gap-3">
                                    <div className={`p-2 rounded-full ${t.type === 'income' ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'}`}>
                                        {t.type === 'income' ? <ArrowTrendingUpIcon className="h-5 w-5" /> : <ArrowTrendingDownIcon className="h-5 w-5" />}
                                    </div>
                                    <div>
                                        <p className="font-bold text-taller-dark dark:text-taller-light text-sm">{t.description}</p>
                                        <p className="text-xs text-taller-gray dark:text-gray-400">{t.subtext}</p>
                                        <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">{t.date.toLocaleDateString('es-ES')} {t.date.toLocaleTimeString([], { hour: '2-digit', minute:'2-digit' })}</p>
                                    </div>
                                </div>
                                <p className={`font-bold ${t.type === 'income' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                    {t.type === 'income' ? '+' : '-'} {new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(t.amount)}
                                </p>
                            </div>
                        ))
                     ) : (
                         <div className="text-center py-10 text-taller-gray dark:text-gray-400">
                             <ScaleIcon className="h-12 w-12 mx-auto mb-2 opacity-20" />
                             <p>No hay movimientos en este periodo.</p>
                         </div>
                     )}
                </div>
            </div>
        </div>,
        document.body
    );
};


const Dashboard: React.FC<DashboardProps> = ({ clientes, trabajos, gastos, onDataRefresh, searchQuery, onNavigate }) => {
    const [isAddGastoModalOpen, setIsAddGastoModalOpen] = useState(false);
    const [gastoToEdit, setGastoToEdit] = useState<Gasto | null>(null);
    const [period, setPeriod] = useState<Period>('this_month');
    const [confirmingDeleteGastoId, setConfirmingDeleteGastoId] = useState<string | null>(null);
    const [isLastMonthExpanded, setIsLastMonthExpanded] = useState(false);
    
    // State for the Detail Overlay
    const [detailView, setDetailView] = useState<DetailType>(null);
    
    // Referencia para la sección de gastos
    const gastosSectionRef = useRef<HTMLDivElement>(null);

    // Efecto para hacer scroll a la sección de gastos cuando se busca
    useEffect(() => {
        if (searchQuery && gastosSectionRef.current) {
            gastosSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }, [searchQuery]);
    
    // Función auxiliar para filtrar por fecha
    const getPeriodDates = (selectedPeriod: Period) => {
        const now = new Date();
        let startDate = new Date();
        let endDate = new Date(now);

        switch (selectedPeriod) {
            case 'this_month':
                startDate = new Date(now.getFullYear(), now.getMonth(), 1);
                endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
                break;
            case 'last_7_days':
                startDate.setDate(now.getDate() - 6);
                break;
            case 'last_15_days':
                startDate.setDate(now.getDate() - 14);
                break;
            case 'last_month':
                startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                endDate = new Date(now.getFullYear(), now.getMonth(), 0);
                break;
        }
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(23, 59, 59, 999);
        return { startDate, endDate };
    };

    const stats = useMemo(() => {
        const formatCurrency = (amount: number) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(amount);
        
        const { startDate, endDate } = getPeriodDates(period);

        // 1. Calcular Gastos del Periodo
        const filteredGastos = gastos.filter(g => {
            const gastoDate = new Date(g.fecha);
            return gastoDate >= startDate && gastoDate <= endDate;
        });
        const totalGastos = filteredGastos.reduce((sum, g) => sum + g.monto, 0);

        // 2. Calcular Ingresos y Ganancia Real (Prioridad Repuestos)
        let ingresosTotales = 0;
        let gananciaManoDeObraReal = 0; 

        trabajos.forEach(trabajo => {
            const costoTotal = trabajo.costoEstimado || 0;
            const costoManoDeObra = trabajo.costoManoDeObra || 0;
            const costoRepuestos = Math.max(0, costoTotal - costoManoDeObra);

            // Obtenemos TODOS los pagos de este trabajo, ordenados cronológicamente
            // Necesitamos el contexto histórico para saber si el costo de repuestos ya se cubrió
            const todosLosPagos = trabajo.partes
                .filter(p => p.nombre === '__PAGO_REGISTRADO__')
                .sort((a, b) => new Date(a.fecha || 0).getTime() - new Date(b.fecha || 0).getTime());

            let acumuladoPagosJob = 0;

            todosLosPagos.forEach(pago => {
                const montoPago = pago.precioUnitario;
                const fechaPago = pago.fecha ? new Date(pago.fecha) : new Date(0);
                
                // Determinar si este pago cae en el periodo seleccionado
                const esDelPeriodo = fechaPago >= startDate && fechaPago <= endDate;

                // LÓGICA DE GANANCIA:
                // 1. Calculamos cuánto se había cubierto antes de este pago
                const coberturaPrevia = acumuladoPagosJob;
                // 2. Calculamos cuánto se cubre después de este pago
                const coberturaActual = acumuladoPagosJob + montoPago;

                // 3. La ganancia (mano de obra) es todo aquello que supere el costo de repuestos
                const gananciaAcumuladaPrevia = Math.max(0, coberturaPrevia - costoRepuestos);
                const gananciaAcumuladaActual = Math.max(0, coberturaActual - costoRepuestos);

                // 4. La ganancia específica de ESTE pago es la diferencia
                const gananciaDeEstePago = gananciaAcumuladaActual - gananciaAcumuladaPrevia;

                if (esDelPeriodo) {
                    ingresosTotales += montoPago;
                    gananciaManoDeObraReal += gananciaDeEstePago;
                }

                // Avanzamos el acumulador para la siguiente iteración
                acumuladoPagosJob += montoPago;
            });
        });

        // Ganancia Neta = (Mano de Obra Cobrada en el periodo) - (Gastos Fijos del periodo)
        const gananciaNeta = gananciaManoDeObraReal - totalGastos;

        // Balance (Flujo de Caja) = (Dinero Entrante) - (Dinero Saliente en Gastos)
        const balance = ingresosTotales - totalGastos;

        const trabajosActivos = trabajos.filter(t => t.status !== JobStatus.Finalizado).length;
        const totalClientes = clientes.length;

        return {
            ingresosTotales: formatCurrency(ingresosTotales),
            gananciasNetas: formatCurrency(gananciaNeta),
            gastos: formatCurrency(totalGastos),
            balance: formatCurrency(balance),
            trabajosActivos,
            totalClientes,
        };
    }, [clientes, trabajos, gastos, period]);

    const handleAddGasto = async (gastosToAdd: Omit<Gasto, 'id'>[]) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        
        const gastosConId = gastosToAdd.map(g => ({ ...g, taller_id: user.id }));

        const { error } = await supabase.from('gastos').insert(gastosConId);
        if (error) {
            console.error("Error adding expense:", error);
        } else {
            onDataRefresh();
            setIsAddGastoModalOpen(false);
        }
    };

    const handleUpdateGasto = async (gasto: Gasto) => {
        const { id, ...updateData } = gasto;
        const { error } = await supabase.from('gastos').update(updateData).eq('id', id);
        if (error) {
            console.error("Error updating expense:", error);
        } else {
            onDataRefresh();
            setGastoToEdit(null);
        }
    };
    
    const handleDeleteGasto = async (gastoId: string) => {
        const { error } = await supabase.from('gastos').delete().eq('id', gastoId);
        if(error) {
            console.error("Error deleting expense:", error);
        } else {
            onDataRefresh();
        }
        setConfirmingDeleteGastoId(null);
    };

    // Agrupación de gastos: Mes actual y Mes Pasado
    const groupedGastos = useMemo(() => {
        let filtered = [...gastos];
        
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            filtered = filtered.filter(g => 
                g.descripcion.toLowerCase().includes(query) || 
                g.monto.toString().includes(query)
            );
        }

        // Ordenar por fecha descendente
        filtered.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());

        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();

        // Calcular mes anterior manejando cambio de año
        const prevDate = new Date(currentYear, currentMonth - 1, 1);
        const prevMonth = prevDate.getMonth();
        const prevYear = prevDate.getFullYear();

        const thisMonth: Gasto[] = [];
        const lastMonth: Gasto[] = [];

        filtered.forEach(g => {
            const d = new Date(g.fecha);
            if (d.getMonth() === currentMonth && d.getFullYear() === currentYear) {
                thisMonth.push(g);
            } else if (d.getMonth() === prevMonth && d.getFullYear() === prevYear) {
                lastMonth.push(g);
            }
            // Los más antiguos se ignoran en "Recientes" salvo que busques algo específico,
            // pero si hay búsqueda activa, mostramos todo en la lista principal para no ocultar resultados.
            else if (searchQuery) {
                thisMonth.push(g);
            }
        });

        return { thisMonth, lastMonth };
    }, [gastos, searchQuery]);

    // Financial History Data Preparation
    const financialDetailData = useMemo(() => {
        if (!detailView) return { transactions: [], total: 0 };

        // Detail View has its own period filter if we wanted, but for UX consistency we use the same state 'period'
        // or we could let the modal have its own state. 
        // For simplicity, let's share the state 'period' but recalculate specifically for the list.
        
        const { startDate, endDate } = getPeriodDates(period);
        const transactions: TransactionItem[] = [];

        // 1. Collect Income
        if (detailView === 'ingresos' || detailView === 'balance' || detailView === 'ganancias') {
            trabajos.forEach(t => {
                t.partes.forEach((p, idx) => {
                    if (p.nombre === '__PAGO_REGISTRADO__') {
                        const date = p.fecha ? new Date(p.fecha) : new Date(0);
                        if (date >= startDate && date <= endDate) {
                            const cliente = clientes.find(c => c.id === t.clienteId);
                            const vehiculo = cliente?.vehiculos.find(v => v.id === t.vehiculoId);
                            transactions.push({
                                id: `${t.id}_pago_${idx}`,
                                date: date,
                                amount: p.precioUnitario,
                                description: `Pago de ${cliente ? cliente.nombre : 'Cliente'}`,
                                subtext: vehiculo ? `${vehiculo.marca} ${vehiculo.modelo}` : 'Vehículo no especif.',
                                type: 'income'
                            });
                        }
                    }
                });
            });
        }

        // 2. Collect Expenses
        if (detailView === 'gastos' || detailView === 'balance' || detailView === 'ganancias') {
             gastos.forEach(g => {
                const date = new Date(g.fecha);
                if (date >= startDate && date <= endDate) {
                    transactions.push({
                        id: g.id,
                        date: date,
                        amount: g.monto,
                        description: g.descripcion,
                        subtext: 'Gasto registrado',
                        type: 'expense'
                    });
                }
             });
        }

        // Sort descending
        transactions.sort((a, b) => b.date.getTime() - a.date.getTime());

        // Calculate Total
        const total = transactions.reduce((sum, t) => {
            return t.type === 'income' ? sum + t.amount : sum - t.amount;
        }, 0);

        return { transactions, total };

    }, [detailView, trabajos, gastos, clientes, period]);

    const renderGastoRow = (gasto: Gasto) => (
        <div key={gasto.id} className="flex flex-col sm:flex-row sm:justify-between sm:items-center p-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-lg gap-2 border-b dark:border-gray-700 last:border-0 sm:border-0">
            <div className="w-full sm:w-auto">
                <p className="font-medium text-taller-dark dark:text-taller-light">{gasto.descripcion}</p>
                <p className="text-sm text-taller-gray dark:text-gray-400">{new Date(gasto.fecha).toLocaleDateString('es-ES')}</p>
            </div>
            <div className="flex items-center justify-between w-full sm:w-auto gap-4">
                <p className="font-semibold text-red-600">{new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(gasto.monto)}</p>
                {confirmingDeleteGastoId === gasto.id ? (
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-red-600 hidden sm:inline">¿Seguro?</span>
                        <button 
                            onClick={() => handleDeleteGasto(gasto.id)}
                            className="px-2 py-1 text-xs font-bold text-white bg-red-600 rounded hover:bg-red-700"
                        >
                            Sí
                        </button>
                        <button 
                            onClick={() => setConfirmingDeleteGastoId(null)}
                            className="px-2 py-1 text-xs font-medium text-gray-700 bg-gray-200 dark:bg-gray-600 dark:text-gray-200 dark:hover:bg-gray-500 rounded"
                        >
                            No
                        </button>
                    </div>
                ) : (
                    <div className="flex gap-1">
                        <button onClick={() => setGastoToEdit(gasto)} className="text-taller-gray dark:text-gray-400 hover:text-taller-secondary dark:hover:text-white p-1 bg-gray-100 dark:bg-gray-700 sm:bg-transparent sm:dark:bg-transparent rounded"><PencilIcon className="h-4 w-4"/></button>
                        <button onClick={() => setConfirmingDeleteGastoId(gasto.id)} className="text-taller-gray dark:text-gray-400 hover:text-red-600 dark:hover:text-red-500 p-1 bg-gray-100 dark:bg-gray-700 sm:bg-transparent sm:dark:bg-transparent rounded"><TrashIcon className="h-4 w-4"/></button>
                    </div>
                )}
            </div>
        </div>
    );

    return (
        <div className="space-y-6 sm:space-y-8 pb-16">
            <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
                <h2 className="text-2xl font-bold text-taller-dark dark:text-taller-light">Resumen</h2>
                <div className="w-full md:w-auto">
                    {/* Reuse the scrollable filter here too, but centered/tight for desktop */}
                    <div className="flex items-center gap-2 overflow-x-auto flex-nowrap pb-2 scrollbar-hide">
                         <style>{`.scrollbar-hide::-webkit-scrollbar { display: none; } .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }`}</style>
                        {[
                            { label: 'Este mes', value: 'this_month' },
                            { label: 'Últimos 7 días', value: 'last_7_days' },
                            { label: 'Últimos 15 días', value: 'last_15_days' },
                            { label: 'Mes pasado', value: 'last_month' }
                        ].map(p => (
                            <button
                                key={p.value}
                                onClick={() => setPeriod(p.value as Period)}
                                className={`flex-shrink-0 px-3 py-1.5 text-xs sm:text-sm font-medium rounded-md transition-colors whitespace-nowrap ${
                                    period === p.value 
                                    ? 'bg-taller-primary text-white shadow' 
                                    : 'text-taller-gray dark:text-gray-300 hover:bg-taller-light dark:hover:bg-gray-700 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700'
                                }`}
                            >
                                {p.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>
            
            {/* Updated Grid: 2 columns on mobile (gap reduced), 3 on desktop */}
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6">
                <StatCard 
                    title="Ingresos Totales" 
                    value={stats.ingresosTotales} 
                    icon={<CurrencyDollarIcon />} 
                    color="bg-blue-500" 
                    onClick={() => setDetailView('ingresos')}
                />
                <StatCard 
                    title="Ganancia Neta (Real)" 
                    value={stats.gananciasNetas} 
                    icon={<ChartPieIcon />} 
                    color="bg-green-500" 
                    onClick={() => setDetailView('ganancias')}
                />
                <StatCard 
                    title="Gastos Fijos" 
                    value={stats.gastos} 
                    icon={<BuildingLibraryIcon />} 
                    color="bg-red-500" 
                    onClick={() => setDetailView('gastos')}
                />
                <StatCard 
                    title="Balance (Caja)" 
                    value={stats.balance} 
                    icon={<ScaleIcon />} 
                    color="bg-indigo-500" 
                    onClick={() => setDetailView('balance')}
                />
                <StatCard 
                    title="Trabajos Activos" 
                    value={stats.trabajosActivos} 
                    icon={<WrenchScrewdriverIcon />} 
                    color="bg-yellow-500" 
                    onClick={() => onNavigate('trabajos')}
                />
                <StatCard 
                    title="Total Clientes" 
                    value={stats.totalClientes} 
                    icon={<UsersIcon />} 
                    color="bg-purple-500" 
                    onClick={() => onNavigate('clientes')}
                />
            </div>

            <div ref={gastosSectionRef} className="bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-xl shadow-md scroll-mt-24">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-4 gap-4">
                    <h3 className="text-lg font-bold text-taller-dark dark:text-taller-light">Gastos Recientes</h3>
                    <button
                        onClick={() => setIsAddGastoModalOpen(true)}
                        className="flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-taller-primary rounded-lg shadow-md hover:bg-taller-secondary"
                    >
                        <PlusIcon className="h-5 w-5"/> Añadir Gasto
                    </button>
                </div>
                
                <div className="space-y-2">
                    {/* Lista del Mes Actual */}
                    {groupedGastos.thisMonth.length > 0 ? (
                        groupedGastos.thisMonth.map(renderGastoRow)
                    ) : (
                        !searchQuery && <p className="text-center text-sm text-taller-gray dark:text-gray-400 py-2">No hay gastos registrados este mes.</p>
                    )}

                    {/* Acordeón del Mes Pasado */}
                    {groupedGastos.lastMonth.length > 0 && !searchQuery && (
                        <div className="mt-4 border-t dark:border-gray-700 pt-2">
                            <button 
                                onClick={() => setIsLastMonthExpanded(!isLastMonthExpanded)}
                                className="w-full flex items-center justify-between p-2 text-sm font-medium text-taller-gray dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded transition-colors"
                            >
                                <span className="flex items-center gap-2">
                                    <CalendarIcon className="h-4 w-4" />
                                    Mes Pasado ({groupedGastos.lastMonth.length})
                                </span>
                                <ChevronDownIcon className={`h-4 w-4 transform transition-transform duration-200 ${isLastMonthExpanded ? 'rotate-180' : ''}`} />
                            </button>
                            
                            <div className={`grid transition-[grid-template-rows] duration-300 ease-out ${isLastMonthExpanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
                                <div className="overflow-hidden">
                                    <div className="pt-2">
                                        {groupedGastos.lastMonth.map(renderGastoRow)}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {groupedGastos.thisMonth.length === 0 && groupedGastos.lastMonth.length === 0 && (
                        <p className="text-center text-taller-gray dark:text-gray-400 py-4">No hay gastos registrados que coincidan con la búsqueda.</p>
                    )}
                </div>
            </div>

            {isAddGastoModalOpen && <AddGastoModal onClose={() => setIsAddGastoModalOpen(false)} onAddGasto={handleAddGasto} />}
            {gastoToEdit && <EditGastoModal gasto={gastoToEdit} onClose={() => setGastoToEdit(null)} onUpdateGasto={handleUpdateGasto} />}
            
            {/* Render Financial Detail Overlay if active */}
            {detailView && (
                <FinancialDetailOverlay
                    detailView={detailView}
                    onClose={() => setDetailView(null)}
                    period={period}
                    setPeriod={setPeriod}
                    data={financialDetailData}
                    gananciasNetasDisplay={stats.gananciasNetas}
                />
            )}
        </div>
    );
};

export default Dashboard;
