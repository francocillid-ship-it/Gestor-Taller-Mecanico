
import React, { useMemo, useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { Cliente, Trabajo, Gasto } from '../types';
import { JobStatus } from '../types';
import { CurrencyDollarIcon, UsersIcon, WrenchScrewdriverIcon, PlusIcon, PencilIcon, TrashIcon, ChartPieIcon, BuildingLibraryIcon, ScaleIcon, ChevronDownIcon, CalendarIcon, ArrowLeftIcon, ArrowTrendingUpIcon, ArrowTrendingDownIcon, ArrowTopRightOnSquareIcon } from '@heroicons/react/24/solid';
import AddGastoModal from './AddGastoModal';
import EditGastoModal from './EditGastoModal';
import { supabase } from '../supabaseClient';

interface DashboardProps {
    clientes: Cliente[];
    trabajos: Trabajo[];
    gastos: Gasto[];
    onDataRefresh: () => void;
    searchQuery: string;
    onNavigate: (view: 'dashboard' | 'trabajos' | 'clientes' | 'ajustes', jobStatus?: JobStatus, jobId?: string) => void;
}

interface StatCardProps {
    title: string;
    value: string | number;
    icon: React.ReactNode;
    color: string;
    onClick?: () => void;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, icon, color, onClick }) => (
    <div 
        onClick={onClick}
        className={`bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-xl shadow-md flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:space-x-4 h-full transform-gpu transition-all duration-300 ease-out select-none will-change-transform ${onClick ? 'cursor-pointer hover:shadow-lg hover:scale-[1.02] active:scale-[0.96]' : ''}`}
    >
        <div className={`p-2 sm:p-3 rounded-full ${color} shrink-0 shadow-sm`}>
            {React.isValidElement(icon) 
                ? React.cloneElement(icon as React.ReactElement<any>, { className: "h-5 w-5 sm:h-6 sm:w-6 text-white" }) 
                : icon
            }
        </div>
        <div className="min-w-0">
            <p className="text-xs sm:text-sm text-taller-gray dark:text-gray-400 truncate font-medium">{title}</p>
            <p className="text-lg sm:text-2xl font-bold text-taller-dark dark:text-taller-light truncate tracking-tight">{value}</p>
        </div>
    </div>
);

type Period = 'this_month' | 'last_7_days' | 'last_15_days' | 'last_month';
type DetailType = 'ingresos' | 'ganancias' | 'gastos' | 'balance' | null;

interface TransactionItem {
    id: string;
    referenceId: string; // The ID of the Job or Expense
    date: Date;
    description: string;
    amount: number;
    type: 'income' | 'expense';
    subtext?: string;
}

// --- Filter Controls Component (Horizontal Scroll) ---
const FilterControls = ({ activePeriod, setPeriodFn }: { activePeriod: Period, setPeriodFn: (p: Period) => void }) => (
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
                    ? 'bg-taller-primary text-white border-taller-primary shadow-md transform-gpu scale-105' 
                    : 'bg-white dark:bg-gray-800 text-taller-gray dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
            >
                {p.label}
            </button>
        ))}
    </div>
);

// --- Financial Detail Overlay Component (Extracted) ---
interface FinancialDetailOverlayProps {
    detailView: DetailType;
    onClose: () => void;
    period: Period;
    setPeriod: (p: Period) => void;
    data: { transactions: TransactionItem[], total: number };
    gananciasNetasDisplay: string;
    onItemClick: (item: TransactionItem) => void;
}

const FinancialDetailOverlay: React.FC<FinancialDetailOverlayProps> = ({ detailView, onClose, period, setPeriod, data, gananciasNetasDisplay, onItemClick }) => {
    const [isFilterVisible, setIsFilterVisible] = useState(true);
    const [isVisible, setIsVisible] = useState(false); // Controls CSS animation state
    const lastScrollTop = useRef(0);
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    // Entry animation on mount
    useEffect(() => {
        // Double RAF ensures the browser has painted the initial state (translate-y-full) before applying the transition
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                setIsVisible(true);
            });
        });
    }, []);

    // Intercept onClose to play exit animation first
    const handleClose = () => {
        setIsVisible(false);
        // Wait for the duration of the transition (500ms) before unmounting
        setTimeout(() => {
            onClose();
        }, 500);
    };

    const handleScroll = () => {
        if (!scrollContainerRef.current) return;
        
        const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;

        // OVERSCROLL PROTECTION
        if (scrollTop <= 0 || scrollTop + clientHeight >= scrollHeight) {
            return;
        }

        const diff = scrollTop - lastScrollTop.current;
        lastScrollTop.current = scrollTop;

        if (Math.abs(diff) < 10) return;

        const isNearBottom = scrollTop + clientHeight > scrollHeight - 100;
        if (isNearBottom) return;

        if (diff > 0 && scrollTop > 60 && isFilterVisible) {
            setIsFilterVisible(false);
        } else if (diff < 0 && !isFilterVisible) {
            setIsFilterVisible(true);
        }
    };

    if (!detailView) return null;

    const titleMap = {
        'ingresos': 'Historial de Ingresos',
        'gastos': 'Historial de Gastos',
        'balance': 'Balance (Flujo de Caja)',
        'ganancias': 'Detalle de Ganancia Real'
    };

    const isProfitView = detailView === 'ganancias';
    const displayTotal = isProfitView ? gananciasNetasDisplay : new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(data.total);

    return createPortal(
        <>
            {/* Backdrop Layer */}
            <div 
                className={`fixed inset-0 z-[99] bg-black/30 backdrop-blur-sm transition-opacity duration-500 ease-in-out ${isVisible ? 'opacity-100' : 'opacity-0'}`}
                onClick={handleClose}
                aria-hidden="true"
            />
            
            {/* Content Layer - Slides up from bottom */}
            <div 
                className={`fixed inset-0 z-[100] bg-taller-light dark:bg-taller-dark flex flex-col shadow-2xl transition-transform duration-500 will-change-transform ${isVisible ? 'translate-y-0' : 'translate-y-full'}`}
                style={{ transitionTimingFunction: 'cubic-bezier(0.32, 0.72, 0, 1)' }} // iOS-like fluid spring
            >
                {/* Header */}
                <div className="bg-white dark:bg-gray-800 shadow-sm flex-shrink-0 pt-[env(safe-area-inset-top)] border-b dark:border-gray-700 z-20 relative">
                    <div className="flex items-center justify-between p-4">
                        <button 
                            onClick={handleClose}
                            className="p-2 -ml-2 text-taller-gray dark:text-gray-400 hover:text-taller-dark dark:hover:text-white rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                        >
                            <ArrowLeftIcon className="h-6 w-6" />
                        </button>
                        <h2 className="text-lg font-bold text-taller-dark dark:text-taller-light">{titleMap[detailView]}</h2>
                        <div className="w-10"></div>
                    </div>
                </div>

                {/* Filter Section */}
                <div className={`bg-taller-light dark:bg-taller-dark z-10 flex-shrink-0 transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] overflow-hidden ${isFilterVisible ? 'max-h-[80px] opacity-100 translate-y-0' : 'max-h-0 opacity-0 -translate-y-4'}`}>
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
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm text-center mt-2 border dark:border-gray-700 transform-gpu">
                        <p className="text-sm text-taller-gray dark:text-gray-400 uppercase tracking-wide">Total {period === 'this_month' ? 'Este Mes' : period === 'last_7_days' ? '7 Días' : period === 'last_15_days' ? '15 Días' : 'Mes Pasado'}</p>
                        <p className={`text-4xl font-bold mt-2 ${data.total >= 0 ? 'text-taller-dark dark:text-taller-light' : 'text-red-600'}`}>
                            {displayTotal}
                        </p>
                        {isProfitView && (
                           <p className="text-xs text-taller-gray dark:text-gray-500 mt-2">
                               * Cálculo: Mano de Obra + Sobrantes de Repuestos.
                           </p>
                        )}
                    </div>

                    <div className="space-y-3 pb-24">
                         {data.transactions.length > 0 ? (
                            data.transactions.map((t, index) => (
                                <div 
                                    key={t.id} 
                                    onClick={() => onItemClick(t)}
                                    className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm flex items-center justify-between border-l-4 border-transparent hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer active:scale-[0.98] transition-all duration-300 animate-slide-in-bottom fill-mode-backwards group" 
                                    style={{ 
                                        borderLeftColor: t.type === 'income' ? '#22c55e' : '#ef4444',
                                        animationDelay: `${index * 50}ms` // Staggered list animation
                                    }}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={`p-2 rounded-full ${t.type === 'income' ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'}`}>
                                            {t.type === 'income' ? <ArrowTrendingUpIcon className="h-5 w-5" /> : <ArrowTrendingDownIcon className="h-5 w-5" />}
                                        </div>
                                        <div>
                                            <p className="font-bold text-taller-dark dark:text-taller-light text-sm flex items-center gap-1">
                                                {t.description}
                                                <ArrowTopRightOnSquareIcon className="h-3 w-3 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                                            </p>
                                            <p className="text-xs text-taller-gray dark:text-gray-400">{t.subtext}</p>
                                            <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">{t.date.toLocaleDateString('es-ES')} {t.date.toLocaleTimeString([], { hour: '2-digit', minute:'2-digit' })}</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className={`font-bold ${t.type === 'income' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                            {t.type === 'income' ? '+' : '-'} {new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(t.amount)}
                                        </p>
                                        {isProfitView && t.type === 'income' && (
                                            <p className="text-[10px] text-gray-400 italic">Neto Mano de Obra</p>
                                        )}
                                    </div>
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
            </div>
        </>,
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
    
    const gastosSectionRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (searchQuery && gastosSectionRef.current) {
            gastosSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }, [searchQuery]);
    
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

        const filteredGastos = gastos.filter(g => {
            const gastoDate = new Date(g.fecha);
            return gastoDate >= startDate && gastoDate <= endDate;
        });
        const totalGastos = filteredGastos.reduce((sum, g) => sum + g.monto, 0);

        let ingresosTotales = 0;
        let gananciaManoDeObraReal = 0; 

        trabajos.forEach(trabajo => {
            // Calcular el costo de repuestos que asume el taller (NO pagados por el cliente)
            const parts = trabajo.partes.filter(p => p.nombre !== '__PAGO_REGISTRADO__');
            const costoRepuestosTaller = parts
                .filter(p => !p.isService && !p.isCategory && !p.clientPaidDirectly)
                .reduce((sum, p) => sum + (p.cantidad * p.precioUnitario), 0);

            // Obtener todos los pagos registrados cronológicamente
            const todosLosPagos = trabajo.partes
                .filter(p => p.nombre === '__PAGO_REGISTRADO__')
                .sort((a, b) => new Date(a.fecha || 0).getTime() - new Date(b.fecha || 0).getTime());

            let partsCostCoveredSoFar = 0;

            todosLosPagos.forEach(pago => {
                const monto = pago.precioUnitario;
                const fechaPago = pago.fecha ? new Date(pago.fecha) : new Date(0);
                const esDelPeriodo = fechaPago >= startDate && fechaPago <= endDate;
                const type = pago.paymentType; // 'items' | 'labor' | undefined

                if (type === 'labor') {
                    // Si el pago es explícitamente "Mano de Obra", es 100% ganancia
                    if (esDelPeriodo) {
                        ingresosTotales += monto;
                        gananciaManoDeObraReal += monto;
                    }
                } else {
                    // Caso 'items' (Repuestos) o 'undefined' (General)
                    // Lógica de desbordamiento: Todo lo que supere el costo restante de repuestos se va a ganancia
                    // Esto arregla el caso donde el pago de repuestos es mayor al costo real
                    
                    const remainingPartsCost = Math.max(0, costoRepuestosTaller - partsCostCoveredSoFar);
                    const contributionToParts = Math.min(monto, remainingPartsCost);
                    
                    // Si el pago es 'items', la intención es cubrir costo, pero si sobra, es ganancia.
                    // Si es 'general', misma lógica.
                    const contributionToLabor = monto - contributionToParts;

                    partsCostCoveredSoFar += contributionToParts;

                    if (esDelPeriodo) {
                        ingresosTotales += monto;
                        gananciaManoDeObraReal += contributionToLabor;
                    }
                }
            });
        });

        const gananciaNeta = gananciaManoDeObraReal - totalGastos;
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

    const handleTransactionClick = (item: TransactionItem) => {
        if (item.type === 'income') {
            // It's a job. Navigate to Trabajos view and highlight/open the job
            // First we close the overlay
            setDetailView(null);
            
            // Find the job status to switch to the correct tab if possible
            const job = trabajos.find(t => t.id === item.referenceId);
            const status = job ? job.status : undefined;
            
            onNavigate('trabajos', status, item.referenceId);
        } else if (item.type === 'expense') {
            // It's an expense. Close overlay and open edit modal
            const gasto = gastos.find(g => g.id === item.referenceId);
            if (gasto) {
                setDetailView(null);
                setGastoToEdit(gasto);
            }
        }
    };

    const groupedGastos = useMemo(() => {
        let filtered = [...gastos];
        
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            filtered = filtered.filter(g => 
                g.descripcion.toLowerCase().includes(query) || 
                g.monto.toString().includes(query)
            );
        }

        filtered.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());

        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();

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
            else if (searchQuery) {
                thisMonth.push(g);
            }
        });

        return { thisMonth, lastMonth };
    }, [gastos, searchQuery]);

    const financialDetailData = useMemo(() => {
        if (!detailView) return { transactions: [], total: 0 };
        
        const { startDate, endDate } = getPeriodDates(period);
        const transactions: TransactionItem[] = [];

        if (detailView === 'ingresos' || detailView === 'balance' || detailView === 'ganancias') {
            trabajos.forEach(t => {
                const parts = t.partes.filter(p => p.nombre !== '__PAGO_REGISTRADO__');
                const costoRepuestosTaller = parts
                    .filter(p => !p.isService && !p.isCategory && !p.clientPaidDirectly)
                    .reduce((sum, p) => sum + (p.cantidad * p.precioUnitario), 0);

                const pagosOrdenados = t.partes
                    .filter(p => p.nombre === '__PAGO_REGISTRADO__')
                    .sort((a, b) => new Date(a.fecha || 0).getTime() - new Date(b.fecha || 0).getTime());
                
                let partsCostCoveredSoFar = 0;

                pagosOrdenados.forEach((p, idx) => {
                    const date = p.fecha ? new Date(p.fecha) : new Date(0);
                    const amount = p.precioUnitario;
                    const type = p.paymentType;
                    
                    let profitPortion = 0;
                    
                    // Calcular la porción de ganancia igual que en 'stats'
                    if (type === 'labor') {
                        profitPortion = amount;
                    } else {
                        const remainingPartsCost = Math.max(0, costoRepuestosTaller - partsCostCoveredSoFar);
                        const contributionToParts = Math.min(amount, remainingPartsCost);
                        profitPortion = amount - contributionToParts;
                        partsCostCoveredSoFar += contributionToParts;
                    }

                    // Definir qué monto mostrar según la vista
                    let amountToReport = 0;
                    let shouldReport = false;

                    if (detailView === 'ganancias') {
                        amountToReport = profitPortion;
                        shouldReport = amountToReport > 0; // Solo mostrar si hay ganancia
                    } else {
                        // Para 'ingresos' y 'balance' (flujo de caja), mostramos el monto total del pago, no solo la ganancia
                        amountToReport = amount;
                        shouldReport = true; 
                    }

                    if (shouldReport && date >= startDate && date <= endDate) {
                        const cliente = clientes.find(c => c.id === t.clienteId);
                        const vehiculo = cliente?.vehiculos.find(v => v.id === t.vehiculoId);
                        transactions.push({
                            id: `${t.id}_pago_${idx}`,
                            referenceId: t.id, // Store real job ID
                            date: date,
                            amount: amountToReport,
                            description: `Pago de ${cliente ? cliente.nombre : 'Cliente'}`,
                            subtext: vehiculo ? `${vehiculo.marca} ${vehiculo.modelo}` : 'Vehículo no especif.',
                            type: 'income'
                        });
                    }
                });
            });
        }

        if (detailView === 'gastos' || detailView === 'balance' || detailView === 'ganancias') {
             gastos.forEach(g => {
                const date = new Date(g.fecha);
                if (date >= startDate && date <= endDate) {
                    transactions.push({
                        id: g.id,
                        referenceId: g.id, // Store real expense ID
                        date: date,
                        amount: g.monto,
                        description: g.descripcion,
                        subtext: 'Gasto registrado',
                        type: 'expense'
                    });
                }
             });
        }

        transactions.sort((a, b) => b.date.getTime() - a.date.getTime());

        const total = transactions.reduce((sum, t) => {
            return t.type === 'income' ? sum + t.amount : sum - t.amount;
        }, 0);

        return { transactions, total };

    }, [detailView, trabajos, gastos, clientes, period]);

    const renderGastoRow = (gasto: Gasto) => (
        <div key={gasto.id} className="flex flex-col sm:flex-row sm:justify-between sm:items-center p-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-lg gap-2 border-b dark:border-gray-700 last:border-0 sm:border-0 transition-colors">
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
            
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6">
                <StatCard 
                    title="Ingresos Totales" 
                    value={stats.ingresosTotales} 
                    icon={<CurrencyDollarIcon />} 
                    color="bg-blue-500" 
                    onClick={() => setDetailView('ingresos')}
                />
                <StatCard 
                    title="Ganancia" 
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
                    onClick={() => onNavigate('trabajos', JobStatus.EnProceso)}
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
                        className="flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-taller-primary rounded-lg shadow-md hover:bg-taller-secondary transition-colors"
                    >
                        <PlusIcon className="h-5 w-5"/> Añadir Gasto
                    </button>
                </div>
                
                <div className="space-y-2">
                    {groupedGastos.thisMonth.length > 0 ? (
                        groupedGastos.thisMonth.map(renderGastoRow)
                    ) : (
                        !searchQuery && <p className="text-center text-sm text-taller-gray dark:text-gray-400 py-2">No hay gastos registrados este mes.</p>
                    )}

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
            
            {detailView && (
                <FinancialDetailOverlay
                    detailView={detailView}
                    onClose={() => setDetailView(null)}
                    period={period}
                    setPeriod={setPeriod}
                    data={financialDetailData}
                    gananciasNetasDisplay={stats.gananciasNetas}
                    onItemClick={handleTransactionClick}
                />
            )}
        </div>
    );
};

export default Dashboard;
