
import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
    TrendingUp,
    TrendingDown,
    DollarSign,
    PieChart as PieChartIcon,
    BarChart3,
    Calendar,
    Plus,
    Filter,
    Download,
    ArrowUpRight,
    ArrowDownRight,
    Wallet,
    Tag,
    Calculator,
    X,
    ChevronRight,
    ArrowUp,
    ArrowDown,
    ChevronLeft
} from 'lucide-react';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Cell,
    PieChart,
    Pie
} from 'recharts';
import type { Cliente, Trabajo, Gasto } from '../types';
import { JobStatus } from '../types';
import AddGastoModal from './AddGastoModal';
import EditGastoModal from './EditGastoModal';
import { supabase } from '../supabaseClient';

interface FinanzasProps {
    clientes: Cliente[];
    trabajos: Trabajo[];
    gastos: Gasto[];
    onDataRefresh?: () => void;
}

const CATEGORIAS_GASTO = {
    Sueldos: { label: 'Sueldos', color: '#ec4899' },
    Alquiler: { label: 'Alquiler', color: '#6366f1' },
    Impuestos: { label: 'Impuestos', color: '#f59e0b' },
    Servicios: { label: 'Servicios', color: '#10b981' },
    Repuestos: { label: 'Repuestos', color: '#ef4444' },
    Herramientas: { label: 'Herramientas', color: '#8b5cf6' },
    Marketing: { label: 'Marketing', color: '#06b6d4' },
    Otros: { label: 'Otros', color: '#94a3b8' },
};

const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-AR', {
        style: 'currency',
        currency: 'ARS',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(amount);
};

const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        const data = payload[0].payload;
        return (
            <div className="bg-white dark:bg-gray-800 p-3 rounded-xl shadow-xl border border-gray-100 dark:border-gray-700 min-w-[150px]">
                <p className="text-sm font-bold text-taller-dark dark:text-taller-light capitalize mb-2 border-b dark:border-gray-700 pb-1">
                    {data.fullName || label}
                </p>
                {payload.map((entry: any, index: number) => (
                    <div key={index} className="flex items-center justify-between gap-4 py-0.5">
                        <span className="text-xs text-taller-gray capitalize">{entry.name}:</span>
                        <span className="text-xs font-bold" style={{ color: entry.color || entry.fill }}>
                            {formatCurrency(entry.value)}
                        </span>
                    </div>
                ))}
            </div>
        );
    }
    return null;
};

// Componente para el detalle de la tarjeta
const FinanceDetailOverlay = ({
    type,
    onClose,
    currentData,
    prevData,
    periodLabel,
    transactions
}: {
    type: 'ingresos' | 'egresos' | 'balance' | 'margen',
    onClose: () => void,
    currentData: number,
    prevData: number,
    periodLabel: string,
    transactions: { date: Date, desc: string, amount: number, type: 'plus' | 'minus' }[]
}) => {
    const diff = currentData - prevData;
    const percent = prevData !== 0 ? (diff / Math.abs(prevData)) * 100 : 100;
    const isPositive = diff >= 0;

    const titles = {
        ingresos: 'Detalle de Ingresos',
        egresos: 'Detalle de Egresos',
        balance: 'Balance Neto',
        margen: 'Margen de Rentabilidad'
    };

    const colors = {
        ingresos: 'text-emerald-500',
        egresos: 'text-rose-500',
        balance: 'text-taller-primary',
        margen: 'text-violet-500'
    };

    return createPortal(
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 sm:p-6">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-md animate-in fade-in duration-300" onClick={onClose} />
            <div className="relative w-full max-w-2xl bg-white dark:bg-gray-900 rounded-[2.5rem] shadow-2xl border border-white/10 overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-10 duration-500">
                <div className="p-8 border-b dark:border-gray-800 flex items-center justify-between">
                    <div>
                        <h2 className="text-2xl font-black text-taller-dark dark:text-taller-light tracking-tight">{titles[type]}</h2>
                        <p className="text-taller-gray dark:text-gray-400 font-medium">{periodLabel}</p>
                    </div>
                    <button onClick={onClose} className="p-3 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-2xl transition-colors">
                        <X className="h-6 w-6 text-taller-gray" />
                    </button>
                </div>

                <div className="p-8 space-y-8 max-h-[70svh] overflow-y-auto">
                    {/* Comparación */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <div className="bg-gray-50 dark:bg-gray-800/50 p-6 rounded-3xl border border-gray-100 dark:border-gray-700">
                            <span className="text-xs font-black text-taller-gray uppercase tracking-widest block mb-2">Este Período</span>
                            <div className={`text-3xl font-black font-mono ${colors[type]}`}>
                                {type === 'margen' ? `${currentData.toFixed(1)}%` : formatCurrency(currentData)}
                            </div>
                        </div>
                        <div className="bg-gray-50 dark:bg-gray-800/50 p-6 rounded-3xl border border-gray-100 dark:border-gray-700">
                            <span className="text-xs font-black text-taller-gray uppercase tracking-widest block mb-2">Período Anterior</span>
                            <div className="text-2xl font-black font-mono text-taller-gray dark:text-gray-400">
                                {type === 'margen' ? `${prevData.toFixed(1)}%` : formatCurrency(prevData)}
                            </div>
                            <div className={`flex items-center gap-1 mt-2 text-sm font-bold ${isPositive ? (type === 'egresos' ? 'text-rose-500' : 'text-emerald-500') : (type === 'egresos' ? 'text-emerald-500' : 'text-rose-500')}`}>
                                {isPositive ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
                                {Math.abs(percent).toFixed(1)}% vs mes anterior
                            </div>
                        </div>
                    </div>

                    {/* Transacciones */}
                    <div className="space-y-4">
                        <h3 className="text-sm font-black text-taller-gray uppercase tracking-widest">Movimientos del Período</h3>
                        <div className="space-y-2">
                            {transactions.length > 0 ? transactions.map((t, i) => (
                                <div key={`${t.type}-${t.amount}-${t.date.getTime()}-${i}`} className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 group hover:border-taller-primary/30 transition-all">
                                    <div className="flex items-center gap-4">
                                        <div className={`p-2 rounded-xl ${t.type === 'plus' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400' : 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400'}`}>
                                            {t.type === 'plus' ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-taller-dark dark:text-taller-light">{t.desc}</p>
                                            <p className="text-[10px] text-taller-gray font-bold uppercase">{t.date.toLocaleDateString()}</p>
                                        </div>
                                    </div>
                                    <div className={`text-sm font-black font-mono ${t.type === 'plus' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                                        {t.type === 'plus' ? '+' : '-'}{formatCurrency(t.amount)}
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

const Finanzas: React.FC<FinanzasProps> = ({ clientes, trabajos, gastos, onDataRefresh }) => {
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [showAddGasto, setShowAddGasto] = useState(false);
    const [editingGasto, setEditingGasto] = useState<Gasto | null>(null);
    const [detailView, setDetailView] = useState<'ingresos' | 'egresos' | 'balance' | 'margen' | null>(null);

    // Identificar periodos con datos
    const availablePeriods = useMemo(() => {
        const periods: Record<number, Set<number>> = {};

        // De trabajos finalizados o con pagos
        trabajos.forEach(t => {
            const dates = [
                t.fechaSalida ? new Date(t.fechaSalida) : null,
                t.fechaEntrada ? new Date(t.fechaEntrada) : null,
                ...(t.partes || [])
                    .filter(p => p.nombre === '__PAGO_REGISTRADO__' && p.fecha)
                    .map(p => new Date(p.fecha!))
            ].filter((d): d is Date => d !== null);

            dates.forEach(d => {
                const y = d.getFullYear();
                const m = d.getMonth();
                if (!periods[y]) periods[y] = new Set<number>();
                periods[y].add(m);
            });
        });

        // De gastos
        gastos.forEach(g => {
            const d = new Date(g.fecha);
            const y = d.getFullYear();
            const m = d.getMonth();
            if (!periods[y]) periods[y] = new Set<number>();
            periods[y].add(m);
        });

        return periods;
    }, [trabajos, gastos]);

    const availableYears = useMemo(() => {
        const years = Object.keys(availablePeriods).map(Number).sort((a: number, b: number) => b - a);
        if (years.length === 0) return [new Date().getFullYear()];
        return years;
    }, [availablePeriods]);

    const availableMonths = useMemo(() => {
        const monthsSet = availablePeriods[selectedYear];
        if (!monthsSet) return Array.from({ length: 12 }, (_, i) => i);
        return Array.from(monthsSet).sort((a: number, b: number) => a - b);
    }, [availablePeriods, selectedYear]);

    // Ajustar selección si el mes/año actual deja de ser válido
    useEffect(() => {
        if (!availableYears.includes(selectedYear)) {
            setSelectedYear(availableYears[0]);
        }
    }, [availableYears, selectedYear]);

    useEffect(() => {
        if (!availableMonths.includes(selectedMonth)) {
            const currentMonth = new Date().getMonth();
            const closest = availableMonths.includes(currentMonth)
                ? currentMonth
                : availableMonths[availableMonths.length - 1];
            setSelectedMonth(closest);
        }
    }, [availableMonths, selectedMonth]);

    // Función auxiliar para calcular stats de un mes/año
    const calculateStats = (month: number, year: number) => {
        const startDate = new Date(year, month, 1, 0, 0, 0, 0);
        const endDate = new Date(year, month + 1, 0, 23, 59, 59, 999);

        const jobsFinishedInPeriodCount = trabajos.filter(t => {
            if (t.status !== JobStatus.Finalizado) return false;
            const finishDate = t.fechaSalida ? new Date(t.fechaSalida) : (t.fechaEntrada ? new Date(t.fechaEntrada) : null);
            if (!finishDate) return false;
            return finishDate >= startDate && finishDate <= endDate;
        }).length;

        const gastosInPeriod = gastos.filter(g => {
            const d = new Date(g.fecha);
            return d >= startDate && d <= endDate;
        });

        let ingresosTotales = 0;
        let gananciaManoDeObraReal = 0;
        const periodTransactions: { date: Date, desc: string, amount: number, type: 'plus' | 'minus', cat?: string }[] = [];

        trabajos.forEach(trabajo => {
            const parts = trabajo.partes.filter(p => p.nombre !== '__PAGO_REGISTRADO__');
            const costoRepuestosTaller = parts
                .filter(p => !p.isService && !p.isCategory && !p.clientPaidDirectly)
                .reduce((sum, p) => sum + (p.cantidad * p.precioUnitario), 0);

            const todosLosPagos = trabajo.partes
                .filter(p => p.nombre === '__PAGO_REGISTRADO__')
                .sort((a, b) => new Date(a.fecha || 0).getTime() - new Date(b.fecha || 0).getTime());

            let partsCostCoveredSoFar = 0;

            // Encontrar vehículo para el descriptor
            const clienteRelacionado = clientes.find(c => c.id === trabajo.clienteId);
            const vehiculoObj = clienteRelacionado?.vehiculos?.find(v => v.id === trabajo.vehiculoId);
            const vehiculoDesc = vehiculoObj ? `${vehiculoObj.marca} ${vehiculoObj.modelo}` : 'Vehículo';

            todosLosPagos.forEach(pago => {
                const monto = pago.precioUnitario;
                const fechaPago = pago.fecha ? new Date(pago.fecha) : new Date(0);
                const esDelPeriodo = fechaPago >= startDate && fechaPago <= endDate;
                const type = pago.paymentType;

                if (type === 'labor') {
                    if (esDelPeriodo) {
                        ingresosTotales += monto;
                        gananciaManoDeObraReal += monto;
                        periodTransactions.push({
                            date: fechaPago,
                            desc: `Pago M.O.: ${vehiculoDesc}`,
                            amount: monto,
                            type: 'plus'
                        });
                    }
                } else {
                    const remainingPartsCost = Math.max(0, costoRepuestosTaller - partsCostCoveredSoFar);
                    const contributionToParts = Math.min(monto, remainingPartsCost);
                    const contributionToLabor = monto - contributionToParts;
                    partsCostCoveredSoFar += contributionToParts;
                    if (esDelPeriodo) {
                        ingresosTotales += monto;
                        gananciaManoDeObraReal += contributionToLabor;
                        periodTransactions.push({
                            date: fechaPago,
                            desc: `Pago General: ${vehiculoDesc}`,
                            amount: monto,
                            type: 'plus'
                        });
                    }
                }
            });
        });

        const totalGastos = gastosInPeriod.reduce((sum, g) => sum + g.monto, 0);
        gastosInPeriod.forEach(g => {
            periodTransactions.push({
                date: new Date(g.fecha),
                desc: g.descripcion,
                amount: g.monto,
                type: 'minus',
                cat: g.categoria
            });
        });

        const BalanceNeto = gananciaManoDeObraReal - totalGastos;
        const margen = ingresosTotales > 0 ? (BalanceNeto / ingresosTotales) * 100 : 0;

        return {
            ingresos: ingresosTotales,
            egresos: totalGastos,
            balance: BalanceNeto,
            margen,
            jobsCount: jobsFinishedInPeriodCount,
            gastosCount: gastosInPeriod.length,
            transactions: periodTransactions.sort((a, b) => b.date.getTime() - a.date.getTime())
        };
    };

    const stats = useMemo(() => calculateStats(selectedMonth, selectedYear), [trabajos, gastos, selectedMonth, selectedYear]);

    // Comparación con el mes anterior
    const prevStats = useMemo(() => {
        let prevMonth = selectedMonth - 1;
        let prevYear = selectedYear;
        if (prevMonth < 0) {
            prevMonth = 11;
            prevYear--;
        }
        return calculateStats(prevMonth, prevYear);
    }, [trabajos, gastos, selectedMonth, selectedYear]);

    // Historial para el gráfico (últimos 6 meses)
    const historyData = useMemo(() => {
        const data = [];
        for (let i = 5; i >= 0; i--) {
            const d = new Date();
            d.setMonth(d.getMonth() - i);
            const m = d.getMonth();
            const y = d.getFullYear();

            const sDate = new Date(y, m, 1, 0, 0, 0, 0);
            const eDate = new Date(y, m + 1, 0, 23, 59, 59, 999);

            let mIngresos = 0;
            trabajos.forEach(trabajo => {
                trabajo.partes.filter(p => p.nombre === '__PAGO_REGISTRADO__').forEach(pago => {
                    const fechaPago = pago.fecha ? new Date(pago.fecha) : new Date(0);
                    if (fechaPago >= sDate && fechaPago <= eDate) {
                        mIngresos += pago.precioUnitario;
                    }
                });
            });

            const mEgresos = gastos.filter(g => {
                const gd = new Date(g.fecha);
                return gd >= sDate && gd <= eDate;
            }).reduce((acc, g) => acc + g.monto, 0);

            data.push({
                name: d.toLocaleString('es-ES', { month: 'short' }),
                fullName: d.toLocaleString('es-ES', { month: 'long' }),
                ingresos: mIngresos,
                egresos: mEgresos,
            });
        }
        return data;
    }, [trabajos, gastos]);

    const handleAddGasto = async (newGastos: Omit<Gasto, 'id'>[]) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { error } = await supabase.from('gastos').insert(
            newGastos.map(g => ({
                taller_id: user.id,
                descripcion: g.descripcion,
                monto: g.monto,
                fecha: g.fecha,
                categoria: g.categoria,
                es_fijo: g.esFijo
            }))
        );

        if (error) console.error('Error adding gasto:', error);
        else onDataRefresh?.();
    };

    const handleUpdateGasto = async (updatedGasto: Gasto) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { error } = await supabase
            .from('gastos')
            .update({
                monto: updatedGasto.monto,
                descripcion: updatedGasto.descripcion,
                fecha: updatedGasto.fecha,
                categoria: updatedGasto.categoria,
                es_fijo: updatedGasto.esFijo
            })
            .eq('id', updatedGasto.id);

        if (error) console.error('Error updating gasto:', error);
        else onDataRefresh?.();
    };

    const handleDeleteGasto = async (id: string) => {
        if (!confirm("¿Eliminar este gasto?")) return;
        const { error } = await supabase.from('gastos').delete().eq('id', id);
        if (error) console.error("Error deleting gasto:", error);
        else onDataRefresh?.();
    };

    const detailTransactions = useMemo(() => {
        if (!detailView) return [];
        if (detailView === 'ingresos') return stats.transactions.filter(t => t.type === 'plus');
        if (detailView === 'egresos') return stats.transactions.filter(t => t.type === 'minus');
        return stats.transactions;
    }, [detailView, stats.transactions]);

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Header con Filtros */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-taller-dark dark:text-taller-light tracking-tight flex items-center">
                        <Wallet className="mr-3 h-8 w-8 text-taller-primary" />
                        Centro Financiero
                    </h1>
                    <p className="text-taller-gray dark:text-gray-400 font-medium">Gestiona ingresos, gastos y rentabilidad</p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex bg-white dark:bg-gray-800 p-1.5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
                        <select
                            value={selectedMonth}
                            onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                            className="bg-transparent text-sm font-bold px-3 py-1.5 outline-none text-taller-dark dark:text-taller-light"
                        >
                            {availableMonths.map((m) => (
                                <option key={m} value={m}>
                                    {new Date(0, m).toLocaleString('es-ES', { month: 'long' })}
                                </option>
                            ))}
                        </select>
                        <select
                            value={selectedYear}
                            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                            className="bg-transparent text-sm font-bold px-3 py-1.5 outline-none text-taller-dark dark:text-taller-light border-l dark:border-gray-700"
                        >
                            {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                    </div>

                    <button
                        onClick={() => setShowAddGasto(true)}
                        className="flex items-center space-x-2 bg-taller-primary hover:bg-taller-secondary text-white px-5 py-3 rounded-2xl font-bold transition-all shadow-lg shadow-taller-primary/20 active:scale-95"
                    >
                        <Plus className="h-5 w-5" />
                        <span>Añadir Gasto</span>
                    </button>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <button
                    onClick={() => setDetailView('ingresos')}
                    className="bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 relative overflow-hidden group text-left transition-all hover:shadow-xl hover:-translate-y-1 active:scale-95 cursor-pointer"
                >
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <TrendingUp className="h-16 w-16 text-emerald-500" />
                    </div>
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center space-x-3">
                            <div className="p-2 bg-emerald-50 dark:bg-emerald-500/10 rounded-xl">
                                <ArrowUpRight className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                            </div>
                            <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">Ingresos</span>
                        </div>
                        <ChevronRight className="h-4 w-4 text-taller-gray opacity-0 group-hover:opacity-100 transition-all transform translate-x-1 group-hover:translate-x-0" />
                    </div>
                    <div className="text-2xl font-black text-taller-dark dark:text-taller-light font-mono">
                        {formatCurrency(stats.ingresos)}
                    </div>
                    <p className="text-xs text-taller-gray mt-2 font-medium">{stats.jobsCount} trabajos finalizados</p>
                </button>

                <button
                    onClick={() => setDetailView('egresos')}
                    className="bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 relative overflow-hidden group text-left transition-all hover:shadow-xl hover:-translate-y-1 active:scale-95 cursor-pointer"
                >
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <TrendingDown className="h-16 w-16 text-rose-500" />
                    </div>
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center space-x-3">
                            <div className="p-2 bg-rose-50 dark:bg-rose-500/10 rounded-xl">
                                <ArrowDownRight className="h-5 w-5 text-rose-600 dark:text-rose-400" />
                            </div>
                            <span className="text-sm font-bold text-rose-600 dark:text-rose-400">Egresos</span>
                        </div>
                        <ChevronRight className="h-4 w-4 text-taller-gray opacity-0 group-hover:opacity-100 transition-all transform translate-x-1 group-hover:translate-x-0" />
                    </div>
                    <div className="text-2xl font-black text-taller-dark dark:text-taller-light font-mono">
                        {formatCurrency(stats.egresos)}
                    </div>
                    <p className="text-xs text-taller-gray mt-2 font-medium">{stats.gastosCount} ítems registrados</p>
                </button>

                <button
                    onClick={() => setDetailView('balance')}
                    className="bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 relative overflow-hidden group text-left transition-all hover:shadow-xl hover:-translate-y-1 active:scale-95 cursor-pointer"
                >
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <DollarSign className="h-16 w-16 text-taller-primary" />
                    </div>
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center space-x-3">
                            <div className="p-2 bg-blue-50 dark:bg-blue-500/10 rounded-xl">
                                <Wallet className="h-5 w-5 text-taller-primary" />
                            </div>
                            <span className="text-sm font-bold text-taller-primary">Balance Neto</span>
                        </div>
                        <ChevronRight className="h-4 w-4 text-taller-gray opacity-0 group-hover:opacity-100 transition-all transform translate-x-1 group-hover:translate-x-0" />
                    </div>
                    <div className={`text-2xl font-black font-mono ${stats.balance >= 0 ? 'text-taller-dark dark:text-taller-light' : 'text-rose-600'}`}>
                        {formatCurrency(stats.balance)}
                    </div>
                    <p className="text-xs text-taller-gray mt-2 font-medium">Resultado del período</p>
                </button>

                <button
                    onClick={() => setDetailView('margen')}
                    className="bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 relative overflow-hidden group text-left transition-all hover:shadow-xl hover:-translate-y-1 active:scale-95 cursor-pointer"
                >
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <Calculator className="h-16 w-16 text-violet-500" />
                    </div>
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center space-x-3">
                            <div className="p-2 bg-violet-50 dark:bg-violet-500/10 rounded-xl">
                                <ArrowUpRight className="h-5 w-5 text-violet-600 dark:text-violet-400" />
                            </div>
                            <span className="text-sm font-bold text-violet-600 dark:text-violet-400">Margen Bruto</span>
                        </div>
                        <ChevronRight className="h-4 w-4 text-taller-gray opacity-0 group-hover:opacity-100 transition-all transform translate-x-1 group-hover:translate-x-0" />
                    </div>
                    <div className="text-2xl font-black text-taller-dark dark:text-taller-light font-mono">
                        {stats.margen.toFixed(1)}%
                    </div>
                    <p className="text-xs text-taller-gray mt-2 font-medium">Rentabilidad operativa</p>
                </button>
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-white dark:bg-gray-800 p-8 rounded-[2rem] shadow-sm border border-gray-100 dark:border-gray-700">
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h3 className="text-xl font-black text-taller-dark dark:text-taller-light tracking-tight">Evolución Histórica</h3>
                            <p className="text-sm text-taller-gray font-medium">Últimos 6 meses de actividad</p>
                        </div>
                    </div>
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={historyData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.1} />
                                <XAxis
                                    dataKey="name"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: '#94a3b8', fontSize: 12, fontWeight: 600 }}
                                />
                                <YAxis
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: '#94a3b8', fontSize: 10 }}
                                    tickFormatter={(value) => `$${value / 1000}k`}
                                />
                                <Tooltip
                                    cursor={{ fill: 'rgba(0,0,0,0.02)' }}
                                    content={<CustomTooltip />}
                                />
                                <Bar name="Ingresos" dataKey="ingresos" fill="#1e3a8a" radius={[6, 6, 0, 0]} barSize={24} />
                                <Bar name="Egresos" dataKey="egresos" fill="#ec4899" radius={[6, 6, 0, 0]} barSize={24} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-800 p-8 rounded-[2rem] shadow-sm border border-gray-100 dark:border-gray-700">
                    <div>
                        <h3 className="text-xl font-black text-taller-dark dark:text-taller-light tracking-tight">Distribución</h3>
                        <p className="text-sm text-taller-gray font-medium">Gastos por categoría</p>
                    </div>
                    <div className="h-[250px] mt-4">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={useMemo(() => {
                                        const distCat = gastos.filter(g => {
                                            const d = new Date(g.fecha);
                                            return d.getMonth() === selectedMonth && d.getFullYear() === selectedYear;
                                        }).reduce((acc: any, g) => {
                                            const cat = g.categoria || 'Otros';
                                            acc[cat] = (acc[cat] || 0) + g.monto;
                                            return acc;
                                        }, {});

                                        return Object.keys(distCat).map(cat => ({
                                            name: CATEGORIAS_GASTO[cat as keyof typeof CATEGORIAS_GASTO]?.label || cat,
                                            value: distCat[cat],
                                            color: CATEGORIAS_GASTO[cat as keyof typeof CATEGORIAS_GASTO]?.color || '#94a3b8'
                                        }));
                                    }, [gastos, selectedMonth, selectedYear])}
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {/* Mapear sobre los datos reales para asegurar que el color coincida con la categoría */}
                                    {useMemo(() => {
                                        const distCat = gastos.filter(g => {
                                            const d = new Date(g.fecha);
                                            return d.getMonth() === selectedMonth && d.getFullYear() === selectedYear;
                                        }).reduce((acc: any, g) => {
                                            const cat = g.categoria || 'Otros';
                                            acc[cat] = (acc[cat] || 0) + g.monto;
                                            return acc;
                                        }, {});

                                        return Object.keys(distCat).map((cat, index) => (
                                            <Cell
                                                key={`cell-${index}`}
                                                fill={CATEGORIAS_GASTO[cat as keyof typeof CATEGORIAS_GASTO]?.color || '#94a3b8'}
                                            />
                                        ));
                                    }, [gastos, selectedMonth, selectedYear])}
                                </Pie>
                                <Tooltip
                                    content={<CustomTooltip />}
                                    cursor={{ fill: 'rgba(0,0,0,0.05)' }}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="space-y-2.5 mt-4">
                        {useMemo(() => {
                            const distCat = gastos.filter(g => {
                                const d = new Date(g.fecha);
                                return d.getMonth() === selectedMonth && d.getFullYear() === selectedYear;
                            }).reduce((acc: any, g) => {
                                const cat = g.categoria || 'Otros';
                                acc[cat] = (acc[cat] || 0) + g.monto;
                                return acc;
                            }, {});

                            return Object.keys(distCat).map(cat => ({
                                name: CATEGORIAS_GASTO[cat as keyof typeof CATEGORIAS_GASTO]?.label || cat,
                                value: distCat[cat],
                                color: CATEGORIAS_GASTO[cat as keyof typeof CATEGORIAS_GASTO]?.color || '#94a3b8'
                            })).sort((a, b) => b.value - a.value).slice(0, 4);
                        }, [gastos, selectedMonth, selectedYear]).map((item, i) => (
                            <div key={i} className="flex items-center justify-between text-xs font-bold">
                                <div className="flex items-center">
                                    <div className="w-2 h-2 rounded-full mr-2" style={{ backgroundColor: item.color }} />
                                    <span className="text-taller-gray">{item.name}</span>
                                </div>
                                <span className="text-taller-dark dark:text-taller-light font-mono">{formatCurrency(item.value)}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Expenses List */}
            <div className="bg-white dark:bg-gray-800 rounded-[2rem] shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
                <div className="px-8 py-6 border-b dark:border-gray-700 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <h3 className="text-xl font-black text-taller-dark dark:text-taller-light tracking-tight">Detalle de Gastos</h3>
                    <div className="flex items-center gap-2">
                        <button className="p-2.5 bg-gray-50 dark:bg-gray-700/50 rounded-xl text-taller-gray hover:text-taller-primary transition-colors">
                            <Download className="h-5 w-5" />
                        </button>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="bg-gray-50/50 dark:bg-gray-900/20">
                                <th className="px-8 py-4 text-left text-xs font-black text-taller-gray uppercase tracking-widest">Fecha</th>
                                <th className="px-8 py-4 text-left text-xs font-black text-taller-gray uppercase tracking-widest">Descripción</th>
                                <th className="px-8 py-4 text-left text-xs font-black text-taller-gray uppercase tracking-widest">Categoría</th>
                                <th className="px-8 py-4 text-right text-xs font-black text-taller-gray uppercase tracking-widest">Monto</th>
                                <th className="px-8 py-4 text-center text-xs font-black text-taller-gray uppercase tracking-widest">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y dark:divide-gray-700">
                            {gastos.filter(g => {
                                const d = new Date(g.fecha);
                                return d.getMonth() === selectedMonth && d.getFullYear() === selectedYear;
                            }).map(gasto => {
                                const catInfo = CATEGORIAS_GASTO[gasto.categoria as keyof typeof CATEGORIAS_GASTO] || CATEGORIAS_GASTO.Otros;
                                return (
                                    <tr key={gasto.id} className="group hover:bg-gray-50/50 dark:hover:bg-gray-700/20 transition-colors">
                                        <td className="px-8 py-4 text-sm font-bold text-taller-gray whitespace-nowrap">
                                            {new Date(gasto.fecha).toLocaleDateString()}
                                        </td>
                                        <td className="px-8 py-4">
                                            <div className="flex flex-col">
                                                <span className="text-sm font-bold text-taller-dark dark:text-taller-light">{gasto.descripcion}</span>
                                                {gasto.esFijo && <span className="text-[10px] font-black text-taller-primary uppercase tracking-tighter">Gasto Fijo</span>}
                                            </div>
                                        </td>
                                        <td className="px-8 py-4 whitespace-nowrap">
                                            <div className="flex items-center space-x-2 bg-gray-100 dark:bg-gray-700 w-fit px-3 py-1 rounded-full border border-black/5">
                                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: catInfo.color }} />
                                                <span className="text-[11px] font-black uppercase text-taller-gray tracking-tight">{catInfo.label}</span>
                                            </div>
                                        </td>
                                        <td className="px-8 py-4 text-right">
                                            <span className="text-sm font-mono font-black text-taller-dark dark:text-taller-light">
                                                {formatCurrency(gasto.monto)}
                                            </span>
                                        </td>
                                        <td className="px-8 py-4">
                                            <div className="flex justify-center items-center space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button onClick={() => setEditingGasto(gasto)} className="p-2 hover:bg-white dark:hover:bg-gray-600 rounded-lg text-taller-gray dark:text-gray-400 hover:text-taller-primary transition-all shadow-sm border border-transparent hover:border-gray-200">
                                                    <Calendar className="h-4 w-4" />
                                                </button>
                                                <button onClick={() => handleDeleteGasto(gasto.id)} className="p-2 hover:bg-rose-50 dark:hover:bg-rose-500/20 rounded-lg text-rose-400 hover:text-rose-600 transition-all border border-transparent hover:border-rose-100">
                                                    <TrendingDown className="h-4 w-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Overlays */}
            {detailView && (
                <FinanceDetailOverlay
                    type={detailView}
                    onClose={() => setDetailView(null)}
                    currentData={detailView === 'ingresos' ? stats.ingresos : (detailView === 'egresos' ? stats.egresos : (detailView === 'balance' ? stats.balance : stats.margen))}
                    prevData={detailView === 'ingresos' ? prevStats.ingresos : (detailView === 'egresos' ? prevStats.egresos : (detailView === 'balance' ? prevStats.balance : prevStats.margen))}
                    periodLabel={new Date(selectedYear, selectedMonth).toLocaleString('es-ES', { month: 'long', year: 'numeric' })}
                    transactions={detailTransactions}
                />
            )}

            {showAddGasto && createPortal(
                <AddGastoModal
                    onClose={() => setShowAddGasto(false)}
                    onAddGasto={handleAddGasto}
                />,
                document.body
            )}

            {editingGasto && createPortal(
                <EditGastoModal
                    gasto={editingGasto}
                    onClose={() => setEditingGasto(null)}
                    onUpdateGasto={handleUpdateGasto}
                />,
                document.body
            )}
        </div>
    );
};

export default Finanzas;
