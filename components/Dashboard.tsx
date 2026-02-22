
import React, { useMemo, useState, useEffect, useRef, useLayoutEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import type { Cliente, Trabajo, Gasto } from '../types';
import { JobStatus } from '../types';
import { CurrencyDollarIcon, UsersIcon, WrenchScrewdriverIcon, PlusIcon, PencilIcon, TrashIcon, ChartPieIcon, BuildingLibraryIcon, ScaleIcon, ChevronDownIcon, CalendarIcon, ArrowLeftIcon, ArrowTrendingUpIcon, ArrowTrendingDownIcon, ArrowTopRightOnSquareIcon, ClipboardDocumentCheckIcon, XMarkIcon } from '@heroicons/react/24/solid';
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
    onNavigate?: () => void;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, icon, color, onClick, onNavigate }) => (
    <div
        onClick={onClick || onNavigate}
        className={`bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-xl shadow-md flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:space-x-4 h-full transform-gpu transition-all duration-300 ease-out select-none will-change-transform ${(onClick || onNavigate) ? 'cursor-pointer hover:shadow-lg hover:scale-[1.02] active:scale-[0.96]' : ''}`}
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

// Formato de periodo: 'this_month' | 'last_7_days' | 'last_15_days' | 'last_month' | 'YYYY-MM'
type Period = string;
type DetailType = 'ingresos' | 'ganancias' | 'gastos' | 'balance' | null;

interface TransactionItem {
    id: string;
    referenceId: string;
    date: Date;
    description: string;
    amount: number;
    type: 'income' | 'expense';
    subtext?: string;
}

// Selector de meses usando Portales para evitar recortes por overflow
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
            {/* Overlay */}
            <div className="fixed inset-0 bg-black/40 backdrop-blur-sm transition-opacity animate-in fade-in duration-300" onClick={onClose} />

            {/* Contenedor del Menú */}
            <div
                className="relative w-[95%] max-w-[280px] sm:absolute bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border-none overflow-hidden animate-in zoom-in-95 fade-in duration-200"
                style={anchorRect && window.innerWidth > 640 ? (() => {
                    const spaceAbove = anchorRect.top;
                    const spaceBelow = window.innerHeight - anchorRect.bottom;
                    const menuHeight = 320; // Aproximación (py-3 header + sm:max-h-64 + py-1)

                    const showBelow = spaceBelow > spaceAbove || spaceAbove < menuHeight;

                    return {
                        top: showBelow ? anchorRect.bottom + 8 : 'auto',
                        bottom: showBelow ? 'auto' : window.innerHeight - anchorRect.top + 8,
                        left: Math.max(16, Math.min(anchorRect.left, window.innerWidth - 296)) // 280 (width) + 16 (padding)
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
    setPeriod: (p: Period) => void;
    data: { transactions: TransactionItem[], total: number };
    gananciasNetasDisplay: string;
    onItemClick: (item: TransactionItem) => void;
    availableMonths: { label: string, value: string }[];
    onAddGasto: () => void;
}

const FinancialDetailOverlay: React.FC<FinancialDetailOverlayProps> = ({
    detailView, onClose, period, setPeriod, data, gananciasNetasDisplay, onItemClick, availableMonths, onAddGasto
}) => {
    const [isVisible, setIsVisible] = useState(false);
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);
    const headerRef = useRef<HTMLDivElement>(null);
    const filterRef = useRef<HTMLDivElement>(null);
    const filterOffsetRef = useRef(0);
    const lastScrollTop = useRef(0);
    const [headerHeight, setHeaderHeight] = useState(0);
    const [filterHeight, setFilterHeight] = useState(0);

    useEffect(() => {
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                setIsVisible(true);
            });
        });
    }, []);

    useEffect(() => {
        if (!detailView) return;
        lastScrollTop.current = 0;
        filterOffsetRef.current = 0;
        if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollTop = 0;
        }
        if (filterRef.current) {
            filterRef.current.style.transform = 'translateY(0px)';
            filterRef.current.style.opacity = '1';
            filterRef.current.style.pointerEvents = 'auto';
        }
        if (contentRef.current) {
            contentRef.current.style.transform = 'translateY(0px)';
        }
    }, [detailView]);

    useLayoutEffect(() => {
        const updateHeight = () => {
            if (!headerRef.current || !filterRef.current) return;
            const headerH = headerRef.current.offsetHeight;
            const filterH = filterRef.current.offsetHeight;
            setHeaderHeight(headerH);
            setFilterHeight(filterH);
            headerRef.current.parentElement?.style.setProperty('--detail-header-h', `${headerH}px`);
            headerRef.current.parentElement?.style.setProperty('--detail-filter-h', `${filterH}px`);
            filterRef.current.style.transform = `translateY(${-filterOffsetRef.current}px)`;
            filterRef.current.style.opacity = (1 - (filterOffsetRef.current / (filterH || 1))).toString();
            if (contentRef.current) {
                contentRef.current.style.transform = `translateY(${-filterOffsetRef.current}px)`;
            }
        };
        const resizeObserver = new ResizeObserver(updateHeight);
        if (headerRef.current) resizeObserver.observe(headerRef.current);
        if (filterRef.current) resizeObserver.observe(filterRef.current);
        updateHeight();
        window.addEventListener('resize', updateHeight);
        return () => {
            resizeObserver.disconnect();
            window.removeEventListener('resize', updateHeight);
        };
    }, []);

    const handleClose = () => {
        setIsVisible(false);
        setTimeout(() => {
            onClose();
        }, 500);
    };

    const handleScroll = useCallback(() => {
        if (!scrollContainerRef.current || !filterRef.current) return;
        const { scrollTop } = scrollContainerRef.current;
        const diff = scrollTop - lastScrollTop.current;
        lastScrollTop.current = scrollTop;

        if (scrollTop <= 0) {
            filterOffsetRef.current = 0;
        } else {
            filterOffsetRef.current = Math.max(0, Math.min(filterHeight, filterOffsetRef.current + diff));
        }

        const offset = filterOffsetRef.current;
        const filter = filterRef.current;
        filter.style.transform = `translateY(${-offset}px)`;
        filter.style.opacity = (1 - (offset / (filterHeight || 1))).toString();
        filter.style.pointerEvents = offset > filterHeight * 0.8 ? 'none' : 'auto';
        if (contentRef.current) {
            contentRef.current.style.transform = `translateY(${-offset}px)`;
        }
    }, [filterHeight]);

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
            <div className={`fixed inset-0 z-[99] bg-black/30 backdrop-blur-sm transition-opacity duration-500 ease-in-out ${isVisible ? 'opacity-100' : 'opacity-0'}`} onClick={handleClose} aria-hidden="true" />
            <div
                className={`fixed inset-0 z-[100] bg-taller-light dark:bg-taller-dark flex flex-col shadow-2xl transition-transform duration-500 will-change-transform relative ${isVisible ? 'translate-y-0' : 'translate-y-full'}`}
                style={{ transitionTimingFunction: 'cubic-bezier(0.32, 0.72, 0, 1)' }}
            >
                <div
                    ref={headerRef}
                    className="absolute top-0 left-0 right-0 z-30 transform-gpu"
                    style={{ willChange: 'transform, opacity' }}
                >
                    <div className="bg-white dark:bg-gray-800 shadow-sm border-none safe-top-padding-portal">
                        <div className="flex items-center justify-between p-4">
                            <button onClick={handleClose} className="p-2 -ml-2 text-taller-gray dark:text-gray-400 hover:text-taller-dark dark:hover:text-white rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"><ArrowLeftIcon className="h-6 w-6" /></button>
                            <h2 className="text-lg font-bold text-taller-dark dark:text-taller-light">{titleMap[detailView]}</h2>
                            <div className="flex items-center gap-2">
                                {(detailView === 'gastos' || detailView === 'balance') && (
                                    <button
                                        onClick={onAddGasto}
                                        className="p-2 bg-taller-primary text-white rounded-full shadow-lg active:scale-95 transition-all"
                                        title="Añadir Gasto"
                                    >
                                        <PlusIcon className="h-5 w-5" />
                                    </button>
                                )}
                                <div className="w-2"></div>
                            </div>
                        </div>
                    </div>

                    <div
                        ref={filterRef}
                        className="bg-taller-light dark:bg-taller-dark transform-gpu"
                        style={{ willChange: 'transform, opacity' }}
                    >
                        <div className="p-4 pb-2">
                            <FilterControls activePeriod={period} setPeriodFn={setPeriod} availableMonths={availableMonths} />
                        </div>
                    </div>
                </div>

                <div
                    ref={scrollContainerRef}
                    onScroll={handleScroll}
                    className="flex-1 overflow-y-auto px-4 pb-4 pt-2 space-y-4 overscroll-none"
                    style={{ paddingTop: 'calc(var(--detail-header-h) + var(--detail-filter-h))' }}
                >
                    <div ref={contentRef} className="transform-gpu" style={{ willChange: 'transform' }}>
                        <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm text-center mt-2 border-none transform-gpu">
                            <p className="text-sm text-taller-gray dark:text-gray-400 uppercase tracking-wide">Total del Periodo</p>
                            <p className={`text-4xl font-bold mt-2 ${data.total >= 0 ? 'text-taller-dark dark:text-taller-light' : 'text-red-600'}`}>{displayTotal}</p>
                            {isProfitView && <p className="text-xs text-taller-gray dark:text-gray-500 mt-2">* Cálculo: Mano de Obra + Sobrantes de Repuestos.</p>}
                        </div>

                        <div className="space-y-3 pb-24">
                            {data.transactions.length > 0 ? (
                                data.transactions.map((t, index) => (
                                    <div key={t.id} onClick={() => onItemClick(t)} className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm flex items-center justify-between border-l-4 border-transparent hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer active:scale-[0.98] transition-all duration-300 animate-slide-in-bottom fill-mode-backwards group" style={{ borderLeftColor: t.type === 'income' ? '#22c55e' : '#ef4444', animationDelay: `${index * 50}ms` }}>
                                        <div className="flex items-center gap-3">
                                            <div className={`p-2 rounded-full ${t.type === 'income' ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'}`}>{t.type === 'income' ? <ArrowTrendingUpIcon className="h-5 w-5" /> : <ArrowTrendingDownIcon className="h-5 w-5" />}</div>
                                            <div>
                                                <p className="font-bold text-taller-dark dark:text-taller-light text-sm flex items-center gap-1">{t.description}<ArrowTopRightOnSquareIcon className="h-3 w-3 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity" /></p>
                                                <p className="text-xs text-taller-gray dark:text-gray-400">{t.subtext}</p>
                                                <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">{t.date.toLocaleDateString('es-ES')} {t.date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className={`font-bold ${t.type === 'income' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>{t.type === 'income' ? '+' : '-'} {new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(t.amount)}</p>
                                            {isProfitView && t.type === 'income' && <p className="text-[10px] text-gray-400 italic">Neto Mano de Obra</p>}
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="text-center py-10 text-taller-gray dark:text-gray-400"><ScaleIcon className="h-12 w-12 mx-auto mb-2 opacity-20" /><p>No hay movimientos en este periodo.</p></div>
                            )}
                        </div>
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
    const [detailView, setDetailView] = useState<DetailType>(null);

    const gastosSectionRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (searchQuery && gastosSectionRef.current) {
            gastosSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }, [searchQuery]);

    // Calcular meses disponibles con registros reales
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
        const trabajosActivos = trabajos.filter(t => t.status === JobStatus.EnProceso).length;
        const totalClientes = clientes.length;

        return {
            ingresosTotales: formatCurrency(ingresosTotales),
            gananciasNetas: formatCurrency(gananciaNeta),
            gastos: formatCurrency(totalGastos),
            trabajosActivos,
            trabajosFinalizados,
            totalClientes,
        };
    }, [clientes, trabajos, gastos, period]);

    const handleAddGasto = async (gastosToAdd: Omit<Gasto, 'id'>[]) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const gastosConId = gastosToAdd.map(g => ({
            taller_id: user.id,
            descripcion: g.descripcion,
            monto: g.monto,
            fecha: g.fecha,
            categoria: g.categoria,
            es_fijo: g.esFijo // Fix: Map camelCase to snake_case for DB
        }));
        const { error } = await supabase.from('gastos').insert(gastosConId);
        if (error) console.error("Error adding expense:", error);
        else { onDataRefresh(); setIsAddGastoModalOpen(false); }
    };

    const handleUpdateGasto = async (gasto: Gasto) => {
        const { id, ...updateData } = gasto;
        const { error } = await supabase.from('gastos').update(updateData).eq('id', id);
        if (error) console.error("Error updating expense:", error);
        else { onDataRefresh(); setGastoToEdit(null); }
    };

    const handleDeleteGasto = async (gastoId: string) => {
        const { error } = await supabase.from('gastos').delete().eq('id', gastoId);
        if (error) console.error("Error deleting expense:", error);
        else onDataRefresh();
        setConfirmingDeleteGastoId(null);
    };

    const handleTransactionClick = (item: TransactionItem) => {
        if (item.type === 'income') {
            setDetailView(null);
            const job = trabajos.find(t => t.id === item.referenceId);
            const status = job ? job.status : undefined;
            onNavigate('trabajos', status, item.referenceId);
        } else if (item.type === 'expense') {
            const gasto = gastos.find(g => g.id === item.referenceId);
            if (gasto) { setDetailView(null); setGastoToEdit(gasto); }
        }
    };

    const groupedGastos = useMemo(() => {
        let filtered = [...gastos];
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            filtered = filtered.filter(g => g.descripcion.toLowerCase().includes(query) || g.monto.toString().includes(query));
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
            if (d.getMonth() === currentMonth && d.getFullYear() === currentYear) thisMonth.push(g);
            else if (d.getMonth() === prevMonth && d.getFullYear() === prevYear) lastMonth.push(g);
            else if (searchQuery) thisMonth.push(g);
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
                    if (type === 'labor') profitPortion = amount;
                    else {
                        const remainingPartsCost = Math.max(0, costoRepuestosTaller - partsCostCoveredSoFar);
                        const contributionToParts = Math.min(amount, remainingPartsCost);
                        profitPortion = amount - contributionToParts;
                        partsCostCoveredSoFar += contributionToParts;
                    }
                    let amountToReport = detailView === 'ganancias' ? profitPortion : amount;
                    let shouldReport = detailView === 'ganancias' ? amountToReport > 0 : true;
                    if (shouldReport && date >= startDate && date <= endDate) {
                        const cliente = clientes.find(c => c.id === t.clienteId);
                        const vehiculo = cliente?.vehiculos.find(v => v.id === t.vehiculoId);
                        transactions.push({ id: `${t.id}_pago_${idx}`, referenceId: t.id, date: date, amount: amountToReport, description: `Pago de ${cliente ? cliente.nombre : 'Cliente'}`, subtext: vehiculo ? `${vehiculo.marca} ${vehiculo.modelo}` : 'Vehículo no especif.', type: 'income' });
                    }
                });
            });
        }
        if (detailView === 'gastos' || detailView === 'balance' || detailView === 'ganancias') {
            gastos.forEach(g => {
                const date = new Date(g.fecha);
                if (date >= startDate && date <= endDate) transactions.push({ id: g.id, referenceId: g.id, date: date, amount: g.monto, description: g.descripcion, subtext: 'Gasto registrado', type: 'expense' });
            });
        }
        transactions.sort((a, b) => b.date.getTime() - a.date.getTime());
        const total = transactions.reduce((sum, t) => t.type === 'income' ? sum + t.amount : sum - t.amount, 0);
        return { transactions, total };
    }, [detailView, trabajos, gastos, clientes, period]);

    const renderGastoRow = (gasto: Gasto) => (
        <div key={gasto.id} className="flex flex-col sm:flex-row sm:justify-between sm:items-center p-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-lg gap-2 border-none transition-colors">
            <div className="w-full sm:w-auto">
                <p className="font-medium text-taller-dark dark:text-taller-light">{gasto.descripcion}</p>
                <p className="text-sm text-taller-gray dark:text-gray-400">{new Date(gasto.fecha).toLocaleDateString('es-ES')}</p>
            </div>
            <div className="flex items-center justify-between w-full sm:w-auto gap-4">
                <p className="font-semibold text-red-600">{new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(gasto.monto)}</p>
                {confirmingDeleteGastoId === gasto.id ? (
                    <div className="flex items-center gap-2"><span className="text-sm font-medium text-red-600 hidden sm:inline">¿Seguro?</span><button onClick={() => handleDeleteGasto(gasto.id)} className="px-2 py-1 text-xs font-bold text-white bg-red-600 rounded hover:bg-red-700">Sí</button><button onClick={() => setConfirmingDeleteGastoId(null)} className="px-2 py-1 text-xs font-medium text-gray-700 bg-gray-200 dark:bg-gray-600 dark:text-gray-200 dark:hover:bg-gray-500 rounded">No</button></div>
                ) : (
                    <div className="flex gap-1"><button onClick={() => setGastoToEdit(gasto)} className="text-taller-gray dark:text-gray-400 hover:text-taller-secondary dark:hover:text-white p-1 bg-gray-100 dark:bg-gray-700 sm:bg-transparent sm:dark:bg-transparent rounded"><PencilIcon className="h-4 w-4" /></button><button onClick={() => setConfirmingDeleteGastoId(gasto.id)} className="text-taller-gray dark:text-gray-400 hover:text-red-600 dark:hover:text-red-500 p-1 bg-gray-100 dark:bg-gray-700 sm:bg-transparent sm:dark:bg-transparent rounded"><TrashIcon className="h-4 w-4" /></button></div>
                )}
            </div>
        </div>
    );

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

            <div ref={gastosSectionRef} className="bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-xl shadow-md scroll-mt-24">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-4 gap-4">
                    <h3 className="text-lg font-bold text-taller-dark dark:text-taller-light">Gastos Recientes</h3>
                    <button onClick={() => setIsAddGastoModalOpen(true)} className="flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-taller-primary rounded-lg shadow-md hover:bg-taller-secondary transition-colors"><PlusIcon className="h-5 w-5" /> Añadir Gasto</button>
                </div>
                <div className="space-y-2">
                    {groupedGastos.thisMonth.length > 0 ? groupedGastos.thisMonth.map(renderGastoRow) : !searchQuery && <p className="text-center text-sm text-taller-gray dark:text-gray-400 py-2">No hay gastos registrados este mes.</p>}
                    {groupedGastos.lastMonth.length > 0 && !searchQuery && (
                        <div className="mt-4 border-none pt-2">
                            <button onClick={() => setIsLastMonthExpanded(!isLastMonthExpanded)} className="w-full flex items-center justify-between p-2 text-sm font-medium text-taller-gray dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded transition-colors"><span className="flex items-center gap-2"><CalendarIcon className="h-4 w-4" />Mes Pasado ({groupedGastos.lastMonth.length})</span><ChevronDownIcon className={`h-4 w-4 transform transition-transform duration-200 ${isLastMonthExpanded ? 'rotate-180' : ''}`} /></button>
                            <div className={`grid transition-[grid-template-rows] duration-300 ease-out ${isLastMonthExpanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}><div className="overflow-hidden"><div className="pt-2">{groupedGastos.lastMonth.map(renderGastoRow)}</div></div></div>
                        </div>
                    )}
                    {groupedGastos.thisMonth.length === 0 && groupedGastos.lastMonth.length === 0 && <p className="text-center text-taller-gray dark:text-gray-400 py-4">No hay gastos registrados que coincidan con la búsqueda.</p>}
                </div>
            </div>

            {isAddGastoModalOpen && createPortal(
                <AddGastoModal onClose={() => setIsAddGastoModalOpen(false)} onAddGasto={handleAddGasto} />,
                document.body
            )}
            {gastoToEdit && createPortal(
                <EditGastoModal gasto={gastoToEdit} onClose={() => setGastoToEdit(null)} onUpdateGasto={handleUpdateGasto} />,
                document.body
            )}

            {detailView && (
                <FinancialDetailOverlay
                    detailView={detailView}
                    onClose={() => setDetailView(null)}
                    period={period}
                    setPeriod={setPeriod}
                    data={financialDetailData}
                    gananciasNetasDisplay={stats.gananciasNetas}
                    onItemClick={handleTransactionClick}
                    availableMonths={availableMonths}
                    onAddGasto={() => setIsAddGastoModalOpen(true)}
                />
            )}
        </div>
    );
};

export default Dashboard;
