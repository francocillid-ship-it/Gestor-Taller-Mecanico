
import React, { useMemo, useState, useEffect, useRef } from 'react';
import type { Cliente, Trabajo, Gasto } from '../types';
import { JobStatus } from '../types';
import { CurrencyDollarIcon, UsersIcon, WrenchScrewdriverIcon, PlusIcon, PencilIcon, TrashIcon, ChartPieIcon, BuildingLibraryIcon, ScaleIcon, ChevronDownIcon, CalendarIcon } from '@heroicons/react/24/solid';
import AddGastoModal from './AddGastoModal';
import EditGastoModal from './EditGastoModal';
import { supabase } from '../supabaseClient';

interface DashboardProps {
    clientes: Cliente[];
    trabajos: Trabajo[];
    gastos: Gasto[];
    onDataRefresh: () => void;
    searchQuery: string;
}

interface StatCardProps {
    title: string;
    value: string | number;
    icon: React.ReactNode;
    color: string;
}

// Tarjeta rediseñada para ser responsive: Vertical en móvil (2 col), Horizontal en escritorio
const StatCard: React.FC<StatCardProps> = ({ title, value, icon, color }) => (
    <div className="bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-xl shadow-md flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:space-x-4 h-full">
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

const Dashboard: React.FC<DashboardProps> = ({ clientes, trabajos, gastos, onDataRefresh, searchQuery }) => {
    const [isAddGastoModalOpen, setIsAddGastoModalOpen] = useState(false);
    const [gastoToEdit, setGastoToEdit] = useState<Gasto | null>(null);
    const [period, setPeriod] = useState<Period>('this_month');
    const [confirmingDeleteGastoId, setConfirmingDeleteGastoId] = useState<string | null>(null);
    const [isLastMonthExpanded, setIsLastMonthExpanded] = useState(false);
    
    // Referencia para la sección de gastos
    const gastosSectionRef = useRef<HTMLDivElement>(null);

    // Efecto para hacer scroll a la sección de gastos cuando se busca
    useEffect(() => {
        if (searchQuery && gastosSectionRef.current) {
            gastosSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }, [searchQuery]);

    const stats = useMemo(() => {
        const formatCurrency = (amount: number) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(amount);
        
        const now = new Date();
        let startDate = new Date();
        let endDate = new Date(now);

        switch (period) {
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

        const filteredGastos = gastos.filter(g => {
            const gastoDate = new Date(g.fecha);
            return gastoDate >= startDate && gastoDate <= endDate;
        });

        const allPagos = trabajos.flatMap(t => 
            t.partes.filter(p => p.nombre === '__PAGO_REGISTRADO__' && p.fecha)
        );

        const filteredPagos = allPagos.filter(p => {
            const pagoDate = new Date(p.fecha!);
            return pagoDate >= startDate && pagoDate <= endDate;
        });
        
        const ingresosTotales = filteredPagos.reduce((sum, p) => sum + p.precioUnitario, 0);

        const gananciaNeta = trabajos.reduce((totalGanancia, trabajo) => {
            const tienePagoEnPeriodo = trabajo.partes.some(parte => 
                parte.nombre === '__PAGO_REGISTRADO__' &&
                parte.fecha &&
                new Date(parte.fecha) >= startDate &&
                new Date(parte.fecha) <= endDate
            );

            if (tienePagoEnPeriodo) {
                return totalGanancia + (trabajo.costoManoDeObra || 0);
            }
            return totalGanancia;
        }, 0);
        
        const totalGastos = filteredGastos.reduce((sum, g) => sum + g.monto, 0);

        const balance = gananciaNeta - totalGastos;

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

    const FilterControls = () => (
        <div className="flex flex-wrap items-center gap-2 bg-white dark:bg-gray-800 p-2 rounded-lg shadow-sm">
            {[
                { label: 'Este mes', value: 'this_month' },
                { label: 'Últimos 7 días', value: 'last_7_days' },
                { label: 'Últimos 15 días', value: 'last_15_days' },
                { label: 'Mes pasado', value: 'last_month' }
            ].map(p => (
                <button
                    key={p.value}
                    onClick={() => setPeriod(p.value as Period)}
                    className={`px-3 py-1.5 text-xs sm:text-sm font-medium rounded-md transition-colors flex-grow sm:flex-grow-0 ${period === p.value ? 'bg-taller-primary text-white shadow' : 'text-taller-gray dark:text-gray-300 hover:bg-taller-light dark:hover:bg-gray-700'}`}
                >
                    {p.label}
                </button>
            ))}
        </div>
    );

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
                <FilterControls />
            </div>
            
            {/* Updated Grid: 2 columns on mobile (gap reduced), 3 on desktop */}
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6">
                <StatCard title="Ingresos Totales" value={stats.ingresosTotales} icon={<CurrencyDollarIcon />} color="bg-blue-500" />
                <StatCard title="Ganancia Neta" value={stats.gananciasNetas} icon={<ChartPieIcon />} color="bg-green-500" />
                <StatCard title="Gastos" value={stats.gastos} icon={<BuildingLibraryIcon />} color="bg-red-500" />
                <StatCard title="Balance" value={stats.balance} icon={<ScaleIcon />} color="bg-indigo-500" />
                <StatCard title="Trabajos Activos" value={stats.trabajosActivos} icon={<WrenchScrewdriverIcon />} color="bg-yellow-500" />
                <StatCard title="Total Clientes" value={stats.totalClientes} icon={<UsersIcon />} color="bg-purple-500" />
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
        </div>
    );
};

export default Dashboard;
