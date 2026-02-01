
import React, { useState, useEffect, useCallback, useRef, useLayoutEffect } from 'react';
import { supabase, supabaseUrl, supabaseKey } from '../supabaseClient';
import { createClient } from '@supabase/supabase-js';
import type { Cliente, Trabajo, Gasto, JobStatus, TallerInfo } from '../types';
import { JobStatus as JobStatusEnum } from '../types';
import Dashboard from './Dashboard';
import Trabajos from './Trabajos';
import Clientes from './Clientes';
import Ajustes from './Ajustes';
import Header from './Header';
import { ChartPieIcon, WrenchScrewdriverIcon, UsersIcon, Cog6ToothIcon } from '@heroicons/react/24/solid';
import { applyAppTheme, applyFontSize } from '../constants';

interface TallerDashboardProps {
    onLogout: () => void;
}

type View = 'dashboard' | 'trabajos' | 'clientes' | 'ajustes';

const VIEW_ORDER: View[] = ['dashboard', 'trabajos', 'clientes', 'ajustes'];

const navItems = [
    { id: 'dashboard', label: 'Resumen', icon: ChartPieIcon },
    { id: 'trabajos', label: 'Trabajos', icon: WrenchScrewdriverIcon },
    { id: 'clientes', label: 'Clientes', icon: UsersIcon },
    { id: 'ajustes', label: 'Ajustes', icon: Cog6ToothIcon },
] as const;

const TallerDashboard: React.FC<TallerDashboardProps> = ({ onLogout }) => {
    // ESTRICTO: Iniciar siempre en dashboard
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
    const [targetJobStatus, setTargetJobStatus] = useState<JobStatus | undefined>(undefined);
    const [targetJobId, setTargetJobId] = useState<string | undefined>(undefined);
    
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const sectionRefs = useRef<{ [key in View]: HTMLDivElement | null }>({
        dashboard: null,
        trabajos: null,
        clientes: null,
        ajustes: null
    });

    const fetchData = useCallback(async (showLoader = true) => {
        if (showLoader) setLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data: tallerInfoData, error: tallerInfoError } = await supabase
                .from('taller_info')
                .select('*')
                .eq('taller_id', user.id)
                .maybeSingle();

            if (!tallerInfoError && tallerInfoData) {
                const loadedInfo: TallerInfo = {
                    nombre: tallerInfoData.nombre || '',
                    telefono: tallerInfoData.telefono || '',
                    direccion: tallerInfoData.direccion || '',
                    cuit: tallerInfoData.cuit || '',
                    logoUrl: tallerInfoData.logo_url,
                    pdfTemplate: tallerInfoData.pdf_template || 'classic',
                    showLogoOnPdf: tallerInfoData.show_logo_on_pdf === true,
                    showCuitOnPdf: tallerInfoData.show_cuit_on_pdf !== false,
                    headerColor: tallerInfoData.header_color || '#334155',
                    fontSize: tallerInfoData.font_size || 'normal'
                };
                setTallerInfo(loadedInfo);
                applyAppTheme();
                if (loadedInfo.fontSize) applyFontSize(loadedInfo.fontSize);
            }

            const { data: clientesData } = await supabase
                .from('clientes')
                .select('*, vehiculos(*)')
                .eq('taller_id', user.id);
            if (clientesData) setClientes(clientesData as Cliente[]);

            const { data: trabajosData } = await supabase
                .from('trabajos')
                .select('*')
                .eq('taller_id', user.id);
            
            if (trabajosData) {
                 const mappedTrabajos = trabajosData.map(t => ({
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
                }));
                setTrabajos(mappedTrabajos as Trabajo[]);
            }

            const { data: gastosData } = await supabase
                .from('gastos')
                .select('*')
                .eq('taller_id', user.id)
                .order('fecha', { ascending: false });
            if (gastosData) setGastos(gastosData);

        } catch (error) {
            console.error("Error fetching data:", error);
        } finally {
            if (showLoader) setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData(true);
    }, [fetchData]);

    // Gestión estricta del scroll inicial para evitar saltos
    useLayoutEffect(() => {
        const container = scrollContainerRef.current;
        if (!container) return;

        if (loading) {
            container.scrollLeft = 0;
            return;
        }

        const targetSection = sectionRefs.current[view];
        if (targetSection) {
            // Aseguramos que el scroll ocurra después de que el DOM esté estable
            const timeout = setTimeout(() => {
                container.scrollTo({
                    left: targetSection.offsetLeft,
                    behavior: 'auto' // Usar auto inicialmente para evitar deslizamientos raros al cargar
                });
            }, 10);
            return () => clearTimeout(timeout);
        }
    }, [view, loading]);

    const handleNavigate = (newView: View, status?: JobStatus, jobId?: string) => {
        setView(newView);
        if (status) setTargetJobStatus(status);
        if (jobId) setTargetJobId(jobId);
    };

    const handleSilentRefresh = () => fetchData(false);

    const handleUpdateStatus = async (trabajoId: string, newStatus: JobStatus) => {
        try {
            const trabajoActual = trabajos.find(t => t.id === trabajoId);
            if (!trabajoActual) return;
            const updates: any = { status: newStatus };
            if (newStatus === JobStatusEnum.Finalizado) {
                updates.fecha_salida = new Date().toISOString();
            } else {
                updates.fecha_salida = null;
            }
            const { error } = await supabase.from('trabajos').update(updates).eq('id', trabajoId);
            if (error) throw error;
            fetchData(false);
        } catch (error: any) {
            console.error("Error updating status:", error);
        }
    };

    const handleUpdateTallerInfo = async (newInfo: TallerInfo) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { error: dbError } = await supabase.from('taller_info').upsert({
            taller_id: user.id,
            ...newInfo,
            updated_at: new Date().toISOString()
        });
        if (dbError) throw dbError;
        setTallerInfo(newInfo);
        applyAppTheme();
    };

    return (
        <div className="flex h-full w-full bg-taller-light dark:bg-taller-dark text-taller-dark dark:text-taller-light overflow-hidden transition-colors duration-300">
            {/* Sidebar Desktop */}
            <aside className="hidden md:flex md:flex-col w-64 bg-white dark:bg-gray-800 shadow-lg shrink-0">
                <div className="h-20 flex items-center justify-center border-b dark:border-gray-700">
                    {tallerInfo.logoUrl ? (
                        <img src={tallerInfo.logoUrl} alt="Logo" className="h-12 object-contain"/>
                    ) : (
                        <WrenchScrewdriverIcon className="h-10 w-10 text-taller-primary" />
                    )}
                </div>
                <nav className="flex-1 px-4 py-6 space-y-2">
                    {navItems.map((item) => (
                        <button
                            key={item.id}
                            onClick={() => handleNavigate(item.id as View)}
                            className={`w-full flex items-center px-4 py-3 rounded-lg transition-colors ${
                                view === item.id
                                    ? 'bg-taller-primary text-white shadow-md'
                                    : 'text-taller-gray dark:text-gray-400 hover:bg-taller-light dark:hover:bg-gray-700'
                            }`}
                        >
                            <item.icon className="h-6 w-6 mr-3" />
                            <span className="font-medium">{item.label}</span>
                        </button>
                    ))}
                </nav>
            </aside>

            <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
                <Header 
                    tallerName={tallerInfo.nombre} 
                    logoUrl={tallerInfo.logoUrl}
                    showMenuButton={false}
                    searchQuery={searchQuery}
                    onSearchChange={setSearchQuery}
                />
                
                {/* 
                    CONTENEDOR PRINCIPAL:
                    'overflow-x-hidden' y 'width: 100vw' bloquean cualquier expansión de los hijos (como Trabajos)
                */}
                <main 
                    ref={scrollContainerRef}
                    className={`flex-1 w-full max-w-full overflow-x-hidden overflow-y-hidden flex relative ${loading ? '' : 'snap-x snap-mandatory scroll-smooth'} no-scrollbar`}
                    style={{ width: '100vw' }}
                >
                    {loading ? (
                        <div className="w-full h-full flex-shrink-0 flex items-center justify-center bg-taller-light dark:bg-taller-dark">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-taller-primary"></div>
                        </div>
                    ) : (
                        <>
                            {/* SECCIÓN 1: RESUMEN */}
                            <div 
                                ref={el => sectionRefs.current.dashboard = el}
                                className="w-full h-full flex-shrink-0 snap-start overflow-y-auto p-4 md:p-6 overscroll-none"
                                style={{ width: '100vw' }}
                            >
                                <div className="max-w-7xl mx-auto min-h-full">
                                    <Dashboard clientes={clientes} trabajos={trabajos} gastos={gastos} onDataRefresh={handleSilentRefresh} searchQuery={searchQuery} onNavigate={handleNavigate} />
                                </div>
                            </div>

                            {/* SECCIÓN 2: TRABAJOS */}
                            <div 
                                ref={el => sectionRefs.current.trabajos = el}
                                className="w-full h-full flex-shrink-0 snap-start overflow-hidden bg-taller-light dark:bg-taller-dark"
                                style={{ width: '100vw' }}
                            >
                                <Trabajos 
                                    trabajos={trabajos} 
                                    clientes={clientes} 
                                    onUpdateStatus={handleUpdateStatus} 
                                    onDataRefresh={handleSilentRefresh} 
                                    tallerInfo={tallerInfo} 
                                    searchQuery={searchQuery} 
                                    initialTab={targetJobStatus}
                                    initialJobId={targetJobId}
                                    isActive={view === 'trabajos'}
                                />
                            </div>

                            {/* SECCIÓN 3: CLIENTES */}
                            <div 
                                ref={el => sectionRefs.current.clientes = el}
                                className="w-full h-full flex-shrink-0 snap-start overflow-y-auto p-4 md:p-6 overscroll-none"
                                style={{ width: '100vw' }}
                            >
                                <div className="max-w-7xl mx-auto min-h-full">
                                    <Clientes 
                                        clientes={clientes} 
                                        trabajos={trabajos} 
                                        onDataRefresh={handleSilentRefresh} 
                                        searchQuery={searchQuery} 
                                        onNavigate={handleNavigate}
                                    />
                                </div>
                            </div>

                            {/* SECCIÓN 4: AJUSTES */}
                            <div 
                                ref={el => sectionRefs.current.ajustes = el}
                                className="w-full h-full flex-shrink-0 snap-start overflow-y-auto p-4 md:p-6 overscroll-none"
                                style={{ width: '100vw' }}
                            >
                                <div className="max-w-7xl mx-auto min-h-full">
                                    <Ajustes tallerInfo={tallerInfo} onUpdateTallerInfo={handleUpdateTallerInfo} onLogout={onLogout} searchQuery={searchQuery} />
                                </div>
                            </div>
                        </>
                    )}
                </main>

                {/* Navegación Móvil */}
                <div className="md:hidden bg-white dark:bg-gray-800 border-t dark:border-gray-700 pb-5 flex-shrink-0 z-20">
                    <nav className="flex justify-around items-center h-16">
                        {navItems.map((item) => (
                            <button
                                key={item.id}
                                onClick={() => handleNavigate(item.id as View)}
                                className={`relative flex flex-col items-center justify-center w-full h-full transition-colors duration-200 ${
                                    view === item.id ? 'text-taller-primary' : 'text-taller-gray dark:text-gray-400'
                                }`}
                            >
                                <item.icon className="h-6 w-6" />
                                <span className="text-[10px] mt-1 font-medium">{item.label}</span>
                                {view === item.id && (
                                    <span className="absolute top-0 w-8 h-1 bg-taller-primary rounded-b-lg"></span>
                                )}
                            </button>
                        ))}
                    </nav>
                </div>
            </div>

            <style>{`
                .no-scrollbar::-webkit-scrollbar { display: none; }
                .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
            `}</style>
        </div>
    );
};

export default TallerDashboard;
