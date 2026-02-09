
import React, { useState, useEffect, useCallback, lazy, Suspense, useRef } from 'react';
import { supabase } from '../supabaseClient';
import type { Cliente, Trabajo, Gasto, TallerInfo, UserRole } from '../types';
import { JobStatus as JobStatusEnum } from '../types';
import Header from './Header';
import {
    HomeIcon,
    WrenchScrewdriverIcon,
    UsersIcon,
    Cog6ToothIcon,
    CurrencyDollarIcon,
    ChartPieIcon
} from '@heroicons/react/24/solid';
import { applyAppTheme, applyFontSize } from '../constants';

import DashboardSkeleton from './DashboardSkeleton';
import type { User } from '@supabase/supabase-js';

// Lazy loaded views
const Dashboard = lazy(() => import('./Dashboard'));
const Trabajos = lazy(() => import('./Trabajos'));
const Clientes = lazy(() => import('./Clientes'));
const Ajustes = lazy(() => import('./Ajustes'));
const Finanzas = lazy(() => import('./Finanzas'));

interface TallerDashboardProps {
    onLogout: () => void;
    user: User;
}

type View = 'dashboard' | 'trabajos' | 'clientes' | 'finanzas' | 'ajustes';

const VIEW_ORDER: View[] = ['dashboard', 'trabajos', 'clientes', 'finanzas', 'ajustes'];

const navItems = [
    { id: 'dashboard', label: 'Inicio', icon: HomeIcon },
    { id: 'trabajos', label: 'Trabajos', icon: WrenchScrewdriverIcon },
    { id: 'clientes', label: 'Clientes', icon: UsersIcon },
    { id: 'finanzas', label: 'Finanzas', icon: CurrencyDollarIcon },
    { id: 'ajustes', label: 'Ajustes', icon: Cog6ToothIcon },
] as const;

const ViewLoading = () => (
    <div className="h-full w-full flex items-center justify-center bg-transparent backdrop-blur-[2px] animate-in fade-in duration-500">
        <div className="relative flex-shrink-0">
            {/* Anillo exterior */}
            <div className="h-10 w-10 flex-shrink-0 border-2 border-taller-primary/20 rounded-full"></div>
            {/* Spinner activo */}
            <div className="absolute inset-0 h-10 w-10 flex-shrink-0 border-2 border-taller-primary border-t-transparent rounded-full animate-spin"></div>
        </div>
    </div>
);


const TallerDashboard: React.FC<TallerDashboardProps> = ({ onLogout, user }) => {
    const [view, setView] = useState<View>('dashboard');
    const [clientes, setClientes] = useState<Cliente[]>([]);
    const [trabajos, setTrabajos] = useState<Trabajo[]>([]);
    const [gastos, setGastos] = useState<Gasto[]>([]);
    const [tallerInfo, setTallerInfo] = useState<TallerInfo>({
        nombre: 'Mi Taller',
        telefono: '',
        direccion: '',
        cuit: '',
        pdfTemplate: 'classic',
        showLogoOnPdf: false,
        showCuitOnPdf: true,
        logoUrl: undefined,
        headerColor: '#334155',
        fontSize: 'normal'
    });
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [targetJobStatus, setTargetJobStatus] = useState<JobStatusEnum | undefined>(undefined);
    const [targetJobId, setTargetJobId] = useState<string | undefined>(undefined);

    const lastAutoRouteRef = useRef<string>('');

    useEffect(() => {
        const q = searchQuery.toLowerCase().trim();
        if (q.length < 2) {
            lastAutoRouteRef.current = '';
            return;
        }
        if (lastAutoRouteRef.current === q) return;

        const checkMatchesInView = (targetView: View): boolean => {
            if (targetView === 'clientes') {
                return clientes.some(c =>
                    (c.nombre || '').toLowerCase().includes(q) ||
                    (c.apellido || '').toLowerCase().includes(q) ||
                    (c.vehiculos || []).some(v => (v.matricula || '').toLowerCase().includes(q))
                );
            }
            if (targetView === 'trabajos') {
                return trabajos.some(t => {
                    const c = clientes.find(cl => cl.id === t.clienteId);
                    const v = c?.vehiculos.find(ve => ve.id === t.vehiculoId);
                    return (t.descripcion || '').toLowerCase().includes(q) ||
                        (c?.nombre || '').toLowerCase().includes(q) ||
                        (v?.matricula || '').toLowerCase().includes(q);
                });
            }
            if (targetView === 'dashboard' || targetView === 'finanzas') {
                return gastos.some(g => (g.descripcion || '').toLowerCase().includes(q));
            }
            return false;
        };

        const currentMatches = checkMatchesInView(view);
        if (!currentMatches) {
            if (checkMatchesInView('clientes')) {
                lastAutoRouteRef.current = q;
                setView('clientes');
            } else if (checkMatchesInView('trabajos')) {
                lastAutoRouteRef.current = q;
                setView('trabajos');
            } else if (checkMatchesInView('finanzas')) {
                lastAutoRouteRef.current = q;
                setView('finanzas');
            }
        }
    }, [searchQuery, clientes, trabajos, gastos, view]);

    const [dataLoaded, setDataLoaded] = useState({
        tallerInfo: false,
        clientes: false,
        trabajos: false,
        gastos: false
    });

    const fetchingRef = useRef<Set<string>>(new Set());

    const fetchTallerInfo = useCallback(async (userId: string) => {
        if (fetchingRef.current.has('tallerInfo')) return;
        fetchingRef.current.add('tallerInfo');
        try {
            const { data } = await supabase.from('taller_info').select('*').eq('taller_id', userId).maybeSingle();
            if (data) {
                const loadedInfo: TallerInfo = {
                    nombre: data.nombre || '',
                    telefono: data.telefono || '',
                    direccion: data.direccion || '',
                    cuit: data.cuit || '',
                    logoUrl: data.logo_url,
                    pdfTemplate: data.pdf_template || 'classic',
                    showLogoOnPdf: data.show_logo_on_pdf === true,
                    showCuitOnPdf: data.show_cuit_on_pdf !== false,
                    headerColor: data.header_color || '#334155',
                    fontSize: data.font_size || 'normal'
                };
                setTallerInfo(loadedInfo);
                applyAppTheme();
                if (loadedInfo.fontSize) applyFontSize(loadedInfo.fontSize);
            }
            setDataLoaded(prev => ({ ...prev, tallerInfo: true }));
        } finally {
            fetchingRef.current.delete('tallerInfo');
        }
    }, []);

    const fetchClients = useCallback(async (userId: string) => {
        if (fetchingRef.current.has('clientes')) return;
        fetchingRef.current.add('clientes');
        try {
            const { data } = await supabase.from('clientes').select('*, vehiculos(*)').eq('taller_id', userId);
            if (data) setClientes(data as Cliente[]);
            setDataLoaded(prev => ({ ...prev, clientes: true }));
        } finally {
            fetchingRef.current.delete('clientes');
        }
    }, []);

    const fetchJobs = useCallback(async (userId: string) => {
        if (fetchingRef.current.has('trabajos')) return;
        fetchingRef.current.add('trabajos');
        try {
            const { data } = await supabase.from('trabajos').select('*').eq('taller_id', userId);
            if (data) {
                setTrabajos(data.map(t => ({
                    id: t.id,
                    tallerId: t.taller_id,
                    clienteId: t.cliente_id,
                    vehiculoId: t.vehiculo_id,
                    descripcion: t.descripcion,
                    partes: t.partes,
                    costoManoDeObra: t.costo_mano_de_obra,
                    costoEstimado: t.costo_estimado,
                    status: t.status,
                    fechaEntrada: t.fecha_entrada,
                    fechaSalida: t.fecha_salida,
                    fechaProgramada: t.fecha_programada,
                    kilometraje: t.kilometraje,
                    notaAdicional: t.nota_adicional,
                    isQuickBudget: t.is_quick_budget,
                    quickBudgetData: t.quick_budget_data,
                    expiresAt: t.expires_at
                })) as Trabajo[]);
            }
            setDataLoaded(prev => ({ ...prev, trabajos: true }));
        } finally {
            fetchingRef.current.delete('trabajos');
        }
    }, []);

    const fetchExpenses = useCallback(async (userId: string) => {
        if (fetchingRef.current.has('gastos')) return;
        fetchingRef.current.add('gastos');
        try {
            const { data } = await supabase.from('gastos').select('*').eq('taller_id', userId).order('fecha', { ascending: false });
            if (data) {
                setGastos(data.map(g => ({
                    id: g.id,
                    fecha: g.fecha,
                    descripcion: g.descripcion,
                    monto: Number(g.monto),
                    categoria: g.categoria,
                    esFijo: g.es_fijo
                })) as Gasto[]);
            }
            setDataLoaded(prev => ({ ...prev, gastos: true }));
        } finally {
            fetchingRef.current.delete('gastos');
        }
    }, []);

    const fetchData = useCallback(async (showLoader = true) => {
        if (showLoader) setLoading(true);
        try {
            // En el inicio o refresco total, cargamos todo en paralelo para máxima velocidad
            await Promise.all([
                fetchTallerInfo(user.id),
                fetchClients(user.id),
                fetchJobs(user.id),
                fetchExpenses(user.id)
            ]);

        } catch (error) {
            console.error("Error fetching data:", error);
        } finally {
            if (showLoader) setLoading(false);
        }
    }, [user.id, fetchTallerInfo, fetchClients, fetchJobs, fetchExpenses]);

    // Carga bajo demanda basada en la vista actual
    useEffect(() => {
        const loadRequiredData = async () => {
            if (view === 'dashboard' || view === 'finanzas') {
                // Estas vistas necesitan todo para el balance y estadísticas
                const promises = [];
                if (!dataLoaded.tallerInfo) promises.push(fetchTallerInfo(user.id));
                if (!dataLoaded.clientes) promises.push(fetchClients(user.id));
                if (!dataLoaded.trabajos) promises.push(fetchJobs(user.id));
                if (!dataLoaded.gastos) promises.push(fetchExpenses(user.id));
                if (promises.length > 0) {
                    setLoading(true);
                    await Promise.all(promises);
                    setLoading(false);
                }
            } else if (view === 'trabajos') {
                const promises = [];
                if (!dataLoaded.tallerInfo) promises.push(fetchTallerInfo(user.id));
                if (!dataLoaded.clientes) promises.push(fetchClients(user.id));
                if (!dataLoaded.trabajos) promises.push(fetchJobs(user.id));
                if (promises.length > 0) {
                    setLoading(true);
                    await Promise.all(promises);
                    setLoading(false);
                }
            } else if (view === 'clientes') {
                const promises = [];
                if (!dataLoaded.clientes) promises.push(fetchClients(user.id));
                if (!dataLoaded.trabajos) promises.push(fetchJobs(user.id)); // Los clientes muestran sus trabajos
                if (promises.length > 0) {
                    setLoading(true);
                    await Promise.all(promises);
                    setLoading(false);
                }
            } else if (view === 'ajustes') {
                if (!dataLoaded.tallerInfo) {
                    setLoading(true);
                    await fetchTallerInfo(user.id);
                    setLoading(false);
                }
            }
        };

        loadRequiredData();
    }, [view, dataLoaded, user.id, fetchTallerInfo, fetchClients, fetchJobs, fetchExpenses]);

    const handleNavigate = (newView: View, status?: JobStatusEnum, jobId?: string) => {
        setTargetJobStatus(status);
        setTargetJobId(jobId);
        setView(newView);
    };

    const handleUpdateStatus = async (trabajoId: string, newStatus: JobStatusEnum) => {
        try {
            const job = trabajos.find(t => t.id === trabajoId);
            if (!job) return;
            const updates: any = { status: newStatus };
            if (newStatus === JobStatusEnum.Finalizado) updates.fecha_salida = new Date().toISOString();
            else updates.fecha_salida = null;

            if (job.isQuickBudget && newStatus !== JobStatusEnum.Presupuesto && job.quickBudgetData) {
                const { data: newClient, error: clientErr } = await supabase.from('clientes').insert({ taller_id: user.id, nombre: job.quickBudgetData.nombre, apellido: job.quickBudgetData.apellido || null }).select().single();
                if (clientErr) throw clientErr;
                const { data: newVehicle, error: vehicleErr } = await supabase.from('vehiculos').insert({ cliente_id: newClient.id, marca: job.quickBudgetData.marca.toUpperCase(), modelo: job.quickBudgetData.modelo.toUpperCase(), matricula: job.quickBudgetData.matricula?.toUpperCase() || null }).select().single();
                if (vehicleErr) throw vehicleErr;
                updates.cliente_id = newClient.id;
                updates.vehiculo_id = newVehicle.id;
                updates.is_quick_budget = false;
                updates.quick_budget_data = null;
            }
            await supabase.from('trabajos').update(updates).eq('id', trabajoId);
            fetchData(false);
        } catch (error) {
            alert("Error al actualizar el estado.");
        }
    };

    const handleUpdateTallerInfo = async (newInfo: TallerInfo) => {
        if (user) await supabase.from('taller_info').upsert({ taller_id: user.id, ...newInfo, updated_at: new Date().toISOString() });
        setTallerInfo(newInfo);
        applyAppTheme();
        if (newInfo.fontSize) applyFontSize(newInfo.fontSize);
    };

    const activeIndex = VIEW_ORDER.indexOf(view);

    return (
        <div className="flex h-[var(--app-height)] w-full bg-taller-light dark:bg-taller-dark text-taller-dark dark:text-taller-light overflow-hidden">
            <style>{`
                .main-view-slot { 
                    width: 20%; 
                    height: 100%; 
                    flex-shrink: 0;
                    overflow: hidden;
                    position: relative;
                }
                .views-container {
                    display: flex;
                    height: 100%;
                    width: 500%;
                    will-change: transform;
                    transition: transform 0.5s cubic-bezier(0.16, 1, 0.3, 1);
                }
                input, textarea, select { font-size: 16px !important; }
            `}</style>

            <aside className="hidden md:flex md:flex-col w-64 bg-white dark:bg-gray-800 shadow-lg shrink-0 border-r dark:border-gray-700 z-[90]">
                <div className="h-20 flex items-center justify-center border-b dark:border-gray-700 p-4">
                    {tallerInfo.logoUrl ? <img src={tallerInfo.logoUrl} alt="Logo" className="max-h-full object-contain" /> : <WrenchScrewdriverIcon className="h-10 w-10 text-taller-primary" />}
                </div>
                <nav className="flex-1 px-4 py-6 space-y-2">
                    {navItems.map((item) => (
                        <button
                            key={item.id}
                            onClick={() => handleNavigate(item.id as View)}
                            className={`w-full flex items-center px-4 py-3 rounded-xl transition-all duration-200 ${view === item.id ? 'bg-taller-primary text-white shadow-lg shadow-taller-primary/20 scale-[1.02]' : 'text-taller-gray dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
                        >
                            <item.icon className="h-5 w-5 mr-3" />
                            <span className="font-bold text-sm tracking-tight">{item.label}</span>
                        </button>
                    ))}
                </nav>
            </aside>

            <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden relative">
                <Header
                    tallerName={tallerInfo.nombre}
                    logoUrl={tallerInfo.logoUrl}
                    showMenuButton={false}
                    searchQuery={searchQuery}
                    onSearchChange={setSearchQuery}
                />

                <main className="flex-1 w-full overflow-hidden relative bg-taller-light dark:bg-taller-dark">
                    {loading ? (
                        <div className="h-full overflow-y-auto px-4 py-6 md:px-8 scrollbar-hide overscroll-none">
                            <div className="max-w-6xl mx-auto min-h-full pb-10">
                                <DashboardSkeleton />
                            </div>
                        </div>
                    ) : (
                        <div
                            className="views-container"
                            style={{ transform: `translate3d(-${activeIndex * 20}%, 0, 0)` }}
                        >
                            <Suspense fallback={
                                <div className="main-view-slot">
                                    <div className="h-full overflow-y-auto px-4 py-6 md:px-8 scrollbar-hide overscroll-none">
                                        <div className="max-w-6xl mx-auto min-h-full pb-10">
                                            <DashboardSkeleton />
                                        </div>
                                    </div>
                                </div>
                            }>
                                <div className="main-view-slot" style={{ pointerEvents: view === 'dashboard' ? 'auto' : 'none' }}>
                                    <div className="h-full overflow-y-auto px-4 py-6 md:px-8 scrollbar-hide overscroll-none">
                                        <div className="max-w-6xl mx-auto min-h-full pb-10">
                                            <Dashboard clientes={clientes} trabajos={trabajos} gastos={gastos} onDataRefresh={() => fetchData(false)} searchQuery={searchQuery} onNavigate={handleNavigate} />
                                        </div>
                                    </div>
                                </div>
                                <div className="main-view-slot" style={{ pointerEvents: view === 'trabajos' ? 'auto' : 'none' }}>
                                    <Trabajos
                                        trabajos={trabajos}
                                        clientes={clientes}
                                        onUpdateStatus={handleUpdateStatus}
                                        onDataRefresh={() => fetchData(false)}
                                        tallerInfo={tallerInfo}
                                        searchQuery={searchQuery}
                                        initialTab={targetJobStatus}
                                        initialJobId={targetJobId}
                                        isActive={view === 'trabajos'}
                                    />
                                </div>
                                <div className="main-view-slot" style={{ pointerEvents: view === 'clientes' ? 'auto' : 'none' }}>
                                    <div className="h-full overflow-y-auto px-4 py-6 md:px-8 scrollbar-hide overscroll-none">
                                        <div className="max-w-6xl mx-auto min-h-full pb-10">
                                            <Clientes clientes={clientes} trabajos={trabajos} onDataRefresh={() => fetchData(false)} searchQuery={searchQuery} onNavigate={handleNavigate} />
                                        </div>
                                    </div>
                                </div>
                                <div className="main-view-slot" style={{ pointerEvents: view === 'finanzas' ? 'auto' : 'none' }}>
                                    <div className="h-full overflow-y-auto px-4 py-6 md:px-8 scrollbar-hide overscroll-none">
                                        <div className="max-w-6xl mx-auto min-h-full pb-10">
                                            <Finanzas clientes={clientes} trabajos={trabajos} gastos={gastos} onDataRefresh={() => fetchData(false)} />
                                        </div>
                                    </div>
                                </div>
                                <div className="main-view-slot" style={{ pointerEvents: view === 'ajustes' ? 'auto' : 'none' }}>
                                    <div className="h-full overflow-y-auto px-4 py-6 md:px-8 scrollbar-hide overscroll-none">
                                        <div className="max-w-4xl mx-auto min-h-full pb-10">
                                            <Ajustes tallerInfo={tallerInfo} onUpdateTallerInfo={handleUpdateTallerInfo} onLogout={onLogout} searchQuery={searchQuery} />
                                        </div>
                                    </div>
                                </div>
                            </Suspense>
                        </div>
                    )}
                </main>

                <nav className="md:hidden bg-white dark:bg-gray-800 border-t dark:border-gray-700 flex-shrink-0 z-[100]" style={{ paddingBottom: 'var(--safe-bottom)' }}>
                    <div className="flex justify-around items-center h-16 w-full px-2">
                        {navItems.map((item) => (
                            <button
                                key={item.id}
                                onClick={() => handleNavigate(item.id as View)}
                                className={`relative flex flex-col items-center justify-center w-full h-full transition-colors duration-200 ${view === item.id ? 'text-taller-primary' : 'text-taller-gray dark:text-gray-400'}`}
                            >
                                <item.icon className="h-6 w-6" />
                                <span className="text-[10px] mt-1 font-medium">{item.label}</span>
                                {view === item.id && <span className="absolute top-0 w-8 h-1 bg-taller-primary rounded-b-lg"></span>}
                            </button>
                        ))}
                    </div>
                </nav>
            </div>
        </div>
    );
};

export default TallerDashboard;
