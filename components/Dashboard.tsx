import React, { useMemo, useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { Cliente, Trabajo, Gasto } from '../types';
import { JobStatus } from '../types';
import { CurrencyDollarIcon, UsersIcon, WrenchScrewdriverIcon, ChartPieIcon, BuildingLibraryIcon, ChevronDownIcon, CalendarIcon, ArrowTrendingUpIcon, ArrowTrendingDownIcon, ClipboardDocumentCheckIcon, XMarkIcon, PlusIcon } from '@heroicons/react/24/solid';
import AddGastoModal from './AddGastoModal';
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
    onNavigate?: () => void;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, icon, color, onClick, onNavigate }) => (
    <div
        onClick={onClick || onNavigate}
        className={`bg-white/40 dark:bg-gray-800/40 backdrop-blur-md border border-white/20 dark:border-gray-700/30 p-4 sm:p-6 rounded-2xl shadow-md flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:space-x-4 h-full transform-gpu transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] select-none will-change-transform ${(onClick || onNavigate) ? 'cursor-pointer hover:shadow-lg hover:scale-[1.04] active:scale-[0.96]' : ''}`}
    >
        <div className={`p-2 sm:p-3 rounded-xl ${color} shrink-0 shadow-sm`}>
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

type Period = string;
type DetailType = 'ingresos' | 'ganancias' | 'gastos' | null;

interface TransactionItem {
    id: string;
    referenceId: string;
    date: Date;
    description: string;
    amount: number;
    type: 'income' | 'expense';
    subtext?: string;
}

const MonthPickerPortal = ({
    isOpen,
    onClose,
    availableMonths,
    activePeriod,
    onSelect,
    anchorRect
}: {
    isOpen: boolean,
    onClose: () => void,
    availableMonths: { label: string, value: string }[],
    activePeriod: Period,
    onSelect: (p: Period) => void,
    anchorRect: DOMRect | null
}) => {
    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 z-[200] flex items-center justify-center sm:block">
            <div className="fixed inset-0 bg-black/40 backdrop-blur-sm transition-opacity animate-in fade-in duration-300" onClick={onClose} />
            <div
                className="relative w-[95%] max-w-[280px] sm:absolute bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border-none overflow-hidden animate-in zoom-in-95 fade-in duration-200"
                style={anchorRect && window.innerWidth > 640 ? (() => {
                    const spaceAbove = anchorRect.top;
                    const spaceBelow = window.innerHeight - anchorRect.bottom;
                    const menuHeight = 320;
                    const showBelow = spaceBelow > spaceAbove || spaceAbove < menuHeight;
                    return {
                        top: showBelow ? anchorRect.bottom + 8 : 'auto',
                        bottom: showBelow ? 'auto' : window.innerHeight - anchorRect.top + 8,
                        left: Math.max(16, Math.min(anchorRect.left, window.innerWidth - 296))
                    };
                })() : {}}
            >
                <div className="flex items-center justify-between px-4 py-3 border-none bg-gray-50 dark:bg-gray-900/50">
                    <span className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Seleccionar Mes</span>
                    <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600"><XMarkIcon className="h-5 w-5" /></button>
                </div>
                <div className="max-h-[60svh] sm:max-h-64 overflow-y-auto py-1">
                    {availableMonths.length > 0 ? (
                        availableMonths.map(m => (
                            <button
                                key={m.value}
                                onClick={() => {
                                    onSelect(m.value);
                                    onClose();
                                }}
                                className={`w-full text-left px-5 py-4 sm:py-3 text-sm hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors border-none capitalize ${activePeriod === m.value ? 'text-taller-primary font-bold bg-blue-50 dark:bg-blue-900/20' : 'text-taller-dark dark:text-taller-light'}`}
                            >
                                {m.label}
                            </button>
                        ))
                    ) : (
                        <p className="px-4 py-8 text-sm text-gray-400 italic text-center">No hay registros previos.</p>
                    )}
                </div>
            </div>
        </div>,
        document.body
    );
};

const FilterControls = ({
    activePeriod,
    setPeriodFn,
    availableMonths
}: {
    activePeriod: Period,
    setPeriodFn: (p: Period) => void,
    availableMonths: { label: string, value: string }[]
}) => {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const buttonRef = useRef<HTMLButtonElement>(null);
    const [rect, setRect] = useState<DOMRect | null>(null);

    const handleOpenMenu = () => {
        if (buttonRef.current) {
            setRect(buttonRef.current.getBoundingClientRect());
        }
        setIsMenuOpen(true);
    };

    const isSpecificMonthActive = activePeriod.includes('-');

    return (
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
                    onClick={() => setPeriodFn(p.value)}
                    className={`flex-shrink-0 px-4 py-2 text-xs sm:text-sm font-medium rounded-full transition-all border whitespace-nowrap ${activePeriod === p.value
                        ? 'bg-taller-primary text-white border-taller-primary shadow-md transform-gpu scale-105'
                        : 'bg-white dark:bg-gray-800 text-taller-gray dark:text-gray-300 border-none hover:bg-gray-50 dark:hover:bg-gray-700'
                        }`}
                >
                    {p.label}
                </button>
            ))}

            {isSpecificMonthActive && (
                <button
                    className="flex-shrink-0 px-4 py-2 text-xs sm:text-sm font-bold rounded-full bg-taller-primary text-white border-taller-primary shadow-md transform-gpu scale-105 whitespace-nowrap animate-in fade-in zoom-in duration-300 capitalize"
                >
                    {new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric' }).format(new Date(activePeriod + '-02'))}
                </button>
            )}

            <button
                ref={buttonRef}
                onClick={handleOpenMenu}
                className={`flex-shrink-0 flex items-center gap-1.5 px-4 py-2 text-xs sm:text-sm font-medium rounded-full transition-all border whitespace-nowrap ${isMenuOpen
                    ? 'bg-gray-100 dark:bg-gray-700 border-taller-primary text-taller-primary'
                    : 'bg-white dark:bg-gray-800 text-taller-gray dark:text-gray-300 border-none hover:bg-gray-50'
                    }`}
            >
                <CalendarIcon className="h-4 w-4" />
                <span>Seleccionar Mes</span>
                <ChevronDownIcon className={`h-3 w-3 transition-transform ${isMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            <MonthPickerPortal
                isOpen={isMenuOpen}
                onClose={() => setIsMenuOpen(false)}
                availableMonths={availableMonths}
                activePeriod={activePeriod}
                onSelect={setPeriodFn}
                anchorRect={rect}
            />
        </div>
    );
};

interface FinancialDetailOverlayProps {
    detailView: DetailType;
    onClose: () => void;
    period: Period;
    data: { transactions: TransactionItem[], total: number };
    onItemClick: (item: TransactionItem) => void;
    onAddGasto: () => void;
}

const FinancialDetailOverlay: React.FC<FinancialDetailOverlayProps> = ({
    detailView, onClose, period, data, onItemClick, onAddGasto
}) => {
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        setIsVisible(true);
    }, []);

    const handleClose = () => {
        setIsVisible(false);
        setTimeout(onClose, 400);
    };

    const formatCurrency = (amount: number) => 
        new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(amount);

    const titles = {
        ingresos: 'Detalle de Ingresos',
        ganancias: 'Detalle de Ganancias',
        gastos: 'Detalle de Gastos'
    };

    const colors = {
        ingresos: 'text-emerald-500',
        ganancias: 'text-taller-primary',
        gastos: 'text-rose-500'
    };

    const periodLabels: Record<string, string> = {
        this_month: 'Este Mes',
        last_7_days: 'Últimos 7 Días',
        last_15_days: 'Últimos 15 Días',
        last_month: 'Mes Pasado'
    };

    const getPeriodLabel = (p: string) => {
        if (p.includes('-')) {
            return new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric' }).format(new Date(p + '-02'));
        }
        return periodLabels[p] || p;
    };

    const totalAmount = detailView === 'ganancias' 
        ? data.transactions.reduce((sum, t) => sum + t.amount, 0)
        : Math.abs(data.total);

    return createPortal(
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 sm:p-6">
            <div className={`absolute inset-0 bg-black/60 backdrop-blur-md transition-opacity duration-400 ${isVisible ? 'opacity-100' : 'opacity-0'}`} onClick={handleClose} />
            <div className={`relative w-full max-w-2xl bg-white dark:bg-gray-900 rounded-[2.5rem] shadow-2xl border border-white/10 overflow-hidden transform transition-all duration-400 ease-[cubic-bezier(0.16,1,0.3,1)] ${isVisible ? 'translate-x-0' : 'translate-x-full'}`}>
                <div className="p-8 border-b dark:border-gray-800 flex items-center justify-between">
                    <div>
                        <h2 className="text-2xl font-black text-taller-dark dark:text-taller-light tracking-tight capitalize">{titles[detailView as 'ingresos' | 'ganancias' | 'gastos']}</h2>
                        <p className="text-taller-gray dark:text-gray-400 font-medium capitalize">{getPeriodLabel(period)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                        {detailView === 'gastos' && (
                            <button 
                                onClick={onAddGasto} 
                                className="flex items-center gap-1.5 px-4 py-2 bg-taller-primary text-white font-bold text-xs rounded-xl shadow-md active:scale-95 transition-all whitespace-nowrap"
                            >
                                <PlusIcon className="h-4 w-4" /> Añadir Gasto
                            </button>
                        )}
                        <button onClick={handleClose} className="p-3 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-2xl transition-colors">
                            <XMarkIcon className="h-6 w-6 text-taller-gray" />
                        </button>
                    </div>
                </div>

                <div className="p-8 space-y-8 max-h-[70svh] overflow-y-auto">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <div className="bg-gray-50 dark:bg-gray-800/50 p-6 rounded-3xl border border-gray-100 dark:border-gray-700">
                            <span className="text-xs font-black text-taller-gray uppercase tracking-widest block mb-2">Total Acumulado</span>
                            <div className={`text-3xl font-black font-mono ${colors[detailView as 'ingresos' | 'ganancias' | 'gastos']}`}>
                                {formatCurrency(totalAmount)}
                            </div>
                        </div>
                        <div className="bg-gray-50 dark:bg-gray-800/50 p-6 rounded-3xl border border-gray-100 dark:border-gray-700">
                            <span className="text-xs font-black text-taller-gray uppercase tracking-widest block mb-2">Movimientos</span>
                            <div className="text-3xl font-black font-mono text-taller-gray dark:text-gray-400">
                                {data.transactions.length}
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <h3 className="text-sm font-black text-taller-gray uppercase tracking-widest">Movimientos del Período</h3>
                        <div className="space-y-2">
                            {data.transactions.length > 0 ? data.transactions.map((t, idx) => (
                                <div 
                                    key={`${t.id}-${idx}`} 
                                    onClick={() => onItemClick(t)}
                                    className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 group hover:border-taller-primary/30 transition-all cursor-pointer"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className={`p-2 rounded-xl ${t.type === 'income' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400' : 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400'}`}>
                                            {t.type === 'income' ? <ArrowTrendingUpIcon className="h-4 w-4" /> : <ArrowTrendingDownIcon className="h-4 w-4" />}
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-taller-dark dark:text-taller-light">{t.description}</p>
                                            <p className="text-[10px] text-taller-gray font-bold uppercase">{t.subtext || new Date(t.date).toLocaleDateString()}</p>
                                        </div>
                                    </div>
                                    <div className={`text-sm font-black font-mono ${t.type === 'income' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                                        {t.type === 'income' ? '+' : '-'}{formatCurrency(t.amount)}
                                    </div>
                                </div>
                            )) : (
                                <div className="text-center py-12 text-taller-gray italic font-medium">No hay registros en este período.</div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};

const Dashboard: React.FC<DashboardProps> = ({ clientes, trabajos, gastos, searchQuery, onNavigate, onDataRefresh }) => {
    const [period, setPeriod] = useState<Period>('this_month');
    const [detailView, setDetailView] = useState<DetailType>(null);
    const [isAddGastoModalOpen, setIsAddGastoModalOpen] = useState(false);

    const handleAddGasto = async (gasto: Omit<Gasto, 'id' | 'tallerId'>) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data: taller } = await supabase.from('talleres').select('id').eq('owner_id', user.id).single();
        if (!taller) return;
        const gastoId = crypto.randomUUID();
        const gastosConId = [{
            id: gastoId,
            taller_id: taller.id,
            descripcion: gasto.descripcion,
            monto: gasto.monto,
            fecha: gasto.fecha,
            categoria: gasto.categoria,
            es_fijo: gasto.esFijo
        }];
        const { error } = await supabase.from('gastos').insert(gastosConId);
        if (error) console.error("Error adding expense:", error);
        else { onDataRefresh(); setIsAddGastoModalOpen(false); }
    };

    const availableMonths = useMemo(() => {
        const months = new Set<string>();
        gastos.forEach(g => {
            const d = new Date(g.fecha);
            months.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
        });
        trabajos.forEach(t => {
            t.partes.forEach(p => {
                if (p.nombre === '__PAGO_REGISTRADO__' && p.fecha) {
                    const d = new Date(p.fecha);
                    months.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
                }
            });
        });
        return Array.from(months)
            .sort()
            .reverse()
            .map(m => ({
                label: new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric' }).format(new Date(m + '-02')),
                value: m
            }));
    }, [gastos, trabajos]);

    const getPeriodDates = (selectedPeriod: Period) => {
        const now = new Date();
        let startDate = new Date();
        let endDate = new Date(now);

        if (selectedPeriod.includes('-')) {
            const [year, month] = selectedPeriod.split('-').map(Number);
            startDate = new Date(year, month - 1, 1);
            endDate = new Date(year, month, 0);
        } else {
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

        const trabajosFinalizados = trabajos.filter(t => {
            if (t.status !== JobStatus.Finalizado) return false;
            const finishDate = t.fechaSalida ? new Date(t.fechaSalida) : new Date(t.fechaEntrada);
            return finishDate >= startDate && finishDate <= endDate;
        }).length;

        trabajos.forEach(trabajo => {
            const parts = trabajo.partes.filter(p => p.nombre !== '__PAGO_REGISTRADO__');
            const costoRepuestosTaller = parts
                .filter(p => !p.isService && !p.isCategory && !p.clientPaidDirectly)
                .reduce((sum, p) => sum + (p.cantidad * p.precioUnitario), 0);

            const todosLosPagos = trabajo.partes
                .filter(p => p.nombre === '__PAGO_REGISTRADO__')
                .sort((a, b) => new Date(a.fecha || 0).getTime() - new Date(b.fecha || 0).getTime());

            let partsCostCoveredSoFar = 0;

            todosLosPagos.forEach(pago => {
                const monto = pago.precioUnitario;
                const fechaPago = pago.fecha ? new Date(pago.fecha) : new Date(0);
                const esDelPeriodo = fechaPago >= startDate && fechaPago <= endDate;
                const type = pago.paymentType;

                if (type === 'labor') {
                    if (esDelPeriodo) {
                        ingresosTotales += monto;
                        gananciaManoDeObraReal += monto;
                    }
                } else {
                    const remainingPartsCost = Math.max(0, costoRepuestosTaller - partsCostCoveredSoFar);
                    const contributionToParts = Math.min(monto, remainingPartsCost);
                    const profitPortion = monto - contributionToParts;
                    partsCostCoveredSoFar += contributionToParts;

                    if (esDelPeriodo) {
                        ingresosTotales += monto;
                        if (profitPortion > 0) {
                            gananciaManoDeObraReal += profitPortion;
                        }
                    }
                }
            });
        });

        const trabajosActivos = trabajos.filter(t => t.status === JobStatus.EnProceso || t.status === JobStatus.Programado).length;

        return {
            ingresosTotales: formatCurrency(ingresosTotales),
            gananciasNetas: formatCurrency(gananciaManoDeObraReal),
            gastos: formatCurrency(totalGastos),
            trabajosFinalizados,
            trabajosActivos,
            totalClientes: clientes.length
        };
    }, [period, trabajos, gastos, clientes]);

    const handleTransactionClick = (item: TransactionItem) => {
        if (item.type === 'income') {
            setDetailView(null);
            const job = trabajos.find(t => t.id === item.referenceId);
            const status = job ? job.status : undefined;
            onNavigate('trabajos', status, item.referenceId);
        }
    };

    const financialDetailData = useMemo(() => {
        if (!detailView) return { transactions: [], total: 0 };
        const { startDate, endDate } = getPeriodDates(period);
        const transactions: TransactionItem[] = [];

        if (detailView === 'ingresos' || detailView === 'ganancias') {
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
                    if (type === 'labor') profitPortion = amount;
                    else {
                        const remainingPartsCost = Math.max(0, costoRepuestosTaller - partsCostCoveredSoFar);
                        const contributionToParts = Math.min(amount, remainingPartsCost);
                        profitPortion = amount - contributionToParts;
                        partsCostCoveredSoFar += contributionToParts;
                    }
                    const amountToReport = detailView === 'ganancias' ? profitPortion : amount;
                    const shouldReport = detailView === 'ganancias' ? amountToReport > 0 : true;
                    if (shouldReport && date >= startDate && date <= endDate) {
                        const cliente = clientes.find(c => c.id === t.clienteId);
                        const vehiculo = cliente?.vehiculos.find(v => v.id === t.vehiculoId);
                        transactions.push({ id: `${t.id}_pago_${idx}`, referenceId: t.id, date: date, amount: amountToReport, description: `Pago de ${cliente ? cliente.nombre : 'Cliente'}`, subtext: vehiculo ? `${vehiculo.marca} ${vehiculo.modelo}` : 'Vehículo no especif.', type: 'income' });
                    }
                });
            });
        }
        if (detailView === 'gastos') {
            gastos.forEach(g => {
                const date = new Date(g.fecha);
                if (date >= startDate && date <= endDate) transactions.push({ id: g.id, referenceId: g.id, date: date, amount: g.monto, description: g.descripcion, subtext: 'Gasto registrado', type: 'expense' });
            });
        }
        transactions.sort((a, b) => b.date.getTime() - a.date.getTime());
        const total = transactions.reduce((sum, t) => t.type === 'income' ? sum + t.amount : sum - t.amount, 0);
        return { transactions, total };
    }, [detailView, trabajos, gastos, clientes, period]);

    return (
        <div className="space-y-6 sm:space-y-8">
            <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
                <h2 className="text-2xl font-bold text-taller-dark dark:text-taller-light">Resumen</h2>
                <div className="w-full md:w-auto">
                    <FilterControls activePeriod={period} setPeriodFn={setPeriod} availableMonths={availableMonths} />
                </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6">
                <StatCard title="Ingresos Totales" value={stats.ingresosTotales} icon={<CurrencyDollarIcon />} color="bg-blue-500" onClick={() => setDetailView('ingresos')} />
                <StatCard title="Ganancia" value={stats.gananciasNetas} icon={<ChartPieIcon />} color="bg-green-500" onClick={() => setDetailView('ganancias')} />
                <StatCard title="Gastos Fijos" value={stats.gastos} icon={<BuildingLibraryIcon />} color="bg-red-500" onClick={() => setDetailView('gastos')} />
                <StatCard title="Trabajos Finalizados" value={stats.trabajosFinalizados} icon={<ClipboardDocumentCheckIcon />} color="bg-indigo-500" onNavigate={() => onNavigate('trabajos', JobStatus.Finalizado)} />
                <StatCard title="Trabajos Activos" value={stats.trabajosActivos} icon={<WrenchScrewdriverIcon />} color="bg-yellow-500" onNavigate={() => onNavigate('trabajos', JobStatus.EnProceso)} />
                <StatCard title="Total Clientes" value={stats.totalClientes} icon={<UsersIcon />} color="bg-purple-500" onNavigate={() => onNavigate('clientes')} />
            </div>

            {detailView && (
                <FinancialDetailOverlay
                    detailView={detailView}
                    onClose={() => setDetailView(null)}
                    period={period}
                    data={financialDetailData}
                    onItemClick={handleTransactionClick}
                    onAddGasto={() => setIsAddGastoModalOpen(true)}
                />
            )}

            {isAddGastoModalOpen && createPortal(
                <AddGastoModal onClose={() => setIsAddGastoModalOpen(false)} onAddGasto={handleAddGasto} />,
                document.body
            )}
        </div>
    );
};

export default Dashboard;
